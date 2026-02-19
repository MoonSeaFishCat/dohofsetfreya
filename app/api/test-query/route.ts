import { NextRequest, NextResponse } from 'next/server';
import { dohService } from '@/lib/doh-service';
import { dnsStats } from '@/lib/dns-stats';
import { DNSRecordType } from '@/lib/dns-types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, type = 'A', useCache = true } = body;

    if (!domain) {
      return NextResponse.json(
        { error: '缺少domain参数' },
        { status: 400 }
      );
    }

    // 执行查询
    const result = await dohService.query(
      domain,
      type as DNSRecordType,
      useCache
    );

    // 记录到统计
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // 脱敏IP（只保留前3段）
    const sanitizedIp = clientIp.split('.').slice(0, 3).join('.') + '.***';

    dnsStats.logQuery({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      domain,
      type: type as DNSRecordType,
      clientIp: sanitizedIp,
      responseTime: result.responseTime,
      status: result.success ? 'success' : 'error',
      cached: result.cached,
      upstream: result.upstream,
      answers: result.answers.map((a: any) => {
        if (a.type === 'A' || a.type === 'AAAA') return a.data;
        if (a.type === 'CNAME') return a.data;
        if (a.type === 'MX') return `${a.priority} ${a.exchange}`;
        if (a.type === 'TXT') return a.data.join(' ');
        return JSON.stringify(a.data);
      }),
    });

    return NextResponse.json({
      success: result.success,
      domain: result.domain,
      type: result.type,
      answers: result.answers,
      responseTime: result.responseTime,
      cached: result.cached,
      upstream: result.upstream,
      error: result.error,
    });
  } catch (error) {
    console.error('[v0] Test query error:', error);
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    );
  }
}
