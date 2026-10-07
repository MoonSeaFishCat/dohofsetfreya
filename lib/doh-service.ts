import dnsPacket from 'dns-packet';
import dns from 'node:dns';
import { createSocket } from 'dgram';
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

// dns-packet 不认识 HTTPS/SVCB 喵~ 编码时要写成 UNKNOWN_65/64 才能得到正确 qtype (´･ω･`)
const ENCODE_TYPE_ALIASES: Partial<Record<DNSRecordType, string>> = {
  HTTPS: 'UNKNOWN_65',
  SVCB: 'UNKNOWN_64',
};

// 反过来喵~ 上游回来的 HTTPS/SVCB 会被解码成 UNKNOWN_65/64，日志统计要换回语义名 (◕‿◕)
const DECODE_TYPE_ALIASES: Record<string, DNSRecordType> = {
  UNKNOWN_65: 'HTTPS',
  UNKNOWN_64: 'SVCB',
};

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
  if (Buffer.isBuffer(answer.data)) return answer.data.toString('hex');
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
    questions: [{ type: ENCODE_TYPE_ALIASES[recordType] ?? recordType, name: domain }],
    // 带上 EDNS 喵~ 不然 UDP 直连收到大于 512 字节的应答（比如带 ECH 的 HTTPS 记录）会被截断 (´･ω･`)
    additionals: [{ type: 'OPT', name: '.', udpPayloadSize: 4096, flags: 0, options: [] }],
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

// SNI 阻断代答喵~ A 查询回虚拟 IP 给本地代理嗅探接管；AAAA/HTTPS/SVCB 回空
// —— 重点是把 ECH 也掐掉喵！不然浏览器连 fake-ip 时外层 SNI 是公共名，代理就嗅探不到真实域名了 (´；ω；`)
function createFakeIpResponse(packet: any, question: any, fakeIp: string, empty: boolean): Buffer {
  const answers = empty ? [] : [{
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

// 解析 UDP 直连目标喵~ 兼容 "1.1.1.1"、"1.1.1.1:5353"、"[::1]:53"、"::1"、"udp://1.1.1.1" (ฅ'ω'ฅ)
function parseUdpTarget(target: string): { host: string; port: number } {
  const raw = target.replace(/^udp:\/\//, '');
  const bracketed = raw.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketed) return { host: bracketed[1], port: Number(bracketed[2]) || 53 };
  const lastColon = raw.lastIndexOf(':');
  if (lastColon > 0 && raw.indexOf(':') === lastColon) {
    return { host: raw.slice(0, lastColon), port: Number(raw.slice(lastColon + 1)) || 53 };
  }
  return { host: raw, port: 53 };
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

  // 过滤处置判定喵~ refuse=回REFUSED拦截 direct=分流到直连解析器 normal=正常走DoH上游 (◕‿◕)
  private getFilterDisposition(domain: string, settings: DNSServerSettings): 'refuse' | 'direct' | 'normal' {
    if (settings.filterMode === 'off') return 'normal';
    if (BROWSER_PROBE_HOSTS.has(domain)) return 'normal';
    const matched = this.matchesDomainRule(domain, settings.blocklist);
    const isFiltered = settings.filterMode === 'whitelist' ? !matched : matched;
    return isFiltered ? settings.filterAction : 'normal';
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
    // 顺手清扫过期桶喵~ 不然公开部署时 Map 会按 IP 无限膨胀 (・ω<)
    if (this.rateLimitBuckets.size > 5000) {
      for (const [ip, b] of this.rateLimitBuckets) {
        if (now - b.windowStart >= RATE_LIMIT_WINDOW_MS) this.rateLimitBuckets.delete(ip);
      }
    }
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

  // 直连解析喵~ auto 跟随系统DNS（等价本机浏览器当前解析），udp:// 明文DNS，https:// 指定DoH (ง •̀_•́)ง
  // 返回实际命中的 target，方便日志看清 auto 模式到底用了谁 (◕‿◕)
  private async forwardDirect(query: Buffer, resolver: string, timeout: number): Promise<{ buffer: Buffer; target: string }> {
    // auto 模式喵：读取操作系统配置的 DNS 列表逐个尝试，去不掉带 zone 的链路本地地址 (๑•̀ㅂ•́)و✧
    const targets = resolver === 'auto'
      ? dns.getServers().map((server) => server.split('%')[0]).filter(Boolean)
      : [resolver];

    let lastError: unknown;
    for (const target of targets) {
      try {
        if (target.startsWith('https://')) {
          const response = await fetch(target, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/dns-message',
              'Accept': 'application/dns-message',
            },
            body: query,
            signal: AbortSignal.timeout(timeout),
          });
          if (!response.ok) {
            throw new Error(`直连解析器返回错误: ${response.status}`);
          }
          return { buffer: Buffer.from(await response.arrayBuffer()), target };
        }

        const { host, port } = parseUdpTarget(target);
        const buffer = await this.resolveViaUdp(query, host, port, timeout);
        return { buffer, target };
      } catch (error) {
        lastError = error;
        console.error(`[doh-service] Direct resolver failed: ${target}`, error);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('没有可用的直连解析器');
  }

  private resolveViaUdp(query: Buffer, host: string, port: number, timeout: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const socket = createSocket(host.includes(':') ? 'udp6' : 'udp4');
      const requestId = (dnsPacket.decode(query) as any).id;
      // 幂等关闭喵~ close() 两次会抛错，包一层保险 (´･ω･`)
      const close = () => { try { socket.close(); } catch { /* 已关闭 */ } };
      const timer = setTimeout(() => {
        close();
        reject(new Error('直连 DNS 查询超时'));
      }, timeout);
      socket.once('error', (error) => {
        clearTimeout(timer);
        close();
        reject(error);
      });
      socket.once('message', (msg) => {
        clearTimeout(timer);
        close();
        try {
          // 校验响应 ID 喵~ UDP 是无连接的，收到串包不能直接用 (・ω<)
          if ((dnsPacket.decode(msg) as any).id !== requestId) {
            return reject(new Error('直连 DNS 响应 ID 不匹配'));
          }
          resolve(Buffer.from(msg));
        } catch (error) {
          reject(error);
        }
      });
      socket.send(query, port, host);
    });
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

      // SNI 阻断代答喵~ 显式名单优先于过滤动作；HTTPS/SVCB 回空掐掉 ECH 保住嗅探 (๑>◡<๑)
      if (settings.fakeIpRules.length > 0
        && ['A', 'AAAA', 'HTTPS', 'SVCB'].includes(recordType)
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
            rcode: 'NOERROR',
            answers: fakeAnswers.map((answer) => String(answer.data)),
          });
        }

        return result;
      }

      const disposition = this.getFilterDisposition(normalizedDomain, settings);
      if (disposition === 'refuse') {
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
            rcode: 'REFUSED',
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
              rcode: 'NOERROR',
              answers: cached.answers.map(answerToString),
            });
          }

          return result;
        }
      }

      const queryBuffer = createDNSQuery(normalizedDomain, recordType);
      let buffer: Buffer | undefined;
      let upstreamName = settings.directResolver;
      let status: 'success' | 'direct' = 'direct';

      // 分流喵~ 命中过滤的域名走直连解析器，失败自动回退上游兜底 (◕‿◕)
      if (disposition === 'direct') {
        try {
          const direct = await this.forwardDirect(queryBuffer, settings.directResolver, settings.upstreamTimeout);
          buffer = direct.buffer;
          upstreamName = direct.target;
        } catch (error) {
          console.error('[doh-service] Direct resolver failed, fallback to upstream:', error);
        }
      }

      if (!buffer) {
        const upstreams = this.selectUpstreams(settings.upstreamServers.filter((server) => server.enabled), settings.upstreamPolicy);
        if (upstreams.length === 0) {
          throw new Error('没有可用的上游DNS服务器');
        }
        const forwarded = await this.forwardToUpstream(queryBuffer, upstreams, settings.upstreamTimeout);
        buffer = forwarded.buffer;
        upstreamName = forwarded.upstream.name;
        status = 'success';
      }

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
        upstream: upstreamName,
      };

      if (options.log) {
        this.logQuery(settings, {
          domain: normalizedDomain,
          type: recordType,
          clientIp,
          responseTime,
          status,
          cached: false,
          rcode: packet.rcode || 'NOERROR',
          upstream: upstreamName,
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
          rcode: 'SERVFAIL',
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

  // 直连解析器测速喵~ 发一个真实 A 查询计时，auto 模式顺便回传实际命中的服务器 (ง •̀_•́)ง
  async testDirectResolver(resolver: string): Promise<{ ok: boolean; latency: number; target?: string; error?: string }> {
    const start = Date.now();
    try {
      const { target } = await this.forwardDirect(createDNSQuery('www.qq.com', 'A'), resolver, 4000);
      return { ok: true, latency: Date.now() - start, target };
    } catch (error) {
      return {
        ok: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : '测试失败',
      };
    }
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
      // 记录类型喵~ HTTPS/SVCB 解出来是 UNKNOWN_65/64，先换回语义名再判定 (ฅ'ω'ฅ)
      const rawType = String(question.type || 'A').toUpperCase();
      const semanticType = DECODE_TYPE_ALIASES[rawType] || rawType;
      const isKnownType = SUPPORTED_RECORD_TYPES.has(semanticType as DNSRecordType);
      recordType = toDNSRecordType(semanticType);

      // SNI 阻断代答：命中规则的 A 查询返回虚拟 IP；AAAA/HTTPS/SVCB 回空（掐 ECH 保住本地代理 SNI 嗅探）
      if (settings.fakeIpRules.length > 0
        && ['A', 'AAAA', 'HTTPS', 'SVCB'].includes(recordType)
        && this.matchesDomainRule(domain, settings.fakeIpRules)) {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'fakeip',
          cached: false,
          rcode: 'NOERROR',
          answers: recordType === 'A' ? [settings.fakeIpAddress] : [],
        });

        return new Response(createFakeIpResponse(packet, question, settings.fakeIpAddress, recordType !== 'A'), {
          status: 200,
          headers: {
            'Content-Type': 'application/dns-message',
            'Cache-Control': 'no-store',
          },
        });
      }

      const disposition = this.getFilterDisposition(domain, settings);
      if (disposition === 'refuse') {
        this.logQuery(settings, {
          domain,
          type: recordType,
          clientIp,
          responseTime: Date.now() - startTime,
          status: 'blocked',
          cached: false,
          rcode: 'REFUSED',
        });

        return new Response(createRefusedResponse(packet, question), {
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
          rcode: 'NOERROR',
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

      let buffer: Buffer | undefined;
      let upstreamName = settings.directResolver;
      let status: 'success' | 'direct' = 'direct';

      // 分流喵~ 命中过滤的域名走直连解析器，失败自动回退上游兜底 (◕‿◕)
      if (disposition === 'direct') {
        try {
          const direct = await this.forwardDirect(dnsQuery, settings.directResolver, settings.upstreamTimeout);
          buffer = direct.buffer;
          upstreamName = direct.target;
        } catch (error) {
          console.error('[doh-service] Direct resolver failed, fallback to upstream:', error);
        }
      }

      if (!buffer) {
        const upstreams = this.selectUpstreams(settings.upstreamServers.filter((server) => server.enabled), settings.upstreamPolicy);
        if (upstreams.length === 0) {
          return new Response('没有可用的上游DNS服务器', { status: 503 });
        }
        const forwarded = await this.forwardToUpstream(dnsQuery, upstreams, settings.upstreamTimeout);
        buffer = forwarded.buffer;
        upstreamName = forwarded.upstream.name;
        status = 'success';
      }

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
        status,
        cached: false,
        rcode: responsePacket.rcode || 'NOERROR',
        upstream: upstreamName,
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
        rcode: 'SERVFAIL',
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