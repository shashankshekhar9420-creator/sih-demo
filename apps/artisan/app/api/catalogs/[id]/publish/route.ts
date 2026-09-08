import { api, catalogId, type CatalogContext, jsonBody } from '../../../../../lib/api';
import { emptySchema, publish } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => {
    const id = await catalogId(context);
    emptySchema.parse(await jsonBody(request));
    return publish(id);
  });
}
