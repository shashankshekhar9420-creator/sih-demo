import type { Metadata } from 'next';
import { Header, Footer } from '@/components/site';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Sahaj | Objects with a story', template: '%s | Sahaj' }, description: 'Discover thoughtful, handmade pieces and the independent Indian artisans behind them.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /></body></html>;
}
