import { revalidatePath } from 'next/cache';
import { buyProduct, buySchema } from '@/lib/orders';
import { checkOrigin } from '@/lib/auth';
import { endpoint, idSchema, json, readBody } from '@/lib/http';

export const POST = endpoint(async (request: Request, context: { params: Promise<{ slug: string }> }) => {
  checkOrigin(request);
  // Next requires one dynamic segment name here. For this route its value is a product ID.
  const id = idSchema.parse((await context.params).slug);
  const order = await buyProduct(id, buySchema.parse(await readBody(request)));
  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');
  revalidatePath('/seller', 'layout');
  return json({ order: { id: order.id, productId: order.productId, quantity: order.quantity, total: order.total, status: order.status },
    confirmationUrl: `/orders/${order.id}?token=${order.confirmationToken}` }, 201);
});
