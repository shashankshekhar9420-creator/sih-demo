import { api, jsonBody } from '../../../lib/api';
import { uploadsFromRequest } from '../../../lib/uploads';
import { createCatalog, emptySchema, listCatalogs, replaceImages } from '../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return api(async () => ({ catalogs: await listCatalogs() }));
}

export async function POST(request: Request) {
  return api(async () => {
    if (request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
      const uploads = await uploadsFromRequest(request, 'images');
      const catalog = await createCatalog();
      return replaceImages(catalog.id, uploads);
    }
    emptySchema.parse(await jsonBody(request));
    return { catalog: await createCatalog() };
  }, 201);
}
