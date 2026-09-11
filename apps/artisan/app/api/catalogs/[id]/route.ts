import { api, catalogId, type CatalogContext, jsonBody } from '../../../../lib/api';
import { deleteCatalog, getCatalog, patchCatalog, patchSchema } from '../../../../lib/workflow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: CatalogContext) {
  return api(async () => ({ catalog: await getCatalog(await catalogId(context)) }));
}

export async function PATCH(request: Request, context: CatalogContext) {
  return api(async () => patchCatalog(await catalogId(context), patchSchema.parse(await jsonBody(request))));
}

export async function DELETE(_request: Request, context: CatalogContext) {
  return api(async () => deleteCatalog(await catalogId(context)));
}

