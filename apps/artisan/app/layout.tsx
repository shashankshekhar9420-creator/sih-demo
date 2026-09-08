import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StudioShell } from '../components/studio-shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Sahaj Studio | A home for your craft', template: '%s | Sahaj Studio' },
  description: 'Photograph your craft, tell its story in your own voice, and share it with the world. Your artisan workspace.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><StudioShell>{children}</StudioShell></body></html>;
}
