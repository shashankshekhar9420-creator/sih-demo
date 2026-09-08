import { requireSeller } from '@/lib/auth';
import { endpoint, json } from '@/lib/http';
import { sellerDashboard } from '@/lib/orders';

export const GET = endpoint(async () => json(await sellerDashboard(await requireSeller())));
