import Link from 'next/link';
import { Sprout } from 'lucide-react';
export default function NotFound() {
  return <div className="page-recovery"><Sprout size={42} strokeWidth={1.3} /><span className="eyebrow">NOT FOUND</span><h1>This little corner is empty.</h1><p>That page or catalog may not exist. Find your creations back in the studio.</p><Link href="/" className="button primary">Back to my studio</Link></div>;
}
