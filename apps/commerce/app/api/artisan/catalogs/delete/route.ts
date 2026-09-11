import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireApiKey } from '@/lib/auth';
import { db } from '@/lib/db';
import { endpoint, json, readBody } from '@/lib/http';

export const POST = endpoint(async (request: Request) => {
  requireApiKey(request);
  const { artisanCatalogId } = z.object({ artisanCatalogId: z.string() }).parse(await readBody(request));
  const product = await db.product.findUnique({
    where: { artisanCatalogId },
    include: { orders: true },
  });
  if (product) {
    if (product.orders.length === 0) {
      await db.product.delete({ where: { id: product.id } });
    } else {
      await db.product.update({ where: { id: product.id }, data: { isPublished: false } });
    }
    revalidatePath('/');
    revalidatePath(`/products/${product.slug}`);
    revalidatePath('/seller', 'layout');
  }
  return json({ success: true });
});
