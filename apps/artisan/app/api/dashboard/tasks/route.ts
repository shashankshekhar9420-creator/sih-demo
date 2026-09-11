import { api } from '../../../../lib/api';
import { computeInventory, computePricingFlags, computeRanked, computeTasks } from '../../../../lib/dashboard/compute';
import { getDashboardData } from '../../../../lib/dashboard/fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return api(async () => {
    const { catalogs, orders, commerceAvailable } = await getDashboardData();
    const ranked = computeRanked(catalogs, orders, commerceAvailable);
    const inventory = computeInventory(catalogs, orders, commerceAvailable);
    const pricingFlags = computePricingFlags(catalogs, new Set(ranked.stagnantCatalogIds));
    return computeTasks({ catalogs, orders, ranked, inventory, pricingFlags });
  });
}
