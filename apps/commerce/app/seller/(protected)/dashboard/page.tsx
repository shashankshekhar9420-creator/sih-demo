import Link from 'next/link';
import { ArrowUpRight, Banknote, Package, ShoppingBag, Clock3 } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import { protectSellerPage } from '@/lib/auth';
import { sellerDashboard } from '@/lib/orders';
import { db } from '@/lib/db';

export default async function DashboardPage() {
  const sellerId = await protectSellerPage();
  const [data, seller] = await Promise.all([sellerDashboard(sellerId), db.seller.findUnique({ where: { id: sellerId } })]);
  const stats = [{ label: 'Total revenue', value: rupees(data.totalRevenue), icon: Banknote }, { label: 'Active listings', value: data.activeListings, icon: Package }, { label: 'Units sold', value: data.unitsSold, icon: ShoppingBag }, { label: 'Awaiting dispatch', value: data.pendingOrders, icon: Clock3 }];
  return <><div className="seller-page-heading"><div><span className="eyebrow">A little overview</span><h1>Hello, {seller?.name.split(' ')[0] || 'maker'}.</h1><p>Here's how your handmade business is doing.</p></div><Link href="/seller/products" className="button small">Manage products <ArrowUpRight size={17} /></Link></div><div className="stats-grid">{stats.map(({ label, value, icon: Icon }) => <div className="stat" key={label}><Icon size={21} strokeWidth={1.5} /><span>{label}</span><strong>{value}</strong></div>)}</div>
    {data.lowStockProducts.length > 0 && <section className="stock-alert"><div><Package size={22} /><div><strong>A few pieces are running low</strong><p>{data.lowStockProducts.map(p => `${p.title} (${p.stock} left)`).join(' / ')}</p></div></div><Link href="/seller/products">Update stock <ArrowUpRight size={16} /></Link></section>}
    <section className="panel dashboard-panel"><div className="panel-heading"><h2>Recent orders</h2><Link href="/seller/orders" className="text-link">View all <ArrowUpRight size={16} /></Link></div>{data.recentOrders.length ? <div className="table-scroll"><table><thead><tr><th>Product / buyer</th><th>Quantity</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.recentOrders.map(order => <tr key={order.id}><td><strong>{order.product.title}</strong><span>{order.buyerName}</span></td><td>{order.quantity}</td><td>{rupees(order.total)}</td><td><span className="badge">{order.status}</span></td></tr>)}</tbody></table></div> : <p className="muted">Your first order is a story waiting to happen.</p>}</section>
    <section className="panel dashboard-panel"><div className="panel-heading"><h2>Recent products</h2><Link href="/seller/products" className="text-link">Manage <ArrowUpRight size={16} /></Link></div>{data.recentProducts.map(product => <div className="recent-product" key={product.id}><img src={product.images[0]} alt={product.title} width="55" height="60" /><div><strong>{product.title}</strong><span>{product.stock} in stock &middot; {product.isPublished ? 'Published' : 'Hidden'}</span></div><strong>{rupees(product.price)}</strong></div>)}{!data.recentProducts.length && <p className="muted">Publish your first piece from Artisan Studio, or run the local seed.</p>}</section><p className="muted">Figures include demo orders only. Paid orders are counted as revenue.</p></>;
}
