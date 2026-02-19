import { DNSCacheEntry, DNSRecordType } from './dns-types';

class DNSCache {
  private cache: Map<string, DNSCacheEntry> = new Map();
  private readonly DEFAULT_TTL = 300; // 5分钟

  // 生成缓存键
  private getCacheKey(domain: string, type: DNSRecordType): string {
    return `${domain.toLowerCase()}:${type}`;
  }

  // 获取缓存
  get(domain: string, type: DNSRecordType): DNSCacheEntry | null {
    const key = this.getCacheKey(domain, type);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // 秒

    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  // 设置缓存
  set(domain: string, type: DNSRecordType, answers: any[], ttl?: number): void {
    const key = this.getCacheKey(domain, type);
    const entry: DNSCacheEntry = {
      domain: domain.toLowerCase(),
      type,
      answers,
      ttl: ttl || this.DEFAULT_TTL,
      timestamp: Date.now(),
    };

    this.cache.set(key, entry);
  }

  // 清除缓存
  clear(): void {
    this.cache.clear();
  }

  // 获取缓存统计
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).map(entry => ({
        domain: entry.domain,
        type: entry.type,
        age: Math.floor((Date.now() - entry.timestamp) / 1000),
        ttl: entry.ttl,
      })),
    };
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = (now - entry.timestamp) / 1000;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// 全局单例
export const dnsCache = new DNSCache();

// 定期清理过期缓存（每分钟）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    dnsCache.cleanup();
  }, 60000);
}
