import { redirect } from 'next/navigation';
import { protectSellerPage } from '@/lib/auth';
export default async function SellerPage() { await protectSellerPage(); redirect('/seller/dashboard'); }
