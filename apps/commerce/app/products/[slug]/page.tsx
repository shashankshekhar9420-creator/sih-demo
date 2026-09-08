import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { productView } from '@/lib/catalog';
import { ProductDetail } from '@/components/product-detail';
import { ProductCard } from '@/components/site';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const product = await db.product.findUnique({ where: { slug: (await params).slug, isPublished: true } });
  return { title: product?.title || 'Piece not found' };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = await db.product.findUnique({ where: { slug: (await params).slug, isPublished: true }, include: { seller: true } });
  if (!product) notFound();
  const related = await db.product.findMany({ where: { isPublished: true, id: { not: product.id }, category: product.category }, include: { seller: true }, take: 4, orderBy: { createdAt: 'desc' } });
  return <div className="wrap detail-page"><ProductDetail product={productView(product)} />{related.length > 0 && <section className="related"><span className="eyebrow">A shared love of craft</span><h2>In good company.</h2><div className="product-grid">{related.map(p => <ProductCard key={p.id} product={productView(p)} />)}</div></section>}</div>;
}
