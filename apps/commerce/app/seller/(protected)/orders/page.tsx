import Link from 'next/link';
import { orderStatusSchema } from '@sahaj/shared';
import { protectSellerPage } from '@/lib/auth';
import { sellerOrders } from '@/lib/orders';
import { OrderManager } from '@/components/seller-controls';

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sellerId = await protectSellerPage();
  const { orders } = await sellerOrders(sellerId);
  const parsed = orderStatusSchema.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;
  const visible = orders.filter(o => !status || o.status === status);
  return <><div className="seller-page-heading"><div><span className="eyebrow">From your hands to their home</span><h1>Your orders.</h1><p>Follow each piece on its journey. Update status as you go.</p></div><span className="count-label">{orders.length} orders</span></div><nav className="order-tabs" aria-label="Filter orders"><Link className={!status ? 'active' : ''} href="/seller/orders">All orders ({orders.length})</Link>{orderStatusSchema.options.map(s => <Link className={s === status ? 'active' : ''} key={s} href={`/seller/orders?status=${s}`}>{s === 'PAID' ? 'Paid' : s === 'DISPATCHED' ? 'Dispatched' : 'Delivered'} ({orders.filter(o => o.status === s).length})</Link>)}</nav><div className="seller-order-list">{visible.map(order => <OrderManager key={`${order.id}-${order.status}`} order={order} />)}{!visible.length && <div className="panel empty-state"><h2>All quiet here.</h2><p>No orders in this view yet.</p></div>}</div></>;
}
