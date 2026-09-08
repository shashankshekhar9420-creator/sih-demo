import { api, catalogId, type CatalogContext } from '../../../../../lib/api';
import { uploadsFromRequest } from '../../../../../lib/uploads';
import { getCatalog, transcribe } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => {
    const id = await catalogId(context);
    await getCatalog(id);
    return transcribe(id, await uploadsFromRequest(request, 'audio'));
  });
}
