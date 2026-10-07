import { NextRequest, NextResponse } from 'next/server';
import { dohService } from '@/lib/doh-service';
import { normalizeDirectResolver } from '@/lib/settings-store';
import { requireAuth } from '@/lib/auth-server';

export const runtime = 'nodejs';

// 直连解析器批量测速喵~ 真实发 DNS 查询计时，帮你一眼挑最快的那个 (◕‿◕)
export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const resolvers: unknown = body?.resolvers;

    if (!Array.isArray(resolvers) || resolvers.length === 0 || resolvers.length > 12) {
      return NextResponse.json({ error: 'resolvers 需要是 1~12 个的数组喵' }, { status: 400 });
    }

    const results = await Promise.all(
      resolvers.map(async (item) => {
        const raw = String(item);
        return { resolver: raw, ...(await dohService.testDirectResolver(normalizeDirectResolver(raw))) };
      }),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[test-resolver] Error:', error);
    return NextResponse.json({ error: '测速失败喵' }, { status: 500 });
  }
}
