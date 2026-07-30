import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './auth';

const SESSION_TTL_SECONDS = 60 * 60 * 8;

type AuthPayload = {
  iat: number;
  exp: number;
  nonce: string;
};

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || 'doh-development-auth-secret';
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  return Buffer.from(padded, 'base64');
}

function sign(value: string): string {
  return toBase64Url(createHmac('sha256', getAuthSecret()).update(value).digest());
}

function createSessionToken(): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthPayload = {
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: randomBytes(16).toString('hex'),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const expectedSignature = sign(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as AuthPayload;
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function buildCookieHeader(value: string, maxAge: number): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function hasAuthCookie(request: NextRequest): boolean {
  return verifySessionToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export function requireAuth(request: NextRequest): NextResponse | null {
  if (hasAuthCookie(request)) {
    return null;
  }

  return NextResponse.json(
    { error: '未授权，请先登录' },
    { status: 401 }
  );
}

export function attachAuthCookie(response: NextResponse): NextResponse {
  response.headers.append('Set-Cookie', buildCookieHeader(createSessionToken(), SESSION_TTL_SECONDS));
  return response;
}

export function attachClearAuthCookie(response: NextResponse): NextResponse {
  response.headers.append('Set-Cookie', buildCookieHeader('', 0));
  return response;
}