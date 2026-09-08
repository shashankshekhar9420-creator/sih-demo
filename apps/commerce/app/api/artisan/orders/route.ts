import { z } from 'zod';
import { requireApiKey } from '@/lib/auth';
import { endpoint, json } from '@/lib/http';
import { sellerOrders } from '@/lib/orders';

export const GET = endpoint(async (request: Request) => {
  requireApiKey(request);
  const { sellerId } = z.object({ sellerId: z.literal('seller-demo') }).strict().parse(Object.fromEntries(new URL(request.url).searchParams));
  return json(await sellerOrders(sellerId));
});
