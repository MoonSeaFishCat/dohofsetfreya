import { NextResponse } from 'next/server';
import { attachClearAuthCookie } from '@/lib/auth-server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: '已登出' });
  attachClearAuthCookie(response);
  return response;
}