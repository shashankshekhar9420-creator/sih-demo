import { api, catalogId, type CatalogContext, jsonBody } from '../../../../../lib/api';
import { processImages, processImagesSchema } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => processImages(await catalogId(context), processImagesSchema.parse(await jsonBody(request))));
}
