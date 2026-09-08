import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const runtime = 'nodejs';

const sessionCookie = 'sahaj-seller';
const secret = process.env.DEMO_SESSION_SECRET || 'local-demo-secret';
const demoSellerId = process.env.DEMO_SELLER_ID || 'seller-demo';

function isValidSession(value?: string): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.sellerId === demoSellerId && typeof session.expires === 'number' && session.expires > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Protect seller HTML pages
  if (
    pathname.startsWith('/seller') &&
    pathname !== '/seller/login' &&
    !pathname.startsWith('/api/')
  ) {
    const cookie = request.cookies.get(sessionCookie)?.value;
    if (!isValidSession(cookie)) {
      return NextResponse.redirect(new URL('/seller/login', request.url));
    }
  }

  // Protect private order receipts
  if (pathname.startsWith('/orders/') && !pathname.startsWith('/api/')) {
    const token = searchParams.get('token');
    if (!token || !/^[a-f0-9]{48}$/.test(token)) {
      return new NextResponse('Order not found', { status: 404 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/seller/:path*', '/orders/:path*'],
};
