'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Camera, Check, Clock3, Mic, Package, Plus, RefreshCw, Search, ShoppingBag, Store } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import { dashboardSchema, dateLabel, request, resumeStep, safeProductUrl, type DashboardData } from './client-api';
import { CraftIllustration, EmptyState, ErrorNotice, LoadingPanel, StatusBadge } from './ui';

const stepNames = ['Add photographs', 'Prepare images', 'Record your story', 'Choose a category', 'Set your price', 'Add stock', 'Review & publish'];

export function Dashboard({ view }: { view: 'studio' | 'catalogs' | 'orders' }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request('/api/dashboard', dashboardSchema, { signal: controller.signal })
      .then(setData)
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not open the studio.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);

  const published = data?.catalogs.filter(catalog => catalog.status === 'PUBLISHED').length ?? 0;
  const drafts = (data?.catalogs.length ?? 0) - published;
  const catalogs = data?.catalogs.filter(catalog => {
    const matchesFilter = filter === 'all' || (filter === 'published' ? catalog.status === 'PUBLISHED' : catalog.status !== 'PUBLISHED');
    return matchesFilter && `${catalog.title ?? ''} ${catalog.hindiTitle ?? ''} ${catalog.category ?? ''}`.toLowerCase().includes(search.toLowerCase());
  }) ?? [];
  const orders = data?.orders.filter(order => `${order.product.title} ${order.buyerName} ${order.id}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="dashboard">
    <div className="page-heading"><div><span className="eyebrow">{view === 'studio' ? 'ROOTED IN CRAFT. READY FOR THE WORLD.' : 'YOUR ARTISAN WORKSPACE'}</span><h1>{view === 'studio' ? 'Welcome to your studio.' : view === 'catalogs' ? 'Your collection of creations.' : 'Good things are finding homes.'}</h1><p>{view === 'studio' ? 'A little care, a few simple steps. Let your handmade work be seen.' : view === 'catalogs' ? 'Every piece has a beginning. Pick up where you left off.' : 'Keep an eye on the orders coming from your marketplace.'}</p></div>{view !== 'orders' && <Link className="button primary heading-action" href="/catalogs/new"><Plus size={18} /> New catalog</Link>}</div>
    {view === 'studio' && <section className="studio-hero"><div className="hero-copy"><span className="eyebrow"><span className="tiny-line" /> FROM YOUR HANDS TO THEIR HOME</span><h2>You make beautiful things.<br /><em>Let&apos;s tell their story.</em></h2><p>Turn your photographs and your voice into a catalog that opens doors. No perfect words needed.</p><Link href="/catalogs/new" className="button primary">Create a new catalog <ArrowRight size={18} /></Link><div className="hero-proof"><span><Check size={14} /> Speak in Hindi</span><span><Check size={14} /> Save as you go</span></div></div><div className="hero-art"><CraftIllustration /><span className="art-caption">A little earth. A little patience. A lot of you.</span></div></section>}
    {error && <ErrorNotice retry={() => setRefresh(value => value + 1)}>{error}</ErrorNotice>}
    {loading && !data ? <LoadingPanel label="Gathering your catalogs and orders..." /> : data && <>
      {view === 'studio' && <section className="stats-grid" aria-label="Studio overview">{[
        { label: 'Your catalogs', value: data.catalogs.length, icon: BookOpen, note: 'Ideas taking shape' },
        { label: 'On the marketplace', value: published, icon: Store, note: 'Ready to be discovered' },
        { label: 'Work in progress', value: drafts, icon: Clock3, note: 'Continue at your own pace' },
        { label: 'Orders received', value: data.commerceAvailable ? data.orders.length : '--', icon: ShoppingBag, note: data.commerceAvailable ? 'From the marketplace' : 'Marketplace unavailable' },
      ].map(({ label, value, icon: Icon, note }) => <article className="stat-card" key={label}><div><span>{label}</span><Icon size={19} strokeWidth={1.5} /></div><strong>{value}</strong><p>{note}</p></article>)}</section>}
      {view !== 'orders' && <section className="catalog-section"><div className="section-heading"><div><span className="eyebrow">MADE WITH YOUR HANDS</span><h2>{view === 'studio' ? 'Your catalogs' : 'All catalogs'} <span className="count-pill">{data.catalogs.length}</span></h2></div>{view === 'studio' ? <Link className="text-link" href="/catalogs">View all catalogs <ArrowUpRight size={17} /></Link> : <button disabled={loading} className="button secondary small-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh</button>}</div>
        <div className="collection-toolbar"><div className="filter-tabs" aria-label="Filter catalogs">{[['all', 'All catalogs'], ['drafts', 'In progress'], ['published', 'Published']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} aria-pressed={filter === value} className={filter === value ? 'selected' : ''}>{label}</button>)}</div><label className="search-field"><Search size={17} /><input aria-label="Search catalogs" placeholder="Find a creation..." value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        {catalogs.length ? <div className="catalog-grid">{(view === 'studio' ? catalogs.slice(0, 5) : catalogs).map(catalog => {
          const image = catalog.processedImages[0] ?? catalog.rawImages[0];
          const url = safeProductUrl(catalog.productUrl);
          return <article className="catalog-card" key={catalog.id}><Link href={`/catalogs/${catalog.id}`} className="catalog-image" tabIndex={-1} aria-hidden="true">{image ? <img src={image} alt="" loading="lazy" /> : <div className="photo-placeholder"><Camera size={38} strokeWidth={1} /><span>A new story starts here</span></div>}<StatusBadge status={catalog.status} /></Link><div className="catalog-card-body"><span className="catalog-category">{catalog.category ?? 'YOUR NEXT CREATION'}</span><h3><Link href={`/catalogs/${catalog.id}`}>{catalog.title || 'Untitled handmade creation'}</Link></h3>{catalog.hindiTitle && <p className="hindi-title" lang="hi">{catalog.hindiTitle}</p>}<div className="catalog-details"><strong>{catalog.finalPrice !== null ? rupees(catalog.finalPrice) : 'Price not set'}</strong><span>{catalog.finalPrice !== null ? `${catalog.stock} in stock` : stepNames[resumeStep(catalog)]}</span></div><div className="catalog-card-footer"><Link href={`/catalogs/${catalog.id}`} className="text-link">{catalog.status === 'PUBLISHED' ? 'Edit catalog' : catalog.status === 'FAILED' ? 'Review & retry' : 'Continue catalog'} <ArrowRight size={15} /></Link>{catalog.status === 'PUBLISHED' && url ? <a href={url} target="_blank" rel="noopener noreferrer" className="icon-button" aria-label={`View ${catalog.title ?? 'product'} on marketplace`}><ArrowUpRight size={18} /></a> : <span className="save-date">{dateLabel(catalog.updatedAt)}</span>}</div></div></article>;
        })}{view === 'studio' && <Link href="/catalogs/new" className="new-catalog-tile"><span><Plus size={27} strokeWidth={1.4} /></span><h3>What are you making next?</h3><p>Give your next creation<br />a place in the world.</p><strong>Create a catalog <ArrowRight size={15} /></strong></Link>}</div> : <EmptyState title={data.catalogs.length ? 'No creations found' : 'Your first creation belongs here'} action={data.catalogs.length ? <button className="button secondary" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button> : <Link href="/catalogs/new" className="button primary"><Plus size={17} /> Create your first catalog</Link>}>{data.catalogs.length ? 'Try another name or show all your catalogs.' : 'Start with three photographs and the story only you can tell.'}</EmptyState>}
      </section>}
      {view !== 'catalogs' && <section className="orders-section"><div className="section-heading"><div><span className="eyebrow">FROM THE MARKETPLACE</span><h2>{view === 'studio' ? 'Recent orders' : 'Your orders'}</h2></div>{view === 'studio' ? <Link href="/orders" className="text-link">View all orders <ArrowUpRight size={17} /></Link> : <button disabled={loading} className="button secondary small-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh orders</button>}</div>
        {!data.commerceAvailable ? <div className="notice connection-notice"><Package size={23} /><div><strong>The marketplace is taking a little pause.</strong><p>{data.error ?? 'Orders are temporarily unavailable. Your saved catalogs are safe.'}</p></div><button className="button secondary small-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : <>{view === 'orders' && <div className="orders-summary"><div><span>Total orders</span><strong>{data.orders.length}</strong></div><div><span>Units ordered</span><strong>{data.orders.reduce((sum, order) => sum + order.quantity, 0)}</strong></div><div><span>Order value</span><strong>{rupees(data.orders.reduce((sum, order) => sum + order.total, 0))}</strong></div><span className="badge">Demo payments</span></div>}{view === 'orders' && <label className="search-field order-search"><Search size={17} /><input aria-label="Search orders" placeholder="Search product, customer or order ID..." value={search} onChange={event => setSearch(event.target.value)} /></label>}{orders.length ? <div className="order-list">{(view === 'studio' ? orders.slice(0, 4) : orders).map(order => <article className="order-row" key={order.id}><div className="order-product">{order.product.images[0] ? <img src={order.product.images[0]} alt="" loading="lazy" /> : <span className="order-placeholder"><Package /></span>}<div><h3>{order.product.title}</h3><p>{order.buyerName} <span aria-hidden="true">/</span> {dateLabel(order.createdAt)}</p><span className="order-id">Order {order.id}</span></div></div><div className="order-quantity">{order.quantity} {order.quantity === 1 ? 'piece' : 'pieces'}</div><strong className="order-total">{rupees(order.total)}</strong><span className="badge badge-published">{order.status === 'PAID' ? 'Paid' : order.status === 'DISPATCHED' ? 'Dispatched' : 'Delivered'}</span>{view === 'orders' && <details className="order-delivery"><summary>Delivery details</summary><p>{order.address}</p><p>{order.buyerEmail}</p></details>}</article>)}</div> : <EmptyState title={search ? 'No matching orders' : 'The next chapter starts with an order.'}>{search ? 'Try another product, customer name, or order ID.' : 'When someone buys your work, their order will appear here. All payments in this workspace are demo payments.'}</EmptyState>}</>}
      </section>}
    </>}
    {view === 'studio' && <section className="process-strip"><div><span className="eyebrow">SIMPLE BY DESIGN</span><h2>From a photograph to a possibility.</h2></div><div className="process-strip-steps"><span><Camera size={20} /> 3 photographs</span><ArrowRight size={15} /><span><Mic size={20} /> Your story</span><ArrowRight size={15} /><span><Store size={20} /> A live listing</span></div><Link href="/guide" className="text-link">See how it works <ArrowUpRight size={16} /></Link></section>}
  </div>;
}
