import { z } from 'zod';
import { categorySchema, parseSpecifics, parseStrings } from '@sahaj/shared';
import type { Product, Seller, Prisma } from '@/generated/client';
import { db } from './db';

export const catalogQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  category: categorySchema.optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
}).strict();

export function productView(product: Product & { seller: Seller }) {
  const { bulletsJson, hindiBulletsJson, specificsJson, keywordsJson, imagesJson, seller, ...fields } = product;
  return { ...fields, createdAt: product.createdAt.toISOString(), updatedAt: product.updatedAt.toISOString(),
    bullets: parseStrings(bulletsJson), hindiBullets: parseStrings(hindiBulletsJson),
    specifics: parseSpecifics(specificsJson), keywords: parseStrings(keywordsJson), images: parseStrings(imagesJson),
    seller: { id: seller.id, name: seller.name, location: seller.location, story: seller.story } };
}
export type ProductView = ReturnType<typeof productView>;

export async function listProducts(query: z.infer<typeof catalogQuerySchema>) {
  const where: Prisma.ProductWhereInput = { isPublished: true, ...(query.category ? { category: query.category } : {}),
    ...(query.search ? { OR: [{ title: { contains: query.search } }, { description: { contains: query.search } }, { keywordsJson: { contains: query.search } }, { seller: { name: { contains: query.search } } }] } : {}) };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sort === 'newest' ? [{ createdAt: 'desc' }, { id: 'asc' }] : [{ price: query.sort === 'price-asc' ? 'asc' : 'desc' }, { id: 'asc' }];
  return (await db.product.findMany({ where, orderBy, include: { seller: true } })).map(productView);
}
