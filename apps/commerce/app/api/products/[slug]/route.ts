import { db } from '@/lib/db';
import { productView } from '@/lib/catalog';
import { ApiError, endpoint, idSchema, json } from '@/lib/http';

export const GET = endpoint(async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  const slug = idSchema.parse((await context.params).slug);
  const product = await db.product.findFirst({ where: { OR: [{ slug }, { id: slug }], isPublished: true }, include: { seller: true } });
  if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found.');
  return json({ product: productView(product) });
});
