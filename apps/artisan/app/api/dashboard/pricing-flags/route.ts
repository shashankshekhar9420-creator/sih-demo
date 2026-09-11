import { api } from '../../../../lib/api';
import { computePricingFlags, computeRanked } from '../../../../lib/dashboard/compute';
import { getDashboardData } from '../../../../lib/dashboard/fetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return api(async () => {
    const { catalogs, orders, commerceAvailable } = await getDashboardData();
    const ranked = computeRanked(catalogs, orders, commerceAvailable);
    const flagged = computePricingFlags(catalogs, new Set(ranked.stagnantCatalogIds));
    return { items: flagged, commerceAvailable };
  });
}
