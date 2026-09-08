import { requireSeller } from '@/lib/auth';
import { db } from '@/lib/db';
import { endpoint, json } from '@/lib/http';
import { productView } from '@/lib/catalog';

export const GET = endpoint(async () => {
  const sellerId = await requireSeller();
  return json({ products: (await db.product.findMany({ where: { sellerId }, include: { seller: true }, orderBy: { createdAt: 'desc' } })).map(productView) });
});
