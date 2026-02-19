import { NextResponse } from 'next/server';
import { dnsStats } from '@/lib/dns-stats';
import { dnsCache } from '@/lib/dns-cache';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const [stats, uptime] = await Promise.all([
      dnsStats.getStats(),
      dnsStats.getUptime(),
    ]);
    const cacheStats = dnsCache.getStats();

    return NextResponse.json({
      ...stats,
      cache: cacheStats,
      uptime,
      uptimeFormatted: formatUptime(uptime),
    });
  } catch (error) {
    console.error('[v0] Stats error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`;
  return `${seconds}秒`;
}
