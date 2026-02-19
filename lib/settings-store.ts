import { UpstreamDNS } from './dns-types';

// 全局设置存储（内存存储，生产环境应使用数据库或Redis）
class SettingsStore {
  private upstreamServers: UpstreamDNS[] = [
    { name: 'Cloudflare DNS', url: 'https://1.1.1.1/dns-query', priority: 1, enabled: true },
    { name: 'Google DNS', url: 'https://8.8.8.8/dns-query', priority: 2, enabled: true },
    { name: 'Quad9 DNS', url: 'https://9.9.9.9/dns-query', priority: 3, enabled: true },
  ];

  getUpstreamServers(): UpstreamDNS[] {
    return this.upstreamServers.filter(s => s.enabled).sort((a, b) => a.priority - b.priority);
  }

  setUpstreamServers(servers: UpstreamDNS[]): void {
    this.upstreamServers = servers;
  }

  getAllUpstreamServers(): UpstreamDNS[] {
    return this.upstreamServers;
  }
}

export const settingsStore = new SettingsStore();
