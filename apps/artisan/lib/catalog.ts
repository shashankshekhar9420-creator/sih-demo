import { parseSpecifics, parseStrings } from '@sahaj/shared';

export type CatalogStatus = 'DRAFT' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'FAILED';

// This public DTO deliberately has no dependency on the generated Prisma client.
export type Catalog = {
  id: string;
  sellerId: string;
  status: CatalogStatus;
  processingStep: string | null;
  rawImages: string[];
  processedImages: string[];
  audioPaths: string[];
  audioMimeType: string | null;
  sourceLanguage: string | null;
  regionalTranscripts: string[];
  englishTranslations: string[];
  title: string | null;
  hindiTitle: string | null;
  category: string | null;
  bullets: string[];
  hindiBullets: string[];
  description: string | null;
  hindiDescription: string | null;
  specifics: Record<string, string>;
  keywords: string[];
  materialCost: number | null;
  recommendedPrice: number | null;
  finalPrice: number | null;
  stock: number;
  commerceListingId: string | null;
  productUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type JsonField = 'rawImages' | 'processedImages' | 'audioPaths' | 'regionalTranscripts' |
  'englishTranslations' | 'bullets' | 'hindiBullets' | 'specifics' | 'keywords';
type CatalogRow = Omit<Catalog, JsonField | 'createdAt' | 'updatedAt'> &
  Record<`${JsonField}Json`, string> & { createdAt: Date; updatedAt: Date };

export function toCatalog(row: CatalogRow): Catalog {
  const {
    rawImagesJson, processedImagesJson, audioPathsJson, regionalTranscriptsJson,
    englishTranslationsJson, bulletsJson, hindiBulletsJson, specificsJson,
    keywordsJson, createdAt, updatedAt, ...fields
  } = row;
  return {
    ...fields,
    rawImages: parseStrings(rawImagesJson), processedImages: parseStrings(processedImagesJson),
    audioPaths: parseStrings(audioPathsJson), regionalTranscripts: parseStrings(regionalTranscriptsJson),
    englishTranslations: parseStrings(englishTranslationsJson), bullets: parseStrings(bulletsJson),
    hindiBullets: parseStrings(hindiBulletsJson), specifics: parseSpecifics(specificsJson),
    keywords: parseStrings(keywordsJson), createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString(),
  };
}
