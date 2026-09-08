import { api, catalogId, type CatalogContext, jsonBody } from '../../../../../lib/api';
import { generate, generateSchema } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => generate(await catalogId(context), generateSchema.parse(await jsonBody(request))));
}
