import dnsPacket from 'dns-packet';
import { DNSRecordType, DNSQueryResult, UpstreamDNS } from './dns-types';
import { dnsCache } from './dns-cache';
import { settingsStore } from './settings-store';

export class DoHService {
  private cacheEnabled: boolean;

  constructor(cacheEnabled = true) {
    this.cacheEnabled = cacheEnabled;
  }

  // 获取上游服务器（从设置存储中动态获取）
  private getUpstreamServers(): UpstreamDNS[] {
    return settingsStore.getUpstreamServers();
  }

  // 执行DNS查询
  async query(domain: string, type: DNSRecordType = 'A', useCache = true): Promise<DNSQueryResult> {
    const startTime = Date.now();

    try {
      // 检查缓存
      if (this.cacheEnabled && useCache) {
        const cached = dnsCache.get(domain, type);
        if (cached) {
          return {
            success: true,
            domain,
            type,
            answers: cached.answers,
            responseTime: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // 构造DNS查询包
      const query = dnsPacket.encode({
        type: 'query',
        id: Math.floor(Math.random() * 65535),
        flags: dnsPacket.RECURSION_DESIRED,
        questions: [{
          type: this.getDNSType(type),
          name: domain,
        }],
      });

      // 选择上游服务器
      const upstream = this.selectUpstream();
      if (!upstream) {
        throw new Error('没有可用的上游DNS服务器');
      }

      // 发送DoH请求
      const response = await fetch(upstream.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/dns-message',
          'Accept': 'application/dns-message',
        },
        body: query,
        signal: AbortSignal.timeout(5000), // 5秒超时
      });

      if (!response.ok) {
        throw new Error(`上游DNS服务器返回错误: ${response.status}`);
      }

      // 解析响应
      const responseBuffer = await response.arrayBuffer();
      const packet = dnsPacket.decode(Buffer.from(responseBuffer));

      const answers = packet.answers || [];
      const responseTime = Date.now() - startTime;

      // 缓存结果
      if (this.cacheEnabled && answers.length > 0) {
        const ttl = Math.min(...answers.map((a: any) => a.ttl || 300));
        dnsCache.set(domain, type, answers, ttl);
      }

      return {
        success: true,
        domain,
        type,
        answers,
        responseTime,
        cached: false,
        upstream: upstream.name,
      };
    } catch (error) {
      console.error('[v0] DNS query error:', error);
      return {
        success: false,
        domain,
        type,
        answers: [],
        responseTime: Date.now() - startTime,
        cached: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  // 处理DoH请求（RFC 8484）
  async handleDoHRequest(request: Request): Promise<Response> {
    try {
      let dnsQuery: Buffer;

      // 处理GET请求
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const dnsParam = url.searchParams.get('dns');
        
        if (!dnsParam) {
          return new Response('缺少dns参数', { status: 400 });
        }

        // Base64URL解码
        const base64 = dnsParam.replace(/-/g, '+').replace(/_/g, '/');
        dnsQuery = Buffer.from(base64, 'base64');
      }
      // 处理POST请求
      else if (request.method === 'POST') {
        const contentType = request.headers.get('content-type');
        if (contentType !== 'application/dns-message') {
          return new Response('Content-Type必须是application/dns-message', { status: 400 });
        }

        const arrayBuffer = await request.arrayBuffer();
        dnsQuery = Buffer.from(arrayBuffer);
      } else {
        return new Response('只支持GET和POST方法', { status: 405 });
      }

      // 解析查询
      const packet = dnsPacket.decode(dnsQuery);
      const question = packet.questions?.[0];

      if (!question) {
        return new Response('无效的DNS查询', { status: 400 });
      }

      // 选择上游服务器并转发
      const upstream = this.selectUpstream();
      if (!upstream) {
        return new Response('没有可用的上游DNS服务器', { status: 503 });
      }

      const upstreamResponse = await fetch(upstream.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/dns-message',
          'Accept': 'application/dns-message',
        },
        body: dnsQuery,
        signal: AbortSignal.timeout(5000),
      });

      if (!upstreamResponse.ok) {
        throw new Error(`上游服务器错误: ${upstreamResponse.status}`);
      }

      const responseBuffer = await upstreamResponse.arrayBuffer();

      return new Response(responseBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/dns-message',
          'Cache-Control': 'max-age=300',
        },
      });
    } catch (error) {
      console.error('[v0] DoH request error:', error);
      return new Response('DNS查询失败', { status: 500 });
    }
  }

  // 选择上游服务器（简单轮询）
  private selectUpstream(): UpstreamDNS | null {
    const enabled = this.getUpstreamServers();
    if (enabled.length === 0) return null;

    // 已经按优先级排序，返回第一个
    return enabled[0];
  }

  // 获取DNS类型字符串
  private getDNSType(type: DNSRecordType): string {
    return type;
  }
}

// 全局DoH服务实例
export const dohService = new DoHService();
