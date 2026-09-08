'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, BookOpen, LayoutDashboard, Leaf, Package, Plus, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';

export function StudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const links = [
    { href: '/', label: 'My studio', icon: LayoutDashboard, active: pathname === '/' },
    { href: '/catalogs', label: 'My catalogs', icon: BookOpen, active: pathname.startsWith('/catalogs') },
    { href: '/orders', label: 'Orders', icon: ShoppingBag, active: pathname === '/orders' },
  ];
  return <div className="studio-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Sahaj Studio home"><span className="brand-mark"><Leaf size={26} strokeWidth={1.4} /></span><span>Sahaj<span className="brand-sub">ARTISAN STUDIO</span></span></Link>
      <span className="sidebar-caption">A SPACE FOR YOUR CRAFT</span>
      <nav className="main-nav" aria-label="Main navigation">{links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} className={active ? 'nav-link active' : 'nav-link'} aria-current={active ? 'page' : undefined}><Icon size={19} /><span>{label}</span>{active && <span className="nav-dot" />}</Link>)}</nav>
      <Link href="/catalogs/new" className="button primary sidebar-create"><Plus size={19} /> New catalog</Link>
      <div className="sidebar-note"><span className="small-emblem"><Leaf size={23} /></span><h3>Made by hand.<br />Shared with the world.</h3><p>Your craft has a story.<br />Let&apos;s help it find a home.</p><Link href="/guide">How the studio works <ArrowUpRight size={15} /></Link></div>
      <div className="artisan-profile"><span className="avatar">SA</span><div><strong>Sahaj Artisan</strong><span>Demo workspace</span></div><Package size={17} /></div>
    </aside>
    <div className="studio-body">
      <header className="topbar"><Link href="/" className="mobile-brand"><Leaf size={21} /> Sahaj Studio</Link><span className="desktop-breadcrumb">Your craft. Your voice. Your business.</span><span className="workspace-label"><span className="status-dot" /> Artisan workspace</span><span className="avatar small">SA</span></header>
      <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({ href, label, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''}><Icon size={17} />{label}</Link>)}</nav>
      <main id="main-content" className="main-content">{children}</main>
      <footer className="site-footer"><span>Sahaj Studio</span><span>Thoughtfully made for the hands that make.</span><Link href="/guide">Studio guide <ArrowUpRight size={13} /></Link></footer>
    </div>
  </div>;
}
