// DNS记录类型
export type DNSRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'PTR' | 'SRV' | 'CAA';

// DNS查询日志
export interface DNSQueryLog {
  id: string;
  timestamp: number;
  domain: string;
  type: DNSRecordType;
  clientIp: string;
  responseTime: number;
  status: 'success' | 'error' | 'timeout';
  cached: boolean;
  upstream?: string;
  answers?: string[];
}

// DNS统计数据
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

// DNS缓存条目
export interface DNSCacheEntry {
  domain: string;
  type: DNSRecordType;
  answers: any[];
  ttl: number;
  timestamp: number;
}

// 上游DNS服务器配置
export interface UpstreamDNS {
  name: string;
  url: string;
  enabled: boolean;
  priority: number;
}

// DNS服务器设置
export interface DNSServerSettings {
  upstreamServers: UpstreamDNS[];
  cacheEnabled: boolean;
  cacheTTL: number;
  enableLogging: boolean;
  maxLogEntries: number;
  rateLimit: number;
  blocklist: string[];
}

// DNS查询结果
export interface DNSQueryResult {
  success: boolean;
  domain: string;
  type: DNSRecordType;
  answers: any[];
  responseTime: number;
  cached: boolean;
  upstream?: string;
  error?: string;
}
