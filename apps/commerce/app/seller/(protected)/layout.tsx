import Link from 'next/link';
import { LayoutDashboard, Package, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { protectSellerPage } from '@/lib/auth';
import { LogoutButton } from '@/components/seller-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Seller studio', robots: { index: false, follow: false } };
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  await protectSellerPage();
  return <div className="seller-shell wrap"><aside className="seller-sidebar"><span className="eyebrow">Your workspace</span><h2>Seller studio<span>.</span></h2><nav aria-label="Seller navigation"><Link href="/seller/dashboard"><LayoutDashboard size={18} />Overview</Link><Link href="/seller/products"><Package size={18} />Products</Link><Link href="/seller/orders"><ShoppingBag size={18} />Orders</Link></nav><div className="sidebar-bottom"><Link className="text-link" href="/">View marketplace <ArrowUpRight size={16} /></Link><LogoutButton /></div></aside><div className="seller-content">{children}</div></div>;
}
