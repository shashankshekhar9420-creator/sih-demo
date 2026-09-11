import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { generatedSchema } from '@sahaj/shared';
import { placeholderGenerate, generateWithModel, type GenerateInput } from './generate-processor';
import { db } from './db';
import { createCatalog, generate, getCatalog } from './workflow';
import { saveUploads, type Upload } from './uploads';
import { ApiError } from './api';

const sampleInput: GenerateInput = {
  englishTranslations: [
    'Handmade Terracotta Planter made of alluvial clay.',
    'Kiln fired with carved traditional motifs, 15 cm height, 500 grams.',
    'Used for indoor planting and balcony garden decor.',
  ],
  category: 'Pottery & Terracotta',
};

test('placeholderGenerate produces valid schema conforming to generatedSchema', () => {
  const result = placeholderGenerate(sampleInput);

  // Validate through the shared Zod contract gate
  const parsed = generatedSchema.safeParse(result);
  assert.ok(parsed.success, `Schema validation failed: ${JSON.stringify(parsed.error?.format())}`);

  // Field integrity checks
  assert.ok(result.title.includes('Pottery & Terracotta'));
  assert.ok(result.description.length > 20);
  assert.equal(result.bullets.length, 3);
  assert.equal(result.hindiBullets.length, 5);
  assert.ok(result.keywords.includes('Pottery & Terracotta'));
  assert.ok(Object.keys(result.specifics).length > 0);

  // Devanagari script checks
  const devanagariRegex = /[\u0900-\u097F]/;
  assert.match(result.hindiTitle, devanagariRegex, 'hindiTitle must contain Devanagari script');
  assert.match(result.hindiDescription, devanagariRegex, 'hindiDescription must contain Devanagari script');
  assert.ok(
    result.hindiBullets.every(b => devanagariRegex.test(b)),
    'All hindiBullets must contain Devanagari script',
  );
});

test('generateWithModel resolves successfully with valid schema via fallback when Ollama is offline', async () => {
  const result = await generateWithModel(sampleInput);

  // Ensure result satisfies the strict Zod schema
  const parsed = generatedSchema.safeParse(result);
  assert.ok(parsed.success, `generateWithModel result must satisfy generatedSchema: ${JSON.stringify(parsed.error?.format())}`);

  assert.ok(typeof result.title === 'string' && result.title.length > 0);
  assert.ok(typeof result.hindiTitle === 'string' && result.hindiTitle.length > 0);
  assert.ok(typeof result.description === 'string' && result.description.length > 0);
  assert.ok(typeof result.hindiDescription === 'string' && result.hindiDescription.length > 0);
  assert.ok(Array.isArray(result.bullets) && result.bullets.length >= 3);
  assert.ok(Array.isArray(result.hindiBullets) && result.hindiBullets.length >= 3);
  assert.ok(Array.isArray(result.keywords) && result.keywords.length >= 3);
  assert.ok(typeof result.specifics === 'object' && result.specifics !== null);
});

test('workflow generate step enforces preconditions, invokes generator, and updates database', async () => {
  // 1. Create a fresh draft catalog
  const catalog = await createCatalog();
  const catalogId = catalog.id;

  try {
    // 2. Reject if images or audio are missing
    await assert.rejects(
      generate(catalogId, {
        englishTranslations: sampleInput.englishTranslations,
        processedImages: ['/uploads/dummy1.png', '/uploads/dummy2.png', '/uploads/dummy3.png'],
        category: 'Pottery & Terracotta',
      }),
      ApiError,
    );

    // 3. Prepare real processed image files and set up catalog prerequisites in DB
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const dummyUploads: Upload[] = [
      { bytes: pngBytes, extension: 'png', mime: 'image/png' },
      { bytes: pngBytes, extension: 'png', mime: 'image/png' },
      { bytes: pngBytes, extension: 'png', mime: 'image/png' },
    ];
    const processedPaths = await saveUploads(catalogId, 'processed', dummyUploads);

    await db.catalog.update({
      where: { id: catalogId },
      data: {
        rawImagesJson: JSON.stringify(processedPaths),
        processedImagesJson: JSON.stringify(processedPaths),
        audioPathsJson: JSON.stringify(['/uploads/dummy1.webm', '/uploads/dummy2.webm', '/uploads/dummy3.webm']),
        englishTranslationsJson: JSON.stringify(sampleInput.englishTranslations),
        regionalTranscriptsJson: JSON.stringify(['प्रश्न 1', 'प्रश्न 2', 'प्रश्न 3']),
        sourceLanguage: 'hi',
        status: 'READY',
      },
    });

    // 4. Trigger workflow generate()
    const response = await generate(catalogId, {
      englishTranslations: sampleInput.englishTranslations,
      processedImages: processedPaths as [string, string, string],
      category: 'Pottery & Terracotta',
    });
    const updated = response.catalog;

    // 5. Verify returned result and updated catalog
    assert.equal(updated.status, 'READY');
    assert.equal(updated.category, 'Pottery & Terracotta');
    assert.ok(typeof updated.title === 'string' && updated.title.length > 0);
    assert.ok(typeof updated.hindiTitle === 'string' && updated.hindiTitle.length > 0);
    assert.ok(typeof updated.description === 'string' && updated.description.length > 0);
    assert.ok(typeof updated.hindiDescription === 'string' && updated.hindiDescription.length > 0);
    assert.ok(updated.bullets.length >= 3);
    assert.ok(updated.hindiBullets.length >= 3);
    assert.ok(updated.keywords.length >= 3);

    // Ensure database row matches
    const persisted = await getCatalog(catalogId);
    assert.equal(persisted.title, updated.title);
    assert.equal(persisted.hindiTitle, updated.hindiTitle);
    assert.deepEqual(persisted.bullets, updated.bullets);
    assert.deepEqual(persisted.hindiBullets, updated.hindiBullets);
  } finally {
    // Clean up
    await db.catalog.deleteMany({ where: { id: catalogId } }).catch(() => {});
    await rm(path.resolve(process.cwd(), 'public', 'uploads', catalogId), { recursive: true, force: true }).catch(() => {});
  }
});
