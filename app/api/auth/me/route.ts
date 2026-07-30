import { NextRequest, NextResponse } from 'next/server';
import { hasAuthCookie } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  if (!hasAuthCookie(request)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true });
}