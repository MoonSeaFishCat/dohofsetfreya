import dnsPacket from 'dns-packet';
import { DNSRecordType, DNSQueryLog, DNSQueryResult, DNSServerSettings, UpstreamDNS } from './dns-types';
import { dnsCache } from './dns-cache';
import { settingsStore } from './settings-store';
import { dnsStats } from './dns-stats';

const DNS_MESSAGE_MAX_BYTES = 4096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FAKE_IP_TTL = 60;
// 浏览器 DoH 探针域名喵~ 任何模式下都必须放行，否则 Chrome/Edge 会判定提供商无效 (´；ω；`)
// Chromium 源码：kDohProbeHostname = "www.gstatic.com"
const BROWSER_PROBE_HOSTS = new Set(['www.gstatic.com']);
const SUPPORTED_RECORD_TYPES = new Set<DNSRecordType>([
  'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'PTR', 'SRV', 'CAA', 'HTTPS', 'SVCB',
]);

type ForwardResult = {
  upstream: UpstreamDNS;
  buffer: Buffer;
};

type ResolveQueryOptions = {
  useCache?: boolean;
  clientIp?: string;
  log?: boolean;
};

type RateLimitBucket = {
  windowStart: number;
  count: number;
};

function toDNSRecordType(value: unknown): DNSRecordType {
  const normalized = String(value || 'A').toUpperCase() as DNSRecordType;
  return SUPPORTED_RECORD_TYPES.has(normalized) ? normalized : 'A';
}

function sanitizeClientIp(request: Request): string {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (clientIp === 'unknown') return clientIp;
  return clientIp.split(',')[0].trim().split('.').slice(0, 3).join('.') + '.***';
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/\.$/, '').toLowerCase();
}

function answerToString(answer: any): string {
  if (answer.type === 'A' || answer.type === 'AAAA' || answer.type === 'CNAME' || answer.type === 'NS') return String(answer.data);
  if (answer.type === 'MX') return `${answer.priority} ${answer.exchange}`;
  if (answer.type === 'TXT') return Array.isArray(answer.data) ? answer.data.join(' ') : String(answer.data);
  return JSON.stringify(answer.data);
}

function getAnswerTTL(answers: any[], fallbackTTL: number): number {
  const ttls = answers
    .map((answer) => Number(answer.ttl))
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0);

  return ttls.length > 0 ? Math.min(...ttls, fallbackTTL) : fallbackTTL;
}

function createDNSQuery(domain: string, recordType: DNSRecordType): Buffer {
  return Buffer.from(dnsPacket.encode({
    type: 'query',
    id: Math.floor(Math.random() * 65535),
    flags: dnsPacket.RECURSION_DESIRED,
    questions: [{ type: recordType, name: domain }],
  } as any));
}

function createRefusedResponse(packet: any, question: any): Buffer {
  return Buffer.from(dnsPacket.encode({
    type: 'response',
    id: packet.id,
    flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE | 5,
    questions: [question],
    answers: [],
  } as any));
}

function createCachedResponse(packet: any, question: any, answers: any[]): Buffer {
  return Buffer.from(dnsPacket.encode({
    type: 'response',
    id: packet.id,
    flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE,
    questions: [question],
    answers,
  } as any));
}

// SNI 阻断代答喵~ A 查询回虚拟 IP 给本地代理嗅探接管；AAAA 回空让客户端走 IPv4 (๑•̀ㅂ•́)و✧
function createFakeIpResponse(packet: any, question: any, fakeIp: string, isAAAA: boolean): Buffer {
  const answers = isAAAA ? [] : [{
    type: 'A',
    name: question.name,
    ttl: FAKE_IP_TTL,
    data: fakeIp,
  }];
  return Buffer.from(dnsPacket.encode({
    type: 'response',
    id: packet.id,
    flags: dnsPacket.RECURSION_DESIRED | dnsPacket.RECURSION_AVAILABLE,
    questions: [question],
    answers,
  } as any));
}

export class DoHService {
  private roundRobinCursor = 0;
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();

  private async getSettings() {
    await settingsStore.initialize();
    return settingsStore.getDNSSettings();
  }

  // 域名规则匹配喵~ 支持精确域名、.后缀 和 *.通配 三种写法 (ฅ'ω'ฅ)
  private matchesDomainRule(domain: string, rules: string[]): boolean {
    const normalized = normalizeDomain(domain);
    return rules.some((rule) => {
      const normalizedRule = normalizeDomain(rule);
      if (!normalizedRule) return false;
      if (normalizedRule.startsWith('*.')) {
        const suffix = normalizedRule.slice(2);
        return normalized === suffix || normalized.endsWith(`.${suffix}`);
      }
      if (normalizedRule.startsWith('.')) {
        const suffix = normalizedRule.slice(1);
        return normalized === suffix || normalized.endsWith(`.${suffix}`);
      }
      if (normalizedRule.includes('*')) {
        const pattern = normalizedRule
          .split('*')
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*');
        return new RegExp(`^${pattern}$`).test(normalized);
      }
      return normalized === normalizedRule;
    });
  }

  // 过滤判定喵~ 白名单=只放行命中的小可爱，黑名单=命中的统统拦下 (◕‿◕)
  // 拒绝时返回 REFUSED，浏览器会自动回退到系统 DNS，不影响其他网页加载~
  private shouldRefuse(domain: string, settings: DNSServerSettings): boolean {
    if (settings.filterMode === 'off') return false;
    if (BROWSER_PROBE_HOSTS.has(domain)) return false;
    const matched = this.matchesDomainRule(domain, settings.blocklist);
    return settings.filterMode === 'whitelist' ? !matched : matched;
  }

  private checkRateLimit(clientIp: string, limit: number): boolean {
    if (limit <= 0 || clientIp === 'unknown') return true;

    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(clientIp);
    if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
      this.rateLimitBuckets.set(clientIp, { windowStart: now, count: 1 });
      return true;
    }

    bucket.count += 1;
    return bucket.count <= limit;
  }

  private selectUpstreams(servers: UpstreamDNS[], policy: 'priority' | 'round-robin'): UpstreamDNS[] {
    const sorted = [...servers].sort((a, b) => a.priority - b.priority);
    if (policy !== 'round-robin' || sorted.length <= 1) {
      return sorted;
    }

    const start = this.roundRobinCursor % sorted.length;
    this.roundRobinCursor = (this.roundRobinCursor + 1) % sorted.length;
    return [...sorted.slice(start), ...sorted.slice(0, start)];
  }

  private async forwardToUpstream(query: Buffer, upstreams: UpstreamDNS[], timeout: number): Promise<ForwardResult> {
    let lastError: unknown;

    for (const upstream of upstreams) {
      try {
        const response = await fetch(upstream.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/dns-message',
            'Accept': 'application/dns-message',
          },
          body: query,
          signal: AbortSignal.timeout(timeout),
        });

        if (!response.ok) {
          throw new Error(`上游DNS服务器返回错误: ${response.status}`);
        }

        return {
          upstream,
          buffer: Buffer.from(await response.arrayBuffer()),
        };
      } catch (error) {
        lastError = error;
        console.error(`[doh-service] Upstream failed: ${upstream.name}`, error);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('所有上游DNS服务器均不可用');
  }

  private logQuery(settings: DNSServerSettings, log: Omit<DNSQueryLog, 'id' | 'timestamp'>): void {
    if (!settings.enableLogging) return;

    dnsStats.logQuery({
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
    });
  }

  private async resolveQuery(domain: string, type: DNSRecordType = 'A', options: ResolveQueryOptions = {}): Promise<DNSQueryResult> {
    const startTime = Date.now();
    const normalizedDomain = normalizeDomain(domain);
    const recordType = toDNSRecordType(type);
    const useCache = options.useCache ?? true;
    const clientIp = options.clientIp || 'unknown';

    try {
      const settings = await this.getSettings();

      if (!normalizedDomain) {
        throw new Error('域名不能为空');
      }

      if (this.shouldRefuse(normalizedDomain, settings)) {
        const result: DNSQueryResult = {
          success: false,
          domain: normalizedDomain,
          type: recordType,
          answers: [],
          responseTime: Date.now() - startTime,
          cached: false,
          blocked: true,
          error: '域名已被过滤规则拦截',
        };

        if (options.log) {
          this.logQuery(settings, {
            domain: normalizedDomain,
            type: recordType,
            clientIp,
            responseTime: result.responseTime,
            status: 'blocked',
            cached: false,
          });
        }

        return result;
      }

      // SNI 阻断代答喵~ 命中规则的域名直接回虚拟 IP，让本地代理嗅探 SNI 接管 (๑>◡<๑)
      if (settings.fakeIpRules.length > 0
        && (recordType === 'A' || recordType === 'AAAA')
        && this.matchesDomainRule(normalizedDomain, settings.fakeIpRules)) {
        const fakeAnswers = recordType === 'A'
          ? [{ type: 'A', name: normalizedDomain, ttl: FAKE_IP_TTL, data: settings.fakeIpAddress }]
          : [];
        const result: DNSQueryResult = {
          success: true,
          domain: normalizedDomain,
          type: recordType,
          answers: fakeAnswers,
          responseTime: Date.now() - startTime,
          cached: false,
          fakeip: true,
        };

        if (options.log) {
          this.logQuery(settings, {
            domain: normalizedDomain,
            type: recordType,
            clientIp,
            responseTime: result.responseTime,
            status: 'fakeip',
            cached: false,
            answers: fakeAnswers.map((answer) => String(answer.data)),
          });
        }

        return result;
      }

      if (settings.cacheEnabled && useCache) {
        const cached = dnsCache.get(normalizedDomain, recordType);
        if (cached) {
          const result: DNSQueryResult = {
            success: true,
            domain: normalizedDomain,
            type: recordType,
            answers: cached.answers,
            responseTime: Date.now() - startTime,
            cached: true,
          };

          if (options.log) {
            this.logQuery(settings, {
              domain: normalizedDomain,
              type: recordType,
              clientIp,
              responseTime: result.responseTime,
              status: 'success',
              cached: true,
              answers: cached.answers.map(answerToString),
            });
          }

          return result;
        }
      }

      const upstreams = this.selectUpstreams(settings.upstreamServers.filter((server) => server.enabled), settings.upstreamPolicy);
      if (upstreams.length === 0) {
        throw new Error('没有可用的上游DNS服务器');
      }

      const { upstream, buffer } = await this.forwardToUpstream(createDNSQuery(normalizedDomain, recordType), upstreams, settings.upstreamTimeout);
      const packet = dnsPacket.decode(buffer) as any;
      const answers = packet.answers || [];
      const responseTime = Date.now() - startTime;

      if (settings.cacheEnabled && answers.length > 0) {
        const ttl = getAnswerTTL(answers, settings.cacheTTL);
        dnsCache.set(normalizedDomain, recordType, answers, ttl, settings.cacheMaxEntries);
      }

      const result: DNSQueryResult = {
        success: true,
        domain: normalizedDomain,
        type: recordType,
        answers,
        responseTime,
        cached: false,
        upstream: upstream.name,
      };

      if (options.log) {
        this.logQuery(settings, {
          domain: normalizedDomain,
          type: recordType,
          clientIp,
          responseTime,
          status: 'success',
          cached: false,
          upstream: upstream.name,
          answers: answers.map(answerToString),
        });
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
      console.error('[doh-service] DNS query error:', error);

      const settings = await this.getSettings();
      if (options.log) {
        this.logQuery(settings, {
          domain: normalizedDomain || 'unknown',
          type: recordType,
          clientIp,
          responseTime,
          status: isTimeout ? 'timeout' : 'error',
          cached: false,
        });
      }

      return {
        success: false,
        domain: normalizedDomain,
        type: recordType,
        answers: [],
        responseTime,
        cached: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  async query(domain: string, type: DNSRecordType = 'A', useCache = true, clientIp = 'unknown'): Promise<DNSQueryResult> {
    return this.resolveQuery(domain, type, { useCache, clientIp, log: true });
  }

  async handleDoHRequest(request: Request): Promise<Response> {
    const startTime = Date.now();
    let domain = 'unknown';
    let recordType: DNSRecordType = 'A';

    try {
      const settings = await this.getSettings();
      const clientIp = sanitizeClientIp(request);

      if (!this.checkRateLimit(clientIp, settings.rateLimit)) {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'error',
          cached: false,
        });
        return new Response('请求过于频繁', { status: 429 });
      }

      const dnsQuery = await this.parseRequestBody(request);
      const packet = dnsPacket.decode(dnsQuery) as any;
      const question = packet.questions?.[0];
      if (!question) {
        return new Response('无效的DNS查询', { status: 400 });
      }

      domain = normalizeDomain(question.name);
      // 记录原始类型喵~ 未知类型照样转发上游，只是不进缓存防止串味 (ฅ'ω'ฅ)
      const rawType = String(question.type || 'A').toUpperCase();
      const isKnownType = SUPPORTED_RECORD_TYPES.has(rawType as DNSRecordType);
      recordType = toDNSRecordType(rawType);

      if (this.shouldRefuse(domain, settings)) {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'blocked',
          cached: false,
        });

        return new Response(createRefusedResponse(packet, question), {
          status: 200,
          headers: {
            'Content-Type': 'application/dns-message',
            'Cache-Control': 'no-store',
          },
        });
      }

      // SNI 阻断代答：命中规则的 A/AAAA 查询返回虚拟 IP，交给本地代理嗅探接管
      if (settings.fakeIpRules.length > 0
        && (rawType === 'A' || rawType === 'AAAA')
        && this.matchesDomainRule(domain, settings.fakeIpRules)) {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'fakeip',
          cached: false,
          answers: rawType === 'A' ? [settings.fakeIpAddress] : [],
        });

        return new Response(createFakeIpResponse(packet, question, settings.fakeIpAddress, rawType === 'AAAA'), {
          status: 200,
          headers: {
            'Content-Type': 'application/dns-message',
            'Cache-Control': 'no-store',
          },
        });
      }

      const cached = settings.cacheEnabled && isKnownType ? dnsCache.get(domain, recordType) : null;
      if (cached) {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'success',
          cached: true,
          answers: cached.answers.map(answerToString),
        });

        return new Response(createCachedResponse(packet, question, cached.answers), {
          status: 200,
          headers: {
            'Content-Type': 'application/dns-message',
            'Cache-Control': `max-age=${cached.ttl}`,
          },
        });
      }

      const upstreams = this.selectUpstreams(settings.upstreamServers.filter((server) => server.enabled), settings.upstreamPolicy);
      if (upstreams.length === 0) {
        return new Response('没有可用的上游DNS服务器', { status: 503 });
      }

      const { upstream, buffer } = await this.forwardToUpstream(dnsQuery, upstreams, settings.upstreamTimeout);
      const responsePacket = dnsPacket.decode(buffer) as any;
      const answers = responsePacket.answers || [];
      const responseTime = Date.now() - startTime;

      if (settings.cacheEnabled && isKnownType && answers.length > 0) {
        const ttl = getAnswerTTL(answers, settings.cacheTTL);
        dnsCache.set(domain, recordType, answers, ttl, settings.cacheMaxEntries);
      }

      this.logQuery(settings, {
        domain,
        type: recordType,
        clientIp,
        responseTime,
        status: 'success',
        cached: false,
        upstream: upstream.name,
        answers: answers.map(answerToString),
      });

      return new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/dns-message',
          'Cache-Control': `max-age=${getAnswerTTL(answers, settings.cacheTTL)}`,
        },
      });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      console.error('[doh-service] DoH request error:', error);
      const settings = await this.getSettings();
      this.logQuery(settings, {
        domain,
        type: recordType,
        clientIp: sanitizeClientIp(request),
        responseTime: Date.now() - startTime,
        status: error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'error',
        cached: false,
      });
      return new Response('DNS查询失败', { status: 500 });
    }
  }

  private async parseRequestBody(request: Request): Promise<Buffer> {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const dnsParam = url.searchParams.get('dns');

      if (!dnsParam) {
        throw new Response('缺少dns参数', { status: 400 });
      }
      if (dnsParam.length > DNS_MESSAGE_MAX_BYTES * 2) {
        throw new Response('DNS查询过大', { status: 413 });
      }
      if (!/^[A-Za-z0-9_-]+$/.test(dnsParam)) {
        throw new Response('dns参数格式无效', { status: 400 });
      }

      const base64 = dnsParam.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
      const buffer = Buffer.from(padded, 'base64');
      if (buffer.byteLength > DNS_MESSAGE_MAX_BYTES) {
        throw new Response('DNS查询过大', { status: 413 });
      }
      return buffer;
    }

    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type');
      if (!contentType || !contentType.includes('application/dns-message')) {
        throw new Response('Content-Type必须是application/dns-message', { status: 400 });
      }

      const arrayBuffer = await request.arrayBuffer();
      if (arrayBuffer.byteLength > DNS_MESSAGE_MAX_BYTES) {
        throw new Response('DNS查询过大', { status: 413 });
      }
      return Buffer.from(arrayBuffer);
    }

    throw new Response('只支持GET和POST方法', { status: 405 });
  }
}

export const dohService = new DoHService();