import { z } from 'zod';
import { moneySchema, stockSchema } from '@sahaj/shared';
import { revalidatePath } from 'next/cache';
import { requireSeller, checkOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError, endpoint, idSchema, json, readBody } from '@/lib/http';
import { productView } from '@/lib/catalog';

export const PATCH = endpoint(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const sellerId = await requireSeller();
  checkOrigin(request);
  const id = idSchema.parse((await context.params).id);
  const input = z.object({ price: moneySchema.optional(), stock: stockSchema.optional(), isPublished: z.boolean().optional() }).strict().refine(v => Object.keys(v).length > 0).parse(await readBody(request));
  const product = await db.$transaction(async tx => {
    const result = await tx.product.updateMany({ where: { id, sellerId }, data: input });
    if (!result.count) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
    return tx.product.findUniqueOrThrow({ where: { id }, include: { seller: true } });
  });
  revalidatePath('/');
  revalidatePath(`/products/${product.slug}`);
  revalidatePath('/seller', 'layout');
  return json({ product: productView(product) });
});
