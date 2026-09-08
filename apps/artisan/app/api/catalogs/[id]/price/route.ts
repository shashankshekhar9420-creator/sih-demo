import { api, catalogId, type CatalogContext, jsonBody } from '../../../../../lib/api';
import { price, priceSchema } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => price(await catalogId(context), priceSchema.parse(await jsonBody(request))));
}
