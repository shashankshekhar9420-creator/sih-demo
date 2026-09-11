import 'server-only';
import { artisanOrdersResponseSchema, type ArtisanOrder } from '@sahaj/shared';
import { commerceRequest } from '../commerce';
import { listCatalogs } from '../workflow';
import type { Catalog } from '../catalog';

export type DashboardData = {
  catalogs: Catalog[];
  orders: ArtisanOrder[];
  commerceAvailable: boolean;
};

export async function getDashboardData(): Promise<DashboardData> {
  const catalogs = await listCatalogs();
  try {
    const parsed = artisanOrdersResponseSchema.parse(
      await commerceRequest('/api/artisan/orders?sellerId=seller-demo'),
    );
    return { catalogs, orders: parsed.orders, commerceAvailable: true };
  } catch {
    return { catalogs, orders: [], commerceAvailable: false };
  }
}
