import { protectSellerPage } from '@/lib/auth';
import { db } from '@/lib/db';
import { productView } from '@/lib/catalog';
import { ProductEditor } from '@/components/seller-controls';

export default async function SellerProductsPage() {
  const sellerId = await protectSellerPage();
  const products = await db.product.findMany({ where: { sellerId }, include: { seller: true }, orderBy: { createdAt: 'desc' } });
  return <><div className="seller-page-heading"><div><span className="eyebrow">Made by you. Managed here.</span><h1>Your products.</h1><p>Adjust prices, keep stock fresh, and choose what's visible.</p></div><span className="count-label">{products.length} listings</span></div><div className="notice">New listings arrive here when you publish from Artisan Studio. Hiding a piece removes it from the marketplace without deleting its orders.</div><section className="panel seller-products">{products.map(product => <div className="product-editor" key={product.id}><ProductEditor product={productView(product)} /></div>)}{!products.length && <div className="empty-state"><h2>Your collection begins here.</h2><p>Publish from Artisan Studio to see your first listing.</p></div>}</section></>;
}
