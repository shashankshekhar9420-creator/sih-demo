import { z, ZodError } from 'zod';
import {
  categorySchema, generatedSchema, moneySchema, publishSchema, publishResultSchema,
  stockSchema, stringsSchema,
} from '@sahaj/shared';
import { type Prisma } from '../generated/client';
import { ApiError } from './api';
import { type Catalog, toCatalog } from './catalog';
import { db } from './db';
import { commerceRequest, integrationUrl } from './commerce';
import { deleteUploads, readUpload, saveUploads, type Upload } from './uploads';

const threeStrings = z.array(z.string().trim().min(1).max(2000)).length(3);
export const emptySchema = z.object({}).strict();
export const processImagesSchema = z.object({ images: threeStrings }).strict();
export const generateSchema = z.object({
  englishTranslations: threeStrings, processedImages: threeStrings, category: categorySchema,
}).strict();
export const priceSchema = z.object({
  materialCost: moneySchema.refine(value => value <= 5000000, 'Material cost is too large.'),
  category: categorySchema, description: generatedSchema.shape.description, keywords: stringsSchema.min(1),
}).strict();
export const patchSchema = generatedSchema.partial().extend({
  category: categorySchema.optional(), finalPrice: moneySchema.optional(),
  recommendedPrice: moneySchema.optional(), stock: stockSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Provide at least one field.');

const clearPricing = { materialCost: null, recommendedPrice: null, finalPrice: null };
const clearContent = {
  title: null, hindiTitle: null, category: null, description: null, hindiDescription: null,
  bulletsJson: '[]', hindiBulletsJson: '[]', specificsJson: '{}', keywordsJson: '[]', ...clearPricing,
};
const clearAudio = {
  audioPathsJson: '[]', audioMimeType: null, sourceLanguage: null,
  regionalTranscriptsJson: '[]', englishTranslationsJson: '[]', ...clearContent,
};

export async function getCatalog(id: string) {
  const row = await db.catalog.findFirst({ where: { id, sellerId: 'seller-demo' } });
  if (!row) throw new ApiError(404, 'Catalog not found.', 'NOT_FOUND');
  return toCatalog(row);
}

export async function listCatalogs() {
  return (await db.catalog.findMany({ where: { sellerId: 'seller-demo' }, orderBy: { createdAt: 'desc' } })).map(toCatalog);
}

export async function createCatalog() {
  return toCatalog(await db.catalog.create({ data: {} }));
}

export async function deleteCatalog(id: string) {
  const row = await db.catalog.findFirst({ where: { id, sellerId: 'seller-demo' } });
  if (!row) throw new ApiError(404, 'Catalog not found.', 'NOT_FOUND');
  if (row.status === 'PROCESSING') throw new ApiError(409, 'Cannot delete a catalog while it is processing.', 'CATALOG_BUSY');
  if (row.commerceListingId) {
    try {
      await commerceRequest('/api/artisan/catalogs/delete', {
        method: 'POST', body: JSON.stringify({ artisanCatalogId: id }),
      });
    } catch {
      // Non-fatal if commerce is unavailable or already deleted
    }
  }
  await deleteUploads(id);
  await db.catalog.delete({ where: { id } });
  return { success: true, id };
}


type MutationResult<T> = { data: Prisma.CatalogUpdateInput; result: T };

// Compare-and-set in SQLite protects across requests/workers, not just one JS process.
async function mutate<T>(id: string, step: string, action: (catalog: Catalog) => Promise<MutationResult<T>>) {
  const row = await db.catalog.findFirst({ where: { id, sellerId: 'seller-demo' } });
  if (!row) throw new ApiError(404, 'Catalog not found.', 'NOT_FOUND');
  if (row.status === 'PROCESSING') throw new ApiError(409, 'This catalog is busy. Please wait and try again.', 'CATALOG_BUSY');
  const lock = await db.catalog.updateMany({
    where: { id, status: row.status, updatedAt: row.updatedAt },
    data: {
      status: 'PROCESSING', processingStep: step, errorMessage: null,
      updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)),
    },
  });
  if (lock.count !== 1) throw new ApiError(409, 'This catalog changed. Refresh and try again.', 'CATALOG_BUSY');
  try {
    const { data, result } = await action(toCatalog(row));
    const saved = await db.catalog.update({ where: { id }, data: {
      ...data, processingStep: null, errorMessage: null,
      updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 2)),
    } });
    return { ...result, catalog: toCatalog(saved) };
  } catch (error) {
    const validation = (error instanceof ApiError && error.status < 500) || error instanceof ZodError;
    const failed = step === 'publish' || !validation;
    const message = step === 'publish'
      ? 'Publishing failed. Check the catalog and marketplace connection, then retry.'
      : 'Processing failed. Please retry this step.';
    try {
      await db.catalog.update({ where: { id }, data: {
        status: failed ? 'FAILED' : row.status, processingStep: null,
        errorMessage: failed ? message : row.errorMessage,
        updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 2)),
      } });
    } catch {
      console.error('[artisan workflow] Could not release catalog lock');
    }
    throw error;
  }
}

function requireStep(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ApiError(409, message, 'INVALID_STATE');
}

function sameStrings(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasContent(catalog: Catalog) {
  return generatedSchema.safeParse(catalog).success && categorySchema.safeParse(catalog.category).success;
}

export function replaceImages(id: string, uploads: Upload[]) {
  return mutate(id, 'upload-images', async () => {
    requireStep(uploads.length === 3, 'Upload exactly three images.');
    const images = await saveUploads(id, 'raw', uploads);
    return {
      // Keep remote identity and existing files: the last published listing may still reference them.
      data: { rawImagesJson: JSON.stringify(images), processedImagesJson: '[]', ...clearAudio, stock: 1, status: 'DRAFT' },
      result: {},
    };
  });
}

export function processImages(id: string, input: z.infer<typeof processImagesSchema>) {
  return mutate(id, 'process-images', async catalog => {
    requireStep(catalog.rawImages.length === 3 && sameStrings(input.images, catalog.rawImages), 'Use the three current raw images for this catalog.');
    const files = await Promise.all(input.images.map(async image => readUpload(image, id, 'raw')));

    // BB1 real engine: sharp (CPU/Node) by default, GPU via Python+REMBG when
    // IMAGE_PROCESSOR=python and scripts/image_processor.py is present.
    // Failures fall back to sharp so the route never 502s on missing models.
    const { enhanceImage } = await import('./image-processor');
    const enhanced = await Promise.all(
      files.map(async file => {
        const outBytes = await enhanceImage({ bytes: file.bytes, extension: file.extension });
        // SaveUploads expects {bytes, extension, mime}; normalise to jpg.
        return { bytes: outBytes, extension: 'jpg' as const, mime: 'image/jpeg' as const };
      }),
    );

    const processedImages = await saveUploads(id, 'processed', enhanced);
    return {
      data: { processedImagesJson: JSON.stringify(processedImages), ...clearAudio, status: 'DRAFT' },
      result: { processedImages, status: 'DRAFT' as const },
    };
  });
}

export function transcribe(id: string, uploads: Upload[]) {
  return mutate(id, 'transcribe', async catalog => {
    requireStep(catalog.processedImages.length === 3, 'Process three images before recording audio.');
    requireStep(uploads.length === 3, 'Provide one recording for each of the three questions.');
    const audioPaths = await saveUploads(id, 'audio', uploads);

    // BB2 real engine: Whisper small + IndicTrans2 via Python when
    // TRANSCRIBE_PROCESSOR=python, otherwise deterministic placeholder.
    // Both preserve the response contract; only the handler body changes.
    const { transcribeWithModels } = await import('./transcribe-processor');
    const buffers = uploads.map(u => u.bytes);
    const exts = uploads.map(u => u.extension);
    const transcripts = await transcribeWithModels(buffers, exts);

    // sourceLanguage = majority vote across 3 audios (usually same speaker)
    const counts = new Map<string, number>();
    for (const t of transcripts) counts.set(t.sourceLanguage, (counts.get(t.sourceLanguage) ?? 0) + 1);
    let sourceLanguage = 'hi';
    let best = 0;
    for (const [lang, n] of counts) if (n > best) { best = n; sourceLanguage = lang; }

    return {
      data: {
        ...clearContent, audioPathsJson: JSON.stringify(audioPaths),
        audioMimeType: uploads.every(upload => upload.mime === uploads[0].mime) ? uploads[0].mime : 'mixed',
        sourceLanguage, regionalTranscriptsJson: JSON.stringify(transcripts.map(item => item.transcript)),
        englishTranslationsJson: JSON.stringify(transcripts.map(item => item.englishTranslation)), status: 'DRAFT',
      },
      result: { transcripts },
    };
  });
}

export function generate(id: string, input: z.infer<typeof generateSchema>) {
  return mutate(id, 'generate', async catalog => {
    requireStep(catalog.audioPaths.length === 3 && catalog.englishTranslations.length === 3, 'Transcribe all three recordings first.');
    requireStep(sameStrings(input.englishTranslations, catalog.englishTranslations), 'Use the current three English translations.');
    requireStep(catalog.processedImages.length === 3 && sameStrings(input.processedImages, catalog.processedImages), 'Use the current three processed images.');
    await Promise.all(input.processedImages.map(image => readUpload(image, id, 'processed')));

    // BB3 real engine: Ollama (local LLM, default mistral:7b-instruct-q4_K_M) via Python when
    // GENERATE_PROCESSOR=python and scripts/generate_processor.py is present.
    // Falls back to deterministic placeholder if Ollama is unavailable or the script is missing.
    // Both paths preserve the route contract; only the handler body changes.
    const { generateWithModel } = await import('./generate-processor');
    const generated = generatedSchema.parse(
      await generateWithModel({
        englishTranslations: input.englishTranslations as [string, string, string],
        category: input.category,
      }),
    );

    const { bullets, hindiBullets, specifics, keywords, ...textFields } = generated;
    return {
      data: {
        ...textFields, category: input.category, bulletsJson: JSON.stringify(bullets),
        hindiBulletsJson: JSON.stringify(hindiBullets), specificsJson: JSON.stringify(specifics),
        keywordsJson: JSON.stringify(keywords), ...clearPricing, status: 'READY',
      },
      result: generated,
    };
  });
}


export function price(id: string, input: z.infer<typeof priceSchema>) {
  return mutate(id, 'price', async catalog => {
    requireStep(hasContent(catalog), 'Generate the catalog before calculating a price.');
    requireStep(input.category === catalog.category && input.description === catalog.description && sameStrings(input.keywords, catalog.keywords), 'Save catalog edits before calculating a price.');
    const recommendedPrice = moneySchema.parse(Math.round(input.materialCost * 2 * 100) / 100);
    return {
      data: { materialCost: input.materialCost, recommendedPrice, finalPrice: recommendedPrice, status: 'READY' },
      result: { recommendedPrice },
    };
  });
}

export function patchCatalog(id: string, input: z.infer<typeof patchSchema>) {
  return mutate(id, 'edit', async catalog => {
    const { bullets, hindiBullets, specifics, keywords, ...fields } = input;
    const contentKeys = Object.keys(input).filter(key => !['category', 'stock'].includes(key));
    requireStep(contentKeys.length === 0 || hasContent(catalog), 'Generate catalog content before editing the review fields.');
    if (input.finalPrice !== undefined || input.recommendedPrice !== undefined) {
      requireStep(catalog.materialCost !== null && catalog.recommendedPrice !== null, 'Calculate pricing before editing prices.');
    }
    const data: Prisma.CatalogUpdateInput = { ...fields };
    if (bullets !== undefined) data.bulletsJson = JSON.stringify(bullets);
    if (hindiBullets !== undefined) data.hindiBulletsJson = JSON.stringify(hindiBullets);
    if (specifics !== undefined) data.specificsJson = JSON.stringify(specifics);
    if (keywords !== undefined) data.keywordsJson = JSON.stringify(keywords);
    // An explicit final price wins; otherwise track a changed recommendation only if not overridden.
    if (input.recommendedPrice !== undefined && input.finalPrice === undefined && catalog.finalPrice === catalog.recommendedPrice) {
      data.finalPrice = input.recommendedPrice;
    }
    data.status = hasContent({ ...catalog, ...input }) ? 'READY' : 'DRAFT';
    return { data, result: {} };
  });
}

export function publish(id: string) {
  return mutate(id, 'publish', async catalog => {
    requireStep(catalog.rawImages.length === 3 && catalog.processedImages.length === 3 && catalog.audioPaths.length === 3 && catalog.englishTranslations.length === 3,
      'Complete images, recordings, and generation before publishing.');
    requireStep(hasContent(catalog) && catalog.materialCost !== null && catalog.recommendedPrice !== null && catalog.finalPrice !== null,
      'Complete catalog content and pricing before publishing.');
    await Promise.all(catalog.processedImages.map(image => readUpload(image, id, 'processed')));
    const payload = publishSchema.parse({
      artisanCatalogId: id, sellerId: catalog.sellerId, title: catalog.title, hindiTitle: catalog.hindiTitle,
      category: catalog.category, description: catalog.description, hindiDescription: catalog.hindiDescription,
      bullets: catalog.bullets, hindiBullets: catalog.hindiBullets, specifics: catalog.specifics, keywords: catalog.keywords,
      images: catalog.processedImages.map(image => new URL(image, integrationUrl('artisan')).href),
      price: catalog.finalPrice, stock: catalog.stock,
    });
    const response = publishResultSchema.safeParse(await commerceRequest('/api/artisan/catalogs/publish', {
      method: 'POST', body: JSON.stringify(payload),
    }));
    if (!response.success) {
      throw new ApiError(502, 'Marketplace returned an invalid publish response. Please retry.', 'COMMERCE_ERROR');
    }
    const result = response.data;
    if (catalog.commerceListingId && result.listingId !== catalog.commerceListingId) {
      throw new ApiError(502, 'Marketplace returned a conflicting listing. Please retry.', 'COMMERCE_ERROR');
    }
    const productUrl = new URL(result.productUrl);
    if (productUrl.origin !== new URL(integrationUrl('commerce')).origin) {
      throw new ApiError(502, 'Marketplace returned an invalid listing URL.', 'COMMERCE_ERROR');
    }
    return {
      data: { commerceListingId: result.listingId, productUrl: result.productUrl, status: 'PUBLISHED' },
      result: { productUrl: result.productUrl, listingId: result.listingId },
    };
  });
}
