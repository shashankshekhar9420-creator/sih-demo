import type { Metadata } from 'next';
import { Dashboard } from '../../components/dashboard';
export const metadata: Metadata = { title: 'My catalogs' };
export default function CatalogsPage() { return <Dashboard view="catalogs" />; }
