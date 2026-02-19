import { NextRequest, NextResponse } from 'next/server';
import { dnsStats } from '@/lib/dns-stats';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const logs = await dnsStats.getLogs(limit, offset);

    return NextResponse.json({
      logs,
      total: logs.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[v0] Logs error:', error);
    return NextResponse.json(
      { error: '获取日志失败' },
      { status: 500 }
    );
  }
}
