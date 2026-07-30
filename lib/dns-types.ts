export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'PTR' | 'SRV' | 'CAA';

export type DNSQueryStatus = 'success' | 'error' | 'timeout' | 'blocked';

export type UpstreamPolicy = 'priority' | 'round-robin';

export interface DNSQueryLog {
  id: string;
  timestamp: number;
  domain: string;
  type: DNSRecordType;
  clientIp: string;
  responseTime: number;
  status: DNSQueryStatus;
  cached: boolean;
  upstream?: string;
  answers?: string[];
}

export interface DNSStats {
  totalQueries: number;
  cacheHitRate: number;
  averageResponseTime: number;
  queriesPerMinute: number;
  upstreamServers: {
    name: string;
    queries: number;
    avgResponseTime: number;
  }[];
  queryTypeDistribution: Record<DNSRecordType, number>;
  recentQueries: DNSQueryLog[];
}

export interface DNSCacheEntry {
  domain: string;
  type: DNSRecordType;
  answers: any[];
  ttl: number;
  timestamp: number;
}

export interface UpstreamDNS {
  name: string;
  url: string;
  enabled: boolean;
  priority: number;
}

export interface DNSServerSettings {
  upstreamServers: UpstreamDNS[];
  cacheEnabled: boolean;
  cacheTTL: number;
  cacheMaxEntries: number;
  enableLogging: boolean;
  maxLogEntries: number;
  rateLimit: number;
  blocklist: string[];
  upstreamPolicy: UpstreamPolicy;
  upstreamTimeout: number;
}

export interface DNSQueryResult {
  success: boolean;
  domain: string;
  type: DNSRecordType;
  answers: any[];
  responseTime: number;
  cached: boolean;
  upstream?: string;
  error?: string;
  blocked?: boolean;
}

export interface DNSLogFilter {
  q?: string;
  type?: DNSRecordType | 'all';
  status?: DNSQueryStatus | 'all';
  cached?: boolean;
}