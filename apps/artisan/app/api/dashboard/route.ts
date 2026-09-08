import { artisanOrdersResponseSchema } from '@sahaj/shared';
import { api } from '../../../lib/api';
import { commerceRequest } from '../../../lib/commerce';
import { listCatalogs } from '../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return api(async () => {
    const catalogs = await listCatalogs();
    try {
      const { orders } = artisanOrdersResponseSchema.parse(await commerceRequest('/api/artisan/orders?sellerId=seller-demo'));
      return { catalogs, orders, commerceAvailable: true };
    } catch {
      return { catalogs, orders: [], commerceAvailable: false, error: 'Marketplace orders are unavailable. Your catalogs are still accessible.' };
    }
  });
}
