import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { productView } from '@/lib/catalog';
import { Checkout } from '@/components/checkout';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Your new treasure' };
export default async function BuyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ quantity?: string }> }) {
  const product = await db.product.findUnique({ where: { slug: (await params).slug, isPublished: true }, include: { seller: true } });
  if (!product) notFound();
  if (!product.stock) redirect(`/products/${product.slug}`);
  const parsed = z.coerce.number().int().min(1).max(product.stock).safeParse((await searchParams).quantity || 1);
  return <Checkout product={productView(product)} initialQuantity={parsed.success ? parsed.data : 1} />;
}
