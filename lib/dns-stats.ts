import { DNSQueryLog, DNSStats, DNSRecordType } from './dns-types';

class DNSStatsManager {
  private logs: DNSQueryLog[] = [];
  private readonly MAX_LOGS = 1000;
  private totalQueries = 0;
  private cacheHits = 0;
  private totalResponseTime = 0;
  private queryTypeCount: Record<string, number> = {};
  private upstreamCount: Record<string, { queries: number; totalTime: number }> = {};
  private startTime = Date.now();

  // 记录查询
  logQuery(log: DNSQueryLog): void {
    this.logs.unshift(log);
    
    // 限制日志数量
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // 更新统计
    this.totalQueries++;
    if (log.cached) {
      this.cacheHits++;
    }
    if (log.status === 'success') {
      this.totalResponseTime += log.responseTime;
    }

    // 更新查询类型统计
    this.queryTypeCount[log.type] = (this.queryTypeCount[log.type] || 0) + 1;

    // 更新上游服务器统计
    if (log.upstream) {
      if (!this.upstreamCount[log.upstream]) {
        this.upstreamCount[log.upstream] = { queries: 0, totalTime: 0 };
      }
      this.upstreamCount[log.upstream].queries++;
      this.upstreamCount[log.upstream].totalTime += log.responseTime;
    }
  }

  // 获取统计数据
  getStats(): DNSStats {
    const successfulQueries = this.logs.filter(log => log.status === 'success').length;
    const avgResponseTime = successfulQueries > 0 
      ? this.totalResponseTime / successfulQueries 
      : 0;

    const uptimeMinutes = (Date.now() - this.startTime) / 1000 / 60;
    const queriesPerMinute = uptimeMinutes > 0 ? this.totalQueries / uptimeMinutes : 0;

    const upstreamServers = Object.entries(this.upstreamCount).map(([name, data]) => ({
      name,
      queries: data.queries,
      avgResponseTime: data.queries > 0 ? data.totalTime / data.queries : 0,
    }));

    return {
      totalQueries: this.totalQueries,
      cacheHitRate: this.totalQueries > 0 ? (this.cacheHits / this.totalQueries) * 100 : 0,
      averageResponseTime: avgResponseTime,
      queriesPerMinute,
      upstreamServers,
      queryTypeDistribution: this.queryTypeCount as Record<DNSRecordType, number>,
      recentQueries: this.logs.slice(0, 50),
    };
  }

  // 获取日志
  getLogs(limit = 100, offset = 0): DNSQueryLog[] {
    return this.logs.slice(offset, offset + limit);
  }

  // 获取运行时间
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  // 清除统计
  clear(): void {
    this.logs = [];
    this.totalQueries = 0;
    this.cacheHits = 0;
    this.totalResponseTime = 0;
    this.queryTypeCount = {};
    this.upstreamCount = {};
    this.startTime = Date.now();
  }
}

// 全局单例
export const dnsStats = new DNSStatsManager();
