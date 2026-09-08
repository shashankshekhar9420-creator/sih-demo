import { api, catalogId, type CatalogContext } from '../../../../../lib/api';
import { uploadsFromRequest } from '../../../../../lib/uploads';
import { getCatalog, replaceImages } from '../../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, context: CatalogContext) {
  return api(async () => {
    const id = await catalogId(context);
    await getCatalog(id);
    return replaceImages(id, await uploadsFromRequest(request, 'images'));
  });
}
