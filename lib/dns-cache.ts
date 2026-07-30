import { DNSCacheEntry, DNSRecordType } from './dns-types';

class DNSCache {
  private cache: Map<string, DNSCacheEntry> = new Map();
  private readonly DEFAULT_TTL = 300;
  private readonly DEFAULT_MAX_ENTRIES = 1000;

  private getCacheKey(domain: string, type: DNSRecordType): string {
    return `${domain.toLowerCase()}:${type}`;
  }

  get(domain: string, type: DNSRecordType): DNSCacheEntry | null {
    const key = this.getCacheKey(domain, type);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = (now - entry.timestamp) / 1000;

    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(domain: string, type: DNSRecordType, answers: any[], ttl?: number, maxEntries = this.DEFAULT_MAX_ENTRIES): void {
    const key = this.getCacheKey(domain, type);
    const normalizedTTL = Math.max(1, Math.floor(ttl || this.DEFAULT_TTL));
    const normalizedMaxEntries = Math.max(1, Math.floor(maxEntries));

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      domain: domain.toLowerCase(),
      type,
      answers,
      ttl: normalizedTTL,
      timestamp: Date.now(),
    });

    while (this.cache.size > normalizedMaxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).map((entry) => ({
        domain: entry.domain,
        type: entry.type,
        age: Math.floor((Date.now() - entry.timestamp) / 1000),
        ttl: entry.ttl,
      })),
    };
  }

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

export const dnsCache = new DNSCache();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    dnsCache.cleanup();
  }, 60000);
}