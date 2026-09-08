import { catalogQuerySchema, listProducts } from '@/lib/catalog';
import { endpoint, json } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const GET = endpoint(async (request: Request) => {
  const query = catalogQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return json({ products: await listProducts(query) });
});
