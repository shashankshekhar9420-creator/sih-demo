import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, api, jsonBody } from './api';
import { toCatalog } from './catalog';
import { readUpload, uploadsFromRequest } from './uploads';
import { createCatalog, deleteCatalog, getCatalog } from './workflow';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

function imageRequest(count = 3, bytes: Uint8Array = png, type = 'image/png') {
  const form = new FormData();
  for (let index = 0; index < count; index++) {
    form.append('images', new Blob([new Uint8Array(bytes)], { type }), '../unsafe.png');
  }
  return new Request('http://localhost/api/catalogs', { method: 'POST', body: form });
}

test('accepts exactly three genuine PNGs without using supplied filenames', async () => {
  const uploads = await uploadsFromRequest(imageRequest(), 'images');
  assert.equal(uploads.length, 3);
  assert.equal(uploads[0].extension, 'png');
  assert.deepEqual(uploads[0].bytes, png);
});

test('rejects wrong counts, forged signatures, mismatched MIME, and oversized images', async () => {
  for (const request of [
    imageRequest(2), imageRequest(4), imageRequest(3, Buffer.from('not an image')),
    imageRequest(3, png, 'image/jpeg'), imageRequest(3, new Uint8Array(10 * 1024 * 1024 + 1)),
  ]) {
    await assert.rejects(uploadsFromRequest(request, 'images'), ApiError);
  }
});

test('question field names determine transcript order regardless of multipart order', async () => {
  const form = new FormData();
  for (const question of [3, 1, 2]) {
    form.append(`audio${question}`, new Blob([String(question)], { type: 'audio/webm;codecs=opus' }), 'recording.webm');
  }
  const uploads = await uploadsFromRequest(new Request('http://localhost', { method: 'POST', body: form }), 'audio');
  assert.deepEqual(uploads.map(upload => upload.bytes.toString()), ['1', '2', '3']);
  assert.ok(uploads.every(upload => upload.mime === 'audio/webm'));
});

test('rejects duplicate audio question fields and unsupported audio types', async () => {
  for (const [keys, type] of [
    [['audio1', 'audio1', 'audio3'], 'audio/webm'],
    [['audio1', 'audio2', 'audio3'], 'text/html'],
    [['audio1', 'audio2', 'audio3'], '__proto__'],
  ] as const) {
    const form = new FormData();
    for (const key of keys) form.append(key, new Blob(['test'], { type }), 'recording');
    await assert.rejects(uploadsFromRequest(new Request('http://localhost', { method: 'POST', body: form }), 'audio'), ApiError);
  }
});

test('rejects traversal, remote URLs, and other catalog upload paths', async () => {
  for (const url of [
    '/uploads/../artisan.db', '/uploads/demo/%2e%2e/secret.png', 'http://localhost/image.png',
    '/uploads/other/raw-00000000-0000-0000-0000-000000000000.png',
  ]) {
    await assert.rejects(readUpload(url, 'demo', 'raw'), ApiError);
  }
});

test('invalid JSON and unexpected exceptions use safe error responses', async () => {
  const invalid = await api(async () => jsonBody(new Request('http://localhost', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  })));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'VALIDATION_ERROR');
  const failure = await api(async () => { throw new Error('secret key and internal stack'); });
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' });
});

test('catalog DTO parses all JSON fields and serializes timestamps', () => {
  const row = {
    id: 'demo', sellerId: 'seller-demo', status: 'DRAFT' as const, processingStep: null,
    rawImagesJson: '["/uploads/raw.png"]', processedImagesJson: '[]', audioPathsJson: '[]',
    audioMimeType: null, sourceLanguage: null, regionalTranscriptsJson: '[]', englishTranslationsJson: '[]',
    title: null, hindiTitle: null, category: null, description: null, hindiDescription: null,
    bulletsJson: '[]', hindiBulletsJson: '[]', specificsJson: '{"material":"cotton"}', keywordsJson: '[]',
    materialCost: null, recommendedPrice: null, finalPrice: null, stock: 1,
    commerceListingId: null, productUrl: null, errorMessage: null,
    createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z'),
  };
  const catalog = toCatalog(row);
  assert.deepEqual(catalog.rawImages, ['/uploads/raw.png']);
  assert.deepEqual(catalog.specifics, { material: 'cotton' });
  assert.equal(catalog.updatedAt, '2026-01-02T00:00:00.000Z');
  assert.ok(Object.keys(catalog).every(key => !key.endsWith('Json')));
  assert.deepEqual(JSON.parse(JSON.stringify(catalog)), catalog);
});

test('createCatalog and deleteCatalog correctly manages lifecycle and cleanup', async () => {
  const catalog = await createCatalog();
  assert.ok(catalog.id);
  const found = await getCatalog(catalog.id);
  assert.equal(found.id, catalog.id);
  const del = await deleteCatalog(catalog.id);
  assert.equal(del.success, true);
  await assert.rejects(getCatalog(catalog.id), ApiError);
});

