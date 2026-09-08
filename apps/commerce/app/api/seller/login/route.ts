import { cookies } from 'next/headers';
import { z } from 'zod';
import { checkOrigin, equalSecret, sessionCookie, signSession } from '@/lib/auth';
import { config } from '@/lib/config';
import { ApiError, endpoint, json, readBody } from '@/lib/http';

export const POST = endpoint(async (request: Request) => {
  checkOrigin(request);
  const input = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(200) }).strict().parse(await readBody(request));
  const emailValid = equalSecret(input.email.toLowerCase(), config.sellerEmail.toLowerCase());
  const passwordValid = equalSecret(input.password, config.sellerPassword);
  if (!emailValid || !passwordValid) throw new ApiError(401, 'UNAUTHORIZED', 'Email or password is incorrect.');
  (await cookies()).set(sessionCookie, signSession(), { httpOnly: true, sameSite: 'lax', secure: new URL(config.commerceUrl).protocol === 'https:', path: '/', maxAge: 8 * 60 * 60 });
  return json({ redirectUrl: '/seller/dashboard' });
});
