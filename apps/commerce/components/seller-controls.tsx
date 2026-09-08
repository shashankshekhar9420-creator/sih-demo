'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Save, ArrowRight } from 'lucide-react';
import { rupees, type ArtisanOrder } from '@sahaj/shared';
import type { ProductView } from '@/lib/catalog';

async function requestJson(url: string, method: string, data?: unknown) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setError(''); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await requestJson('/api/seller/login', 'POST', { email: form.get('email'), password: form.get('password') });
      router.replace(result.redirectUrl); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); setBusy(false); }
  }
  return <form className="login-form" onSubmit={submit}><label>Email address<input name="email" type="email" required autoComplete="username" placeholder="Your seller email" maxLength={254} /></label><label>Password<input name="password" type="password" required autoComplete="current-password" placeholder="Your password" maxLength={200} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button" disabled={busy}>{busy ? 'Signing in...' : 'Enter your studio'}<ArrowRight size={18} /></button><p className="muted">Use the demo seller credentials provided by your host. This is a local demonstration, not a production account.</p></form>;
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div><button className="logout" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { await requestJson('/api/seller/logout', 'POST'); router.replace('/seller/login'); router.refresh(); }
    catch { setError('Could not sign out. Retry.'); setBusy(false); }
  }}><LogOut size={16} />{busy ? 'Signing out...' : 'Sign out'}</button>{error && <span role="alert" className="form-error">{error}</span>}</div>;
}

export function ProductEditor({ product }: { product: ProductView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      await requestJson(`/api/seller/products/${product.id}`, 'PATCH', { price: Number(form.get('price')), stock: Number(form.get('stock')), isPublished: form.get('isPublished') === 'true' });
      setMessage('Changes saved.'); setEditing(false); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save changes.'); }
    finally { setBusy(false); }
  }
  return <><div className="seller-product-row"><img src={product.images[0]} alt={product.title} width="70" height="80" /><div className="seller-product-name"><strong>{product.title}</strong><span>{product.category}</span><small>{product.artisanCatalogId ? 'Artisan app' : 'Seed product'}</small></div><strong>{rupees(product.price)}</strong><span className={product.stock <= 3 ? 'low-stock' : ''}>{product.stock} in stock</span><span className={`badge ${product.isPublished ? '' : 'neutral'}`}>{product.isPublished ? 'Published' : 'Hidden'}</span><button className="button secondary small" onClick={() => { setEditing(!editing); setError(''); setMessage(''); }} aria-expanded={editing}>{editing ? 'Cancel' : 'Edit'}</button></div>
    {editing && <form className="product-edit-form" onSubmit={submit}><label>Price (INR)<input name="price" type="number" min={0} max={10000000} step="0.01" defaultValue={product.price} required /></label><label>Available stock<input name="stock" type="number" min={0} max={100000} step={1} defaultValue={product.stock} required /></label><label>Visibility<select name="isPublished" defaultValue={String(product.isPublished)}><option value="true">Published</option><option value="false">Hidden</option></select></label><button className="button small" disabled={busy}><Save size={16} />{busy ? 'Saving...' : 'Save changes'}</button><p className="muted">Stock replaces the current available count. Publishing again from Artisan Studio restores its price, stock and visibility.</p></form>}{error && <p role="alert" className="form-error row-message">{error}</p>}{message && <p role="status" className="success-text row-message">{message}</p>}</>;
}

export function OrderManager({ order }: { order: ArtisanOrder }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = order.status === 'PAID' ? 'DISPATCHED' : order.status === 'DISPATCHED' ? 'DELIVERED' : null;
  return <article className="panel seller-order"><div className="order-heading"><div><code>{order.id}</code><span>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div><span className={`badge ${order.status === 'DISPATCHED' ? 'amber' : ''}`}>{order.status}</span></div><div className="seller-order-body"><img src={order.product.images[0]} alt={order.product.title} width="90" height="100" /><div><h3>{order.product.title}</h3><p>{order.quantity} {order.quantity === 1 ? 'piece' : 'pieces'} &middot; {rupees(order.total)}</p><strong>{order.buyerName}</strong><p>{order.buyerEmail}</p></div><div className="delivery-address"><span className="eyebrow">Delivery address</span><p className="address">{order.address}</p></div></div><div className="order-actions"><span className="muted">Demo order. No real shipping is arranged.</span>{next ? <button className="button small" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { await requestJson(`/api/seller/orders/${order.id}`, 'PATCH', { status: next }); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the order.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Updating...' : next === 'DISPATCHED' ? 'Mark dispatched' : 'Mark delivered'}<ArrowRight size={16} /></button> : <span className="success-text">Journey complete</span>}</div>{error && <p role="alert" className="form-error">{error}</p>}</article>;
}
