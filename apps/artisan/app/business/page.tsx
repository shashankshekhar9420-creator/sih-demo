import type { Metadata } from 'next';
import { BusinessDashboard } from '../../components/business/business-dashboard';

export const metadata: Metadata = { title: 'Business Manager' };

export default function BusinessPage() {
  return <BusinessDashboard />;
}
