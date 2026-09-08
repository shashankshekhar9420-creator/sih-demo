'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Languages, Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import type { ProductView } from '@/lib/catalog';

export function ProductDetail({ product }: { product: ProductView }) {
  const [image, setImage] = useState(0);
  const [hindi, setHindi] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const hasHindi = !!(product.hindiTitle || product.hindiDescription || product.hindiBullets.length);
  const title = hindi && product.hindiTitle ? product.hindiTitle : product.title;
  const bullets = hindi && product.hindiBullets.length ? product.hindiBullets : product.bullets;
  return <><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><ChevronRight size={13} /><Link href={`/?category=${encodeURIComponent(product.category)}#collection`}>{product.category}</Link><ChevronRight size={13} /><span>{product.title}</span></nav>
    <div className="detail-grid"><div className="gallery"><div className="gallery-main"><img src={product.images[image] || '/art/vase.svg'} alt={`${product.title}, view ${image + 1}`} width="800" height="900" /><span className="image-label">The beauty is in the details</span></div><div className="gallery-thumbs">{product.images.map((src, i) => <button key={`${src}-${i}`} className={i === image ? 'selected' : ''} onClick={() => setImage(i)} aria-label={`View product image ${i + 1}`} aria-pressed={i === image}><img src={src} alt={`View ${i + 1}`} width="120" height="120" /></button>)}</div></div>
    <div className="detail-copy"><div className="detail-top"><span className="eyebrow">{product.category}</span>{hasHindi && <button className="language-button" aria-pressed={hindi} onClick={() => setHindi(!hindi)}><Languages size={16} />{hindi ? 'English' : 'हिन्दी'}</button>}</div><h1 lang={hindi ? 'hi' : 'en'}>{title}</h1><p className="byline">Handmade by <strong>{product.seller.name}</strong><span>{product.seller.location}</span></p><div className="price-line"><strong>{rupees(product.price)}</strong><span>per piece · Demo pricing</span></div><p className={`stock ${product.stock ? '' : 'sold-out'}`}><span />{product.stock ? `${product.stock} available${product.stock <= 3 ? ' · A small batch, almost gone' : ' · Ready for a new home'}` : 'Currently sold out'}</p><p className="description" lang={hindi ? 'hi' : 'en'}>{hindi && product.hindiDescription ? product.hindiDescription : product.description}</p><ul className="bullet-list" lang={hindi ? 'hi' : 'en'}>{bullets.map((bullet, i) => <li key={i}><Check size={16} />{bullet}</li>)}</ul>
      <div className="buy-bar"><div className="stepper" aria-label="Quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} disabled={quantity >= product.stock} aria-label="Increase quantity"><Plus size={16} /></button></div>{product.stock ? <Link className="button" href={`/products/${product.slug}/buy?quantity=${quantity}`}>Buy now <ChevronRight size={18} /></Link> : <button className="button" disabled>Sold out</button>}</div><p className="demo-note"><ShieldCheck size={15} />Demo checkout. No payment is collected.</p><div className="detail-assurance"><Truck size={20} /><span>A small piece of someone's craft.<br /><strong>Made slowly. Chosen thoughtfully.</strong></span></div>
      <details open className="specifics"><summary>The finer details</summary><dl>{Object.entries(product.specifics).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>{!Object.keys(product.specifics).length && <p>Every handmade piece has its own natural character.</p>}</details><details className="specifics"><summary>Meet your maker</summary><h3>{product.seller.name}</h3><p>{product.seller.story}</p><p>{product.seller.location}</p></details><div className="keyword-list">{product.keywords.map(keyword => <Link href={`/?search=${encodeURIComponent(keyword)}#collection`} key={keyword}>{keyword}</Link>)}</div>
    </div></div></>;
}
