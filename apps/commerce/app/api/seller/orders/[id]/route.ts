import { z } from 'zod';
import { orderStatusSchema } from '@sahaj/shared';
import { revalidatePath } from 'next/cache';
import { requireSeller, checkOrigin } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError, endpoint, idSchema, json, readBody } from '@/lib/http';

export const PATCH = endpoint(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const sellerId = await requireSeller();
  checkOrigin(request);
  const id = idSchema.parse((await context.params).id);
  const { status } = z.object({ status: orderStatusSchema }).strict().parse(await readBody(request));
  const order = await db.$transaction(async tx => {
    const current = await tx.order.findFirst({ where: { id, sellerId } });
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
    const steps = orderStatusSchema.options;
    const delta = steps.indexOf(status) - steps.indexOf(current.status);
    if (delta < 0 || delta > 1) throw new ApiError(409, 'STATUS_CONFLICT', 'Move orders from paid to dispatched, then delivered.');
    const updated = await tx.order.updateMany({ where: { id, sellerId, status: current.status }, data: { status } });
    if (!updated.count) throw new ApiError(409, 'CONFLICT', 'Order changed. Refresh and try again.');
    return { id, status };
  });
  revalidatePath('/seller', 'layout');
  revalidatePath('/orders/[id]', 'page');
  return json({ order });
});
