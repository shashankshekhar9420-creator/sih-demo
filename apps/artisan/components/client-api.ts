import { z } from 'zod';
import { artisanOrderSchema, categorySchema, generatedSchema, moneySchema, specificsSchema, stockSchema } from '@sahaj/shared';
import type { Catalog } from '../lib/catalog';

const nullableText = z.string().nullable();
const paths = z.array(z.string());
export const catalogSchema: z.ZodType<Catalog> = z.object({
  id: z.string(), sellerId: z.string(), status: z.enum(['DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'FAILED']),
  processingStep: nullableText, rawImages: paths, processedImages: paths, audioPaths: paths,
  audioMimeType: nullableText, sourceLanguage: nullableText, regionalTranscripts: paths, englishTranslations: paths,
  title: nullableText, hindiTitle: nullableText, category: nullableText, bullets: paths, hindiBullets: paths,
  description: nullableText, hindiDescription: nullableText, specifics: specificsSchema, keywords: paths,
  materialCost: moneySchema.nullable(), recommendedPrice: moneySchema.nullable(), finalPrice: moneySchema.nullable(), stock: stockSchema,
  commerceListingId: nullableText, productUrl: nullableText, errorMessage: nullableText, createdAt: z.string(), updatedAt: z.string(),
});
export const catalogResponseSchema = z.object({ catalog: catalogSchema });
export const dashboardSchema = z.object({
  catalogs: z.array(catalogSchema), orders: z.array(artisanOrderSchema), commerceAvailable: z.boolean(), error: z.string().optional(),
});
export const reviewSchema = generatedSchema.extend({ category: categorySchema, recommendedPrice: moneySchema, finalPrice: moneySchema, stock: stockSchema });
export type ReviewValues = z.infer<typeof reviewSchema>;
export type DashboardData = z.infer<typeof dashboardSchema>;

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function request<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, cache: 'no-store' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('We could not connect. Check your connection and try again.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z.object({ error: z.string() }).safeParse(body);
    throw new RequestError(parsed.success ? parsed.data.error : 'Something went wrong. Please try again.', response.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error('The studio received an unexpected response. Please refresh and try again.');
  return parsed.data;
}

export function jsonRequest(method: 'POST' | 'PATCH', body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function resumeStep(catalog: Catalog): number {
  if (catalog.rawImages.length !== 3) return 0;
  if (catalog.processedImages.length !== 3) return 1;
  if (catalog.audioPaths.length !== 3 || catalog.englishTranslations.length !== 3) return 2;
  if (!catalog.title || !catalog.description || !catalog.category) return 3;
  if (catalog.materialCost === null || catalog.recommendedPrice === null || catalog.finalPrice === null) return 4;
  return 6;
}

export function safeProductUrl(value: string | null) {
  if (!value) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
