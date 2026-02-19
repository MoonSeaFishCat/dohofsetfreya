import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '请提供用户名和密码' },
        { status: 400 }
      );
    }

    if (validateCredentials(username, password)) {
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
    return NextResponse.json(
      { error: '登录失败' },
      { status: 500 }
    );
  }
}
