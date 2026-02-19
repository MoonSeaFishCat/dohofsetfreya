import { DNSQueryLog, DNSStats, DNSRecordType } from './dns-types';

// 检测是否有 Vercel KV 环境变量
function hasKVConfig(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ─── 内存回退实现（本地开发 / 无 KV 时使用）─────────────────────────────────
class MemoryStatsManager {
  private logs: DNSQueryLog[] = [];
  private readonly MAX_LOGS = 1000;
  private totalQueries = 0;
  private cacheHits = 0;
  private totalResponseTime = 0;
  private successCount = 0;
  private queryTypeCount: Record<string, number> = {};
  private upstreamCount: Record<string, { queries: number; totalTime: number }> = {};
  private startTime = Date.now();

  logQuery(log: DNSQueryLog): void {
    this.logs.unshift(log);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }
    this.totalQueries++;
    if (log.cached) this.cacheHits++;
    if (log.status === 'success') {
      this.totalResponseTime += log.responseTime;
      this.successCount++;
    }
    this.queryTypeCount[log.type] = (this.queryTypeCount[log.type] || 0) + 1;
    if (log.upstream) {
      if (!this.upstreamCount[log.upstream]) {
        this.upstreamCount[log.upstream] = { queries: 0, totalTime: 0 };
      }
      this.upstreamCount[log.upstream].queries++;
      this.upstreamCount[log.upstream].totalTime += log.responseTime;
    }
  }

  getStats(): DNSStats {
    const avgResponseTime = this.successCount > 0
      ? this.totalResponseTime / this.successCount
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

  getLogs(limit = 100, offset = 0): DNSQueryLog[] {
    return this.logs.slice(offset, offset + limit);
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  clear(): void {
    this.logs = [];
    this.totalQueries = 0;
    this.cacheHits = 0;
    this.totalResponseTime = 0;
    this.successCount = 0;
    this.queryTypeCount = {};
    this.upstreamCount = {};
    this.startTime = Date.now();
  }
}

// ─── Vercel KV 实现 ──────────────────────────────────────────────────────────
const KV_KEYS = {
  LOGS: 'dns:logs',
  TOTAL_QUERIES: 'dns:total_queries',
  CACHE_HITS: 'dns:cache_hits',
  TOTAL_RESPONSE_TIME: 'dns:total_response_time',
  SUCCESS_COUNT: 'dns:success_count',
  START_TIME: 'dns:start_time',
  UPSTREAM_PREFIX: 'dns:upstream:',
  TYPE_PREFIX: 'dns:type:',
} as const;

const MAX_LOGS = 1000;

class KVStatsManager {
  private kv: any = null;

  private async getKV() {
    if (!this.kv) {
      const mod = await import('@vercel/kv');
      this.kv = mod.kv;
    }
    return this.kv;
  }

  async logQuery(log: DNSQueryLog): Promise<void> {
    try {
      const kv = await this.getKV();
      const pipeline = kv.pipeline();

      // 写入日志列表（头部插入，保留最近 MAX_LOGS 条）
      pipeline.lpush(KV_KEYS.LOGS, JSON.stringify(log));
      pipeline.ltrim(KV_KEYS.LOGS, 0, MAX_LOGS - 1);

      // 更新计数器
      pipeline.incr(KV_KEYS.TOTAL_QUERIES);
      if (log.cached) pipeline.incr(KV_KEYS.CACHE_HITS);
      if (log.status === 'success') {
        pipeline.incrbyfloat(KV_KEYS.TOTAL_RESPONSE_TIME, log.responseTime);
        pipeline.incr(KV_KEYS.SUCCESS_COUNT);
      }

      // 更新查询类型分布
      pipeline.incr(`${KV_KEYS.TYPE_PREFIX}${log.type}`);

      // 更新上游服务器统计
      if (log.upstream) {
        const upstreamKey = `${KV_KEYS.UPSTREAM_PREFIX}${log.upstream}`;
        pipeline.hincrby(upstreamKey, 'queries', 1);
        pipeline.hincrbyfloat(upstreamKey, 'totalTime', log.responseTime);
      }

      // 初始化启动时间（只在第一次写入时设置）
      pipeline.setnx(KV_KEYS.START_TIME, Date.now().toString());

      await pipeline.exec();
    } catch (error) {
      console.error('[dns-stats] KV logQuery error:', error);
    }
  }

  async getStats(): Promise<DNSStats> {
    try {
      const kv = await this.getKV();

      // 并行读取所有计数器
      const [
        totalQueriesRaw,
        cacheHitsRaw,
        totalResponseTimeRaw,
        successCountRaw,
        startTimeRaw,
        recentLogsRaw,
      ] = await Promise.all([
        kv.get(KV_KEYS.TOTAL_QUERIES),
        kv.get(KV_KEYS.CACHE_HITS),
        kv.get(KV_KEYS.TOTAL_RESPONSE_TIME),
        kv.get(KV_KEYS.SUCCESS_COUNT),
        kv.get(KV_KEYS.START_TIME),
        kv.lrange(KV_KEYS.LOGS, 0, 49),
      ]);

      const totalQueries = Number(totalQueriesRaw) || 0;
      const cacheHits = Number(cacheHitsRaw) || 0;
      const totalResponseTime = Number(totalResponseTimeRaw) || 0;
      const successCount = Number(successCountRaw) || 0;
      const startTime = Number(startTimeRaw) || Date.now();

      const avgResponseTime = successCount > 0 ? totalResponseTime / successCount : 0;
      const uptimeMinutes = (Date.now() - startTime) / 1000 / 60;
      const queriesPerMinute = uptimeMinutes > 0 ? totalQueries / uptimeMinutes : 0;

      // 读取上游服务器统计（扫描所有 dns:upstream:* 键）
      const upstreamKeys = await kv.keys(`${KV_KEYS.UPSTREAM_PREFIX}*`);
      const upstreamServers = await Promise.all(
        (upstreamKeys as string[]).map(async (key: string) => {
          const data = await kv.hgetall(key);
          const name = key.replace(KV_KEYS.UPSTREAM_PREFIX, '');
          return {
            name,
            queries: Number(data?.queries) || 0,
            avgResponseTime: data?.queries
              ? Number(data.totalTime) / Number(data.queries)
              : 0,
          };
        })
      );

      // 读取查询类型分布（扫描所有 dns:type:* 键）
      const typeKeys = await kv.keys(`${KV_KEYS.TYPE_PREFIX}*`);
      const typeEntries = await Promise.all(
        (typeKeys as string[]).map(async (key: string) => {
          const count = await kv.get(key);
          const type = key.replace(KV_KEYS.TYPE_PREFIX, '') as DNSRecordType;
          return [type, Number(count) || 0] as const;
        })
      );
      const queryTypeDistribution = Object.fromEntries(typeEntries) as Record<DNSRecordType, number>;

      // 解析日志
      const recentQueries: DNSQueryLog[] = (recentLogsRaw as string[]).map((raw) => {
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return null;
        }
      }).filter(Boolean);

      return {
        totalQueries,
        cacheHitRate: totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0,
        averageResponseTime: avgResponseTime,
        queriesPerMinute,
        upstreamServers,
        queryTypeDistribution,
        recentQueries,
      };
    } catch (error) {
      console.error('[dns-stats] KV getStats error:', error);
      return {
        totalQueries: 0,
        cacheHitRate: 0,
        averageResponseTime: 0,
        queriesPerMinute: 0,
        upstreamServers: [],
        queryTypeDistribution: {} as Record<DNSRecordType, number>,
        recentQueries: [],
      };
    }
  }

  async getLogs(limit = 100, offset = 0): Promise<DNSQueryLog[]> {
    try {
      const kv = await this.getKV();
      const raw = await kv.lrange(KV_KEYS.LOGS, offset, offset + limit - 1);
      return (raw as string[]).map((item) => {
        try {
          return typeof item === 'string' ? JSON.parse(item) : item;
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      console.error('[dns-stats] KV getLogs error:', error);
      return [];
    }
  }

  async getUptime(): Promise<number> {
    try {
      const kv = await this.getKV();
      const startTime = await kv.get(KV_KEYS.START_TIME);
      return startTime ? Date.now() - Number(startTime) : 0;
    } catch {
      return 0;
    }
  }

  async clear(): Promise<void> {
    try {
      const kv = await this.getKV();
      const keys = await kv.keys('dns:*');
      if (keys.length > 0) {
        await kv.del(...keys);
      }
    } catch (error) {
      console.error('[dns-stats] KV clear error:', error);
    }
  }
}

// ─── 统一接口代理（自动选择 KV 或内存）────────────────────────────────────────
class DNSStatsProxy {
  private memory = new MemoryStatsManager();
  private kvManager = new KVStatsManager();

  private useKV(): boolean {
    return hasKVConfig();
  }

  logQuery(log: DNSQueryLog): void {
    if (this.useKV()) {
      // 异步写 KV，不阻塞请求
      this.kvManager.logQuery(log).catch((e) =>
        console.error('[dns-stats] async logQuery failed:', e)
      );
    } else {
      this.memory.logQuery(log);
    }
  }

  async getStats(): Promise<DNSStats> {
    if (this.useKV()) {
      return this.kvManager.getStats();
    }
    return this.memory.getStats();
  }

  async getLogs(limit = 100, offset = 0): Promise<DNSQueryLog[]> {
    if (this.useKV()) {
      return this.kvManager.getLogs(limit, offset);
    }
    return this.memory.getLogs(limit, offset);
  }

  async getUptime(): Promise<number> {
    if (this.useKV()) {
      return this.kvManager.getUptime();
    }
    return this.memory.getUptime();
  }

  async clear(): Promise<void> {
    if (this.useKV()) {
      return this.kvManager.clear();
    }
    this.memory.clear();
  }
}

// 全局单例
export const dnsStats = new DNSStatsProxy();
