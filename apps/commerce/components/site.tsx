import Link from 'next/link';
import { ArrowUpRight, Flower2, HeartHandshake, MoveRight, Sprout } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import type { ProductView } from '@/lib/catalog';

const artisanStudioUrl = process.env.ARTISAN_APP_URL || process.env.NEXT_PUBLIC_ARTISAN_APP_URL || 'http://localhost:4000';

export function Header() {
  return <><div className="announcement">Made by hand. Chosen with heart. <span>A little closer to the maker.</span></div>
    <header className="site-header wrap"><Link className="brand" href="/" aria-label="Sahaj home"><Flower2 strokeWidth={1.25} size={34} />sahaj<span>THE ARTISAN MARKETPLACE</span></Link>
      <nav aria-label="Main navigation"><Link href="/#collection">The collection</Link><Link href="/#makers">Our makers</Link><a className="seller-link" href={artisanStudioUrl} target="_blank" rel="noopener noreferrer">Seller studio <ArrowUpRight size={16} /></a></nav>
    </header></>;
}
export function Footer() {
  return <footer className="site-footer"><div className="wrap footer-top"><div><Link href="/" className="brand"><Flower2 strokeWidth={1.25} />sahaj</Link><p>Objects with a story.<br />A place for the hands behind them.</p></div><div><span className="eyebrow">Explore slowly</span><Link href="/#collection">Shop the collection</Link><Link href="/#makers">Meet the makers</Link></div><div><span className="eyebrow">Made for connection</span><Link href="/seller/dashboard">Seller dashboard</Link><a href={artisanStudioUrl} target="_blank" rel="noopener noreferrer">Artisan studio <ArrowUpRight size={14} /></a><p>Independent craft. Everyday beauty.</p></div></div><div className="wrap footer-bottom"><span>&copy; {new Date().getFullYear()} Sahaj. A celebration of handmade.</span><span>Local demo · No real payments or deliveries</span></div></footer>;
}
export function ProductCard({ product, index = 0 }: { product: ProductView; index?: number }) {
  return <article className="product-card"><Link href={`/products/${product.slug}`} className="product-image"><img src={product.images[0] || '/art/vase.svg'} alt={product.title} loading={index < 4 ? 'eager' : 'lazy'} width="600" height="700" />
    {!product.stock ? <span className="image-label">Currently sold out</span> : product.stock <= 3 ? <span className="image-label">Just {product.stock} left</span> : <span className="image-label">In stock · Handmade</span>}<span className="image-arrow"><ArrowUpRight size={21} /></span></Link>
    <div className="card-meta"><span>{product.category.split(' & ')[0]}</span><span>{product.seller.location.split(',')[0]}</span></div>
    <Link className="product-title" href={`/products/${product.slug}`}>{product.title}</Link><div className="card-bottom"><span>by {product.seller.name}</span><strong>{rupees(product.price)}</strong></div></article>;
}
export function Values() {
  return <section className="values wrap" aria-label="Our values"><div><Flower2 /><p><strong>Human hands, not assembly lines</strong><span>Thoughtful pieces, with their own character.</span></p></div><div><HeartHandshake /><p><strong>A direct connection to craft</strong><span>Know the person behind every piece.</span></p></div><div><Sprout /><p><strong>Fewer things. More meaning.</strong><span>Small batches, made to be treasured.</span></p></div></section>;
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Flower2 size={40} strokeWidth={1} /><h2>{title}</h2><p>{description}</p><Link className="text-link" href="/">Explore the collection <MoveRight size={18} /></Link></div>;
}
