import { requireSeller } from '@/lib/auth';
import { endpoint, json } from '@/lib/http';
import { sellerOrders } from '@/lib/orders';

export const GET = endpoint(async () => json(await sellerOrders(await requireSeller())));
