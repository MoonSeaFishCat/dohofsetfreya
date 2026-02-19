import { NextRequest, NextResponse } from 'next/server';
import { settingsStore } from '@/lib/settings-store';

export async function GET() {
  return NextResponse.json({
    upstreamServers: settingsStore.getAllUpstreamServers(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { upstreamServers: newServers } = await request.json();

    if (!Array.isArray(newServers)) {
      return NextResponse.json(
        { error: '无效的服务器配置' },
        { status: 400 }
      );
    }

    // 验证每个服务器配置
    for (const server of newServers) {
      if (!server.name || !server.url) {
        return NextResponse.json(
          { error: '服务器配置缺少必要字段' },
          { status: 400 }
        );
      }
    }

    settingsStore.setUpstreamServers(newServers);

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      upstreamServers: newServers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}
