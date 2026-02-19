import { NextRequest, NextResponse } from 'next/server';
import { settingsStore } from '@/lib/settings-store';

export async function POST(request: NextRequest) {
  try {
    await settingsStore.initialize();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    if (settingsStore.validateCredentials(username, password)) {
      return NextResponse.json({
        success: true,
        message: '登录成功',
      });
    } else {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('[auth API] Error:', error);
    return NextResponse.json(
      { error: '登录失败' },
      { status: 500 }
    );
  }
}
