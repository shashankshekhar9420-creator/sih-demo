'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import type { ProductView } from '@/lib/catalog';

export function Checkout({ product, initialQuantity }: { product: ProductView; initialQuantity: number }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/products/${product.id}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerName: form.get('buyerName'), buyerEmail: form.get('buyerEmail'), address: form.get('address'), quantity }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not place the order.');
      router.push(result.confirmationUrl); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Connection interrupted. Please try again.'); setBusy(false); }
  }
  return <div className="wrap checkout-page"><Link className="text-link" href={`/products/${product.slug}`}><ArrowLeft size={16} />Back to the piece</Link><div className="section-heading"><div><span className="eyebrow">One lovely thing. Almost yours.</span><h1>A new story begins.</h1></div></div><div className="checkout-grid"><form className="panel checkout-form" onSubmit={submit}><h2>Where shall it call home?</h2><p>Your details are used only for this local demo order.</p><label>Full name<input name="buyerName" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name" /></label><label>Email address<input name="buyerEmail" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label><label>Delivery address<textarea name="address" autoComplete="street-address" required minLength={10} maxLength={1000} rows={4} placeholder="House, street, city, state and postal code" /></label><label className="quantity-field">Quantity<input type="number" min={1} max={product.stock} required value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button" disabled={busy || !product.stock}>{busy ? 'Placing your order...' : 'Place demo order'}<ArrowRight size={18} /></button><p className="demo-note"><ShieldCheck size={16} />No card details. No real charge. Just a little demo.</p></form><aside className="order-summary panel"><span className="eyebrow">Your thoughtfully chosen piece</span><img className="summary-image" src={product.images[0]} alt={product.title} width="500" height="400" /><h2>{product.title}</h2><p>by {product.seller.name}</p><dl><div><dt>Price per piece</dt><dd>{rupees(product.price)}</dd></div><div><dt>Quantity</dt><dd>{quantity || 0}</dd></div><div><dt>Delivery</dt><dd>Demo only</dd></div><div className="total"><dt>Total</dt><dd>{rupees(Math.round(product.price * 100) * (quantity || 0) / 100)}</dd></div></dl><p className="muted">Availability and price are checked again when you place your order. Orders are marked paid automatically.</p></aside></div></div>;
}
