import { endpoint } from '@/lib/http';
import { publishCatalog } from '@/lib/publish';

export const PUT = endpoint(publishCatalog);
