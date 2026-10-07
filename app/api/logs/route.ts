import { NextRequest, NextResponse } from 'next/server';
import { dnsStats } from '@/lib/dns-stats';
import { requireAuth } from '@/lib/auth-server';
import { DNSQueryLog, DNSQueryStatus, DNSRecordType } from '@/lib/dns-types';

export const runtime = 'nodejs';

function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function filterLogs(logs: DNSQueryLog[], request: NextRequest): DNSQueryLog[] {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase();
  const type = searchParams.get('type') as DNSRecordType | 'all' | null;
  const status = searchParams.get('status') as DNSQueryStatus | 'all' | null;
  const cached = searchParams.get('cached');

  return logs.filter((log) => {
    if (q && !log.domain.toLowerCase().includes(q)) return false;
    if (type && type !== 'all' && log.type !== type) return false;
    if (status && status !== 'all' && log.status !== status) return false;
    if (cached === 'true' && !log.cached) return false;
    if (cached === 'false' && log.cached) return false;
    return true;
  });
}

function toCsv(logs: DNSQueryLog[]): string {
  const headers = ['timestamp', 'domain', 'type', 'status', 'rcode', 'cached', 'responseTime', 'upstream', 'clientIp'];
  const rows = logs.map((log) => [
    new Date(log.timestamp).toISOString(),
    log.domain,
    log.type,
    log.status,
    log.rcode || '',
    String(log.cached),
    String(log.responseTime),
    log.upstream || '',
    log.clientIp,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parsePositiveInt(searchParams.get('limit'), 100, 500);
    const offset = parsePositiveInt(searchParams.get('offset'), 0, 100000);
    const format = searchParams.get('format') || 'json';

    const allLogs = await dnsStats.getLogs(1000, 0);
    const filteredLogs = filterLogs(allLogs, request);
    const logs = filteredLogs.slice(offset, offset + limit);

    if (format === 'csv') {
      return new NextResponse(toCsv(filteredLogs), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="dns-logs.csv"',
        },
      });
    }

    return NextResponse.json({
      logs,
      total: filteredLogs.length,
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