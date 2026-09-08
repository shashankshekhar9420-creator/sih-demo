import type { Metadata } from 'next';
import { Dashboard } from '../../components/dashboard';
export const metadata: Metadata = { title: 'Orders' };
export default function OrdersPage() { return <Dashboard view="orders" />; }
