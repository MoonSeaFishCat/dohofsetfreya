import { UpstreamDNS } from './dns-types';
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

type StorageType = 'kv' | 'redis' | 'memory';

class SettingsStore {
  private upstreamServers: UpstreamDNS[] = [...DEFAULT_UPSTREAM_SERVERS];
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
        const [username, password, servers] = await Promise.all([
          kv.get(STORAGE_KEYS.AUTH_USERNAME),
          kv.get(STORAGE_KEYS.AUTH_PASSWORD),
          kv.get(STORAGE_KEYS.UPSTREAM_SERVERS),
        ]);

        if (username) this.authCredentials.username = username as string;
        if (password) this.authCredentials.password = password as string;
        if (servers && Array.isArray(servers)) this.upstreamServers = servers as UpstreamDNS[];
      } else if (type === 'redis') {
        const redis = getRedis();
        const [username, password, servers] = await Promise.all([
          redis.get(STORAGE_KEYS.AUTH_USERNAME),
          redis.get(STORAGE_KEYS.AUTH_PASSWORD),
          redis.get(STORAGE_KEYS.UPSTREAM_SERVERS),
        ]);

        if (username) this.authCredentials.username = username;
        if (password) this.authCredentials.password = password;
        if (servers) {
          try {
            this.upstreamServers = typeof servers === 'string' ? JSON.parse(servers) : servers;
          } catch {
            this.upstreamServers = DEFAULT_UPSTREAM_SERVERS;
          }
        }
      }
    } catch (error) {
      console.error('[settings-store] Initialize error:', error);
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

  private async persistUpstreamServers(): Promise<void> {
    const type = this.getStorageType();
    if (type === 'memory') return;

    try {
      if (type === 'kv') {
        const kv = await this.getKV();
        await kv.set(STORAGE_KEYS.UPSTREAM_SERVERS, this.upstreamServers);
      } else if (type === 'redis') {
        const redis = getRedis();
        await redis.set(STORAGE_KEYS.UPSTREAM_SERVERS, JSON.stringify(this.upstreamServers));
      }
    } catch (error) {
      console.error('[settings-store] Persist upstream servers error:', error);
    }
  }

  getUpstreamServers(): UpstreamDNS[] {
    return this.upstreamServers.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
  }

  async setUpstreamServers(servers: UpstreamDNS[]): Promise<void> {
    this.upstreamServers = servers;
    await this.persistUpstreamServers();
  }

  getAllUpstreamServers(): UpstreamDNS[] {
    return this.upstreamServers;
  }

  getAuthCredentials(): AuthCredentials {
    return this.authCredentials;
  }

  async setAuthCredentials(credentials: AuthCredentials): Promise<void> {
    this.authCredentials = credentials;
    await this.persistAuthCredentials();
  }

  validateCredentials(username: string, password: string): boolean {
    return (
      username === this.authCredentials.username &&
      password === this.authCredentials.password
    );
  }

  getStorageTypeName(): string {
    return this.getStorageType();
  }
}

export const settingsStore = new SettingsStore();
