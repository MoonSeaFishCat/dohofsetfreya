import { NextRequest } from 'next/server';
import { dohService } from '@/lib/doh-service';

export const runtime = 'nodejs'; // dns-packet 和 Buffer 依赖 Node.js runtime

// GET /api/dns-query?dns=<base64url>
// POST /api/dns-query with application/dns-message body
export async function GET(request: NextRequest) {
  return dohService.handleDoHRequest(request);
}

export async function POST(request: NextRequest) {
  return dohService.handleDoHRequest(request);
}

// 支持CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
