import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { publishSchema, publishResultSchema } from '@sahaj/shared';
import { db } from './db';
import { config } from './config';
import { requireApiKey } from './auth';
import { ApiError, json, readBody } from './http';

export async function publishCatalog(request: Request) {
  requireApiKey(request);
  const input = publishSchema.parse(await readBody(request));
  const allowedOrigin = new URL(config.artisanUrl).origin;
  if (input.images.some(image => { const url = new URL(image); return !['http:', 'https:'].includes(url.protocol) || url.origin !== allowedOrigin || !!url.username || !!url.password; })) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Images must be full URLs hosted by the configured Artisan Studio.');
  }
  const { artisanCatalogId, sellerId, bullets, hindiBullets, specifics, keywords, images, ...fields } = input;
  const data = { ...fields, bulletsJson: JSON.stringify(bullets), hindiBulletsJson: JSON.stringify(hindiBullets), specificsJson: JSON.stringify(specifics), keywordsJson: JSON.stringify(keywords), imagesJson: JSON.stringify(images), isPublished: true };
  const slugBase = input.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'handmade';
  const slug = `${slugBase}-${createHash('sha256').update(artisanCatalogId).digest('hex').slice(0, 16)}`;
  const newId = randomUUID();
  const product = await db.$transaction(async tx => {
    await tx.seller.upsert({ where: { id: sellerId }, create: { id: sellerId, name: 'Meera Devi', email: config.sellerEmail, location: 'Jaipur, Rajasthan', story: 'Small-batch pieces, made slowly and with care.' }, update: {} });
    const existing = await tx.product.findUnique({ where: { artisanCatalogId }, select: { sellerId: true } });
    if (existing && existing.sellerId !== sellerId) throw new ApiError(409, 'CONFLICT', 'This catalog is linked to a different seller.');
    return tx.product.upsert({ where: { artisanCatalogId }, create: { id: newId, artisanCatalogId, sellerId, slug, ...data }, update: data });
  });
  revalidatePath('/');
  revalidatePath(`/products/${product.slug}`);
  revalidatePath('/seller', 'layout');
  return json(publishResultSchema.parse({ listingId: product.id, productUrl: new URL(`/products/${product.slug}`, config.commerceUrl).href, created: product.id === newId }));
}
