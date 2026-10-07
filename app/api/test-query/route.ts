import { NextRequest, NextResponse } from 'next/server';
import { dohService } from '@/lib/doh-service';
import { DNSRecordType } from '@/lib/dns-types';
import { requireAuth } from '@/lib/auth-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { domain, type = 'A', useCache = true } = body;

    if (!domain) {
      return NextResponse.json(
        { error: '缺少domain参数' },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';
    const sanitizedIp = clientIp === 'unknown'
      ? clientIp
      : clientIp.split(',')[0].trim().split('.').slice(0, 3).join('.') + '.***';

    const result = await dohService.query(
      domain,
      type as DNSRecordType,
      useCache,
      sanitizedIp
    );

    return NextResponse.json({
      success: result.success,
      domain: result.domain,
      type: result.type,
      answers: result.answers,
      responseTime: result.responseTime,
      cached: result.cached,
      upstream: result.upstream,
      fakeip: result.fakeip,
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
