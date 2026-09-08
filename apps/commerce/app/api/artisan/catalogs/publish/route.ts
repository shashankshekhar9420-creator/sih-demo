import { endpoint } from '@/lib/http';
import { publishCatalog } from '@/lib/publish';

export const POST = endpoint(publishCatalog);
