import { NextRequest, NextResponse } from 'next/server';
import { settingsStore } from '@/lib/settings-store';

export async function GET() {
  await settingsStore.initialize();
  const credentials = settingsStore.getAuthCredentials();
  return NextResponse.json({
    upstreamServers: settingsStore.getAllUpstreamServers(),
    auth: {
      username: credentials.username,
    },
    storageType: settingsStore.getStorageTypeName(),
  });
}

export async function POST(request: NextRequest) {
  await settingsStore.initialize();

  try {
    const body = await request.json();
    const { upstreamServers: newServers, auth } = body;

    if (newServers && Array.isArray(newServers)) {
      for (const server of newServers) {
        if (!server.name || !server.url) {
          return NextResponse.json(
            { error: '服务器配置缺少必要字段' },
            { status: 400 }
          );
        }
      }
      await settingsStore.setUpstreamServers(newServers);
    }

    if (auth && auth.username && auth.password) {
      if (auth.password.length < 6) {
        return NextResponse.json(
          { error: '密码长度至少6位' },
          { status: 400 }
        );
      }
      await settingsStore.setAuthCredentials({
        username: auth.username,
        password: auth.password,
      });
    }

    return NextResponse.json({
      success: true,
      message: '配置已更新',
      upstreamServers: settingsStore.getAllUpstreamServers(),
      storageType: settingsStore.getStorageTypeName(),
    });
  } catch (error) {
    console.error('[settings API] Error:', error);
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}
