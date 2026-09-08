import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { config } from './config';
import { ApiError } from './http';

export const sessionCookie = 'sahaj-seller';
export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function signSession() {
  const payload = Buffer.from(JSON.stringify({ sellerId: config.sellerId, expires: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', config.sessionSecret).update(payload).digest('base64url')}`;
}
export async function sellerSession() {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');
  if (!equalSecret(signature, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.sellerId === config.sellerId && typeof session.expires === 'number' && session.expires > Date.now() ? config.sellerId : null;
  } catch { return null; }
}
export async function requireSeller() {
  const sellerId = await sellerSession();
  if (!sellerId) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to your seller account.');
  return sellerId;
}
export async function protectSellerPage() {
  const sellerId = await sellerSession();
  if (!sellerId) redirect('/seller/login');
  return sellerId;
}
export function requireApiKey(request: Request) {
  if (!equalSecret(request.headers.get('x-demo-api-key') || '', config.apiKey)) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid demo API key.');
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(config.commerceUrl).origin) throw new ApiError(401, 'UNAUTHORIZED', 'Request origin is not allowed.');
}
