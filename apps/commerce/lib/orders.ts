import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { artisanOrdersResponseSchema, parseStrings } from '@sahaj/shared';
import { db } from './db';
import { ApiError } from './http';

export const buySchema = z.object({
  buyerName: z.string().trim().min(2).max(100),
  buyerEmail: z.string().trim().email().max(254),
  address: z.string().trim().min(10).max(1000),
  quantity: z.number().int().min(1).max(100000).default(1),
}).strict();

export async function buyProduct(productIdOrSlug: string, input: z.infer<typeof buySchema>) {
  return db.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { OR: [{ id: productIdOrSlug }, { slug: productIdOrSlug }] } });
    if (!product?.isPublished) throw new ApiError(404, 'NOT_FOUND', 'This product is no longer available.');
    // The conditional write is the stock gate; it and the order commit or roll back together.
    const changed = await tx.product.updateMany({ where: { id: product.id, isPublished: true, stock: { gte: input.quantity }, price: product.price }, data: { stock: { decrement: input.quantity } } });
    if (changed.count !== 1) throw new ApiError(409, 'STOCK_CONFLICT', 'There is not enough stock. Refresh the product and choose a smaller quantity.');
    return tx.order.create({ data: { ...input, productId: product.id, sellerId: product.sellerId,
      total: Math.round(product.price * 100) * input.quantity / 100, status: 'PAID', confirmationToken: randomBytes(24).toString('hex') } });
  });
}

export async function sellerOrders(sellerId: string) {
  const orders = await db.order.findMany({ where: { sellerId }, include: { product: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  return artisanOrdersResponseSchema.parse({ orders: orders.map(({ confirmationToken: _token, product, createdAt, updatedAt, ...order }) => ({
    ...order, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
    product: { title: product.title, images: parseStrings(product.imagesJson), slug: product.slug },
  })) });
}

export async function sellerDashboard(sellerId: string) {
  const [products, { orders }] = await Promise.all([
    db.product.findMany({ where: { sellerId }, orderBy: { createdAt: 'desc' } }), sellerOrders(sellerId),
  ]);
  return { totalRevenue: Math.round(orders.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
    activeListings: products.filter(p => p.isPublished).length,
    unitsSold: orders.reduce((sum, o) => sum + o.quantity, 0), pendingOrders: orders.filter(o => o.status === 'PAID').length,
    lowStockProducts: products.filter(p => p.isPublished && p.stock <= 3).map(p => ({ id: p.id, title: p.title, stock: p.stock, slug: p.slug })),
    recentOrders: orders.slice(0, 5), recentProducts: products.slice(0, 5).map(p => ({ id: p.id, title: p.title, slug: p.slug, price: p.price, stock: p.stock, isPublished: p.isPublished, images: parseStrings(p.imagesJson) })) };
}
