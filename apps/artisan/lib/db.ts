import 'server-only';
import { PrismaClient } from '../generated/client';

const globalDb = globalThis as unknown as { artisanDb?: PrismaClient };
export const db = globalDb.artisanDb ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.artisanDb = db;
