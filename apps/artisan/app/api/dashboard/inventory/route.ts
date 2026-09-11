import { api } from '../../../../lib/api';
import { computeInventory } from '../../../../lib/dashboard/compute';
import { getDashboardData } from '../../../../lib/dashboard/fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return api(async () => {
    const { catalogs, orders, commerceAvailable } = await getDashboardData();
    return computeInventory(catalogs, orders, commerceAvailable);
  });
}
