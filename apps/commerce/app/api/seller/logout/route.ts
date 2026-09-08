import { cookies } from 'next/headers';
import { checkOrigin, sessionCookie } from '@/lib/auth';
import { endpoint, json } from '@/lib/http';

export const POST = endpoint(async (request: Request) => {
  checkOrigin(request);
  (await cookies()).delete(sessionCookie);
  return json({ redirectUrl: '/seller/login' });
});
