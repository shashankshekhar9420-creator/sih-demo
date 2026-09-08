import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, MoveRight, PackageCheck } from 'lucide-react';
import { parseStrings, rupees } from '@sahaj/shared';
import { z } from 'zod';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order confirmation', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const token = z.string().regex(/^[a-f0-9]{48}$/).safeParse((await searchParams).token);
  if (!token.success) notFound();
  const order = await db.order.findFirst({ where: { id: (await params).id, confirmationToken: token.data }, include: { product: true } });
  if (!order) notFound();
  return <div className="confirmation wrap"><span className="confirmation-icon"><Check size={34} /></span><span className="eyebrow">A little handmade happiness</span><h1>It's the start of a good story.</h1><p>Thank you, {order.buyerName}. Your demo order has been placed.</p><div className="panel receipt"><div className="receipt-heading"><div><span className="eyebrow">Order reference</span><code>{order.id}</code></div><span className="badge">{order.status}</span></div><div className="receipt-product"><img src={parseStrings(order.product.imagesJson)[0]} alt={order.product.title} width="120" height="140" /><div><h2>{order.product.title}</h2><p>Quantity: {order.quantity}</p><strong>{rupees(order.total)}</strong></div></div><dl><div><dt>Deliver to</dt><dd>{order.buyerName}<br /><span className="address">{order.address}</span></dd></div><div><dt>Email</dt><dd>{order.buyerEmail}</dd></div><div><dt>Order total</dt><dd><strong>{rupees(order.total)}</strong></dd></div></dl><p className="notice"><PackageCheck size={20} />This is a demo order. No money was charged and no delivery will be arranged.</p></div><Link className="button" href="/">Back to the marketplace <MoveRight size={18} /></Link><p className="muted">Keep this private receipt link to check your order status.</p></div>;
}
