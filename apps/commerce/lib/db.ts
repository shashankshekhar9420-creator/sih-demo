import 'server-only';
import { PrismaClient } from '@/generated/client';

const globalDb = globalThis as unknown as { commerceDb?: PrismaClient };
export const db = globalDb.commerceDb || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.commerceDb = db;
