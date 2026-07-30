import { DNSServerSettings, UpstreamDNS } from './dns-types';
import { hasRedisConfig, getRedis } from './redis';

interface AuthCredentials {
  username: string;
  password: string;
}

function hasKVConfig(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const STORAGE_KEYS = {
  AUTH_USERNAME: 'settings:auth:username',
  AUTH_PASSWORD: 'settings:auth:password',
  UPSTREAM_SERVERS: 'settings:upstream_servers',
  DNS_SETTINGS: 'settings:dns',
} as const;

const DEFAULT_UPSTREAM_SERVERS: UpstreamDNS[] = [
  { name: 'Cloudflare DNS', url: 'https://1.1.1.1/dns-query', priority: 1, enabled: true },
  { name: 'Google DNS', url: 'https://8.8.8.8/dns-query', priority: 2, enabled: true },
  { name: 'Quad9 DNS', url: 'https://9.9.9.9/dns-query', priority: 3, enabled: true },
];

const DEFAULT_CREDENTIALS: AuthCredentials = {
  username: process.env.AUTH_USERNAME || 'admin',
  password: process.env.AUTH_PASSWORD || 'admin123',
};

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function readNumberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function readListEnv(name: string): string[] {
  return (process.env[name] || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readUpstreamPolicyEnv(): 'priority' | 'round-robin' {
  return process.env.DNS_UPSTREAM_POLICY === 'round-robin' ? 'round-robin' : 'priority';
}

const DEFAULT_DNS_SETTINGS: Omit<DNSServerSettings, 'upstreamServers'> = {
  cacheEnabled: readBooleanEnv('DNS_CACHE_ENABLED', true),
  cacheTTL: readNumberEnv('DNS_CACHE_TTL', 300),
  cacheMaxEntries: readNumberEnv('DNS_CACHE_MAX_ENTRIES', 1000),
  enableLogging: readBooleanEnv('DNS_ENABLE_LOGGING', true),
  maxLogEntries: readNumberEnv('DNS_MAX_LOG_ENTRIES', 1000),
  rateLimit: readNumberEnv('DNS_RATE_LIMIT', 0),
  blocklist: readListEnv('DNS_BLOCKLIST'),
  upstreamPolicy: readUpstreamPolicyEnv(),
  upstreamTimeout: readNumberEnv('DNS_UPSTREAM_TIMEOUT', 5000),
};

type StorageType = 'kv' | 'redis' | 'memory';

function normalizeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('上游 DoH URL 必须使用 HTTPS');
  }

  const hostname = url.hostname.toLowerCase();
  const forbiddenHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
  if (forbiddenHosts.has(hostname) || hostname.endsWith('.local')) {
    throw new Error('上游 DoH URL 不能指向本机或本地域名');
  }

  return url.toString();
}

function normalizeUpstreamServers(servers: UpstreamDNS[]): UpstreamDNS[] {
  const seen = new Set<string>();
  return servers.map((server, index) => {
    if (!server.name?.trim() || !server.url?.trim()) {
      throw new Error('服务器配置缺少必要字段');
    }

    const normalizedUrl = normalizeUrl(server.url.trim());
    const uniqueKey = normalizedUrl.toLowerCase();
    if (seen.has(uniqueKey)) {
      throw new Error(`上游 DoH URL 重复: ${normalizedUrl}`);
    }
    seen.add(uniqueKey);

    return {
      name: server.name.trim(),
      url: normalizedUrl,
      enabled: Boolean(server.enabled),
      priority: Number.isFinite(Number(server.priority)) ? Number(server.priority) : index + 1,
    };
  });
}

function normalizeBlocklist(blocklist: string[]): string[] {
  return Array.from(new Set(
    blocklist
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  ));
}

function mergeDNSSettings(settings?: Partial<DNSServerSettings>): DNSServerSettings {
  return {
    upstreamServers: normalizeUpstreamServers(settings?.upstreamServers || DEFAULT_UPSTREAM_SERVERS),
    cacheEnabled: settings?.cacheEnabled ?? DEFAULT_DNS_SETTINGS.cacheEnabled,
    cacheTTL: Math.max(30, Number(settings?.cacheTTL || DEFAULT_DNS_SETTINGS.cacheTTL)),
    cacheMaxEntries: Math.max(100, Number(settings?.cacheMaxEntries || DEFAULT_DNS_SETTINGS.cacheMaxEntries)),
    enableLogging: settings?.enableLogging ?? DEFAULT_DNS_SETTINGS.enableLogging,
    maxLogEntries: Math.max(100, Number(settings?.maxLogEntries || DEFAULT_DNS_SETTINGS.maxLogEntries)),
    rateLimit: Math.max(0, Number(settings?.rateLimit || DEFAULT_DNS_SETTINGS.rateLimit)),
    blocklist: normalizeBlocklist(settings?.blocklist || DEFAULT_DNS_SETTINGS.blocklist),
    upstreamPolicy: settings?.upstreamPolicy === 'round-robin' ? 'round-robin' : 'priority',
    upstreamTimeout: Math.min(15000, Math.max(1000, Number(settings?.upstreamTimeout || DEFAULT_DNS_SETTINGS.upstreamTimeout))),
  };
}

class SettingsStore {
  private dnsSettings: DNSServerSettings = mergeDNSSettings({ upstreamServers: DEFAULT_UPSTREAM_SERVERS });
  private authCredentials: AuthCredentials = { ...DEFAULT_CREDENTIALS };
  private initialized = false;

  private getStorageType(): StorageType {
    if (hasKVConfig()) return 'kv';
    if (hasRedisConfig()) return 'redis';
    return 'memory';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const type = this.getStorageType();
    if (type === 'memory') {
      this.initialized = true;
      return;
    }

    try {
      if (type === 'kv') {
        const kv = await this.getKV();
        const [username, password, servers, dnsSettings] = await Promise.all([
          kv.get(STORAGE_KEYS.AUTH_USERNAME),
          kv.get(STORAGE_KEYS.AUTH_PASSWORD),
          kv.get(STORAGE_KEYS.UPSTREAM_SERVERS),
          kv.get(STORAGE_KEYS.DNS_SETTINGS),
        ]);

        if (username) this.authCredentials.username = username as string;
        if (password) this.authCredentials.password = password as string;
        this.dnsSettings = mergeDNSSettings({
          ...(dnsSettings && typeof dnsSettings === 'object' ? dnsSettings as Partial<DNSServerSettings> : {}),
          upstreamServers: Array.isArray(servers) ? servers as UpstreamDNS[] : undefined,
        });
      } else if (type === 'redis') {
        const redis = getRedis();
        const [username, password, servers, dnsSettings] = await Promise.all([
          redis.get(STORAGE_KEYS.AUTH_USERNAME),
          redis.get(STORAGE_KEYS.AUTH_PASSWORD),
          redis.get(STORAGE_KEYS.UPSTREAM_SERVERS),
          redis.get(STORAGE_KEYS.DNS_SETTINGS),
        ]);

        if (username) this.authCredentials.username = username;
        if (password) this.authCredentials.password = password;

        const parsedServers = servers ? JSON.parse(servers) as UpstreamDNS[] : undefined;
        const parsedSettings = dnsSettings ? JSON.parse(dnsSettings) as Partial<DNSServerSettings> : undefined;
        this.dnsSettings = mergeDNSSettings({
          ...parsedSettings,
          upstreamServers: parsedServers || parsedSettings?.upstreamServers,
        });
      }
    } catch (error) {
      console.error('[settings-store] Initialize error:', error);
      this.dnsSettings = mergeDNSSettings({ upstreamServers: DEFAULT_UPSTREAM_SERVERS });
    }

    this.initialized = true;
  }

  private async getKV() {
    const mod = await import('@vercel/kv');
    return mod.kv;
  }

  private async persistAuthCredentials(): Promise<void> {
    const type = this.getStorageType();
    if (type === 'memory') return;

    try {
      if (type === 'kv') {
        const kv = await this.getKV();
        await Promise.all([
          kv.set(STORAGE_KEYS.AUTH_USERNAME, this.authCredentials.username),
          kv.set(STORAGE_KEYS.AUTH_PASSWORD, this.authCredentials.password),
        ]);
      } else if (type === 'redis') {
        const redis = getRedis();
        await Promise.all([
          redis.set(STORAGE_KEYS.AUTH_USERNAME, this.authCredentials.username),
          redis.set(STORAGE_KEYS.AUTH_PASSWORD, this.authCredentials.password),
        ]);
      }
    } catch (error) {
      console.error('[settings-store] Persist auth credentials error:', error);
    }
  }

  private async persistDNSSettings(): Promise<void> {
    const type = this.getStorageType();
    if (type === 'memory') return;

    try {
      if (type === 'kv') {
        const kv = await this.getKV();
        await Promise.all([
          kv.set(STORAGE_KEYS.DNS_SETTINGS, this.dnsSettings),
          kv.set(STORAGE_KEYS.UPSTREAM_SERVERS, this.dnsSettings.upstreamServers),
        ]);
      } else if (type === 'redis') {
        const redis = getRedis();
        await Promise.all([
          redis.set(STORAGE_KEYS.DNS_SETTINGS, JSON.stringify(this.dnsSettings)),
          redis.set(STORAGE_KEYS.UPSTREAM_SERVERS, JSON.stringify(this.dnsSettings.upstreamServers)),
        ]);
      }
    } catch (error) {
      console.error('[settings-store] Persist DNS settings error:', error);
    }
  }

  getDNSSettings(): DNSServerSettings {
    return this.dnsSettings;
  }

  async setDNSSettings(settings: Partial<DNSServerSettings>): Promise<void> {
    this.dnsSettings = mergeDNSSettings({ ...this.dnsSettings, ...settings });
    await this.persistDNSSettings();
  }

  getUpstreamServers(): UpstreamDNS[] {
    return this.dnsSettings.upstreamServers
      .filter((server) => server.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  async setUpstreamServers(servers: UpstreamDNS[]): Promise<void> {
    this.dnsSettings = mergeDNSSettings({ ...this.dnsSettings, upstreamServers: servers });
    await this.persistDNSSettings();
  }

  getAllUpstreamServers(): UpstreamDNS[] {
    return this.dnsSettings.upstreamServers;
  }

  getAuthCredentials(): AuthCredentials {
    return this.authCredentials;
  }

  async setAuthCredentials(credentials: AuthCredentials): Promise<void> {
    this.authCredentials = {
      username: credentials.username.trim(),
      password: credentials.password,
    };
    await this.persistAuthCredentials();
  }

  validateCredentials(username: string, password: string): boolean {
    return username === this.authCredentials.username && password === this.authCredentials.password;
  }

  getStorageTypeName(): string {
    return this.getStorageType();
  }
}

export const settingsStore = new SettingsStore();