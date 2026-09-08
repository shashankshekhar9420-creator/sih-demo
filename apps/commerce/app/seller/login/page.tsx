import { redirect } from 'next/navigation';
import { Flower2, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { sellerSession } from '@/lib/auth';
import { LoginForm } from '@/components/seller-controls';

export const metadata = { title: 'Seller sign in', robots: { index: false, follow: false } };
export default async function LoginPage() {
  if (await sellerSession()) redirect('/seller/dashboard');
  return <div className="wrap login-page"><div className="login-art"><img src="/art/hero.svg" alt="Handcrafted terracotta and woven objects" width="700" height="850" /><div><Flower2 size={36} strokeWidth={1} /><h2>Your craft.<br />A world of possibility.</h2><p>A simple space to manage the things you make.</p></div></div><div className="login-copy"><span className="eyebrow">The seller studio</span><h1>Welcome back,<br /><em>maker.</em></h1><p>Your products, orders and next chapter, all in one place.</p><LoginForm /><Link className="text-link" href="/">Visit the marketplace <ArrowUpRight size={17} /></Link></div></div>;
}
