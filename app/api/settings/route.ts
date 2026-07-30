import { NextRequest, NextResponse } from 'next/server';
import { settingsStore } from '@/lib/settings-store';
import { requireAuth } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  await settingsStore.initialize();
  const credentials = settingsStore.getAuthCredentials();
  const dnsSettings = settingsStore.getDNSSettings();

  return NextResponse.json({
    ...dnsSettings,
    auth: {
      username: credentials.username,
    },
    storageType: settingsStore.getStorageTypeName(),
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;

  await settingsStore.initialize();

  try {
    const body = await request.json();
    const { upstreamServers: newServers, auth, dnsSettings } = body;

    if (newServers && Array.isArray(newServers)) {
      await settingsStore.setUpstreamServers(newServers);
    }

    if (dnsSettings && typeof dnsSettings === 'object') {
      await settingsStore.setDNSSettings(dnsSettings);
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

    const updatedSettings = settingsStore.getDNSSettings();
    return NextResponse.json({
      success: true,
      message: '配置已更新',
      ...updatedSettings,
      storageType: settingsStore.getStorageTypeName(),
    });
  } catch (error) {
    console.error('[settings API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新配置失败' },
      { status: 500 }
    );
  }
}