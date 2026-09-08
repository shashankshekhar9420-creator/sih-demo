'use client';
import Link from 'next/link';
import { ErrorNotice } from '../components/ui';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-recovery"><span className="eyebrow">A LITTLE PAUSE</span><h1>Let&apos;s try that again.</h1><p>Your saved catalogs are still in your studio.</p><ErrorNotice retry={reset}>We couldn&apos;t open this page. Please try again.</ErrorNotice><Link href="/" className="button secondary">Back to my studio</Link></div>;
}
