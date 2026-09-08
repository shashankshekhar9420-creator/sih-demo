import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categories, questions, publishSchema, publishResultSchema, rupees } from '@sahaj/shared';

test('shared package exports valid categories and questions', () => {
  assert.equal(categories.length, 11);
  assert.ok(categories.includes('Pottery & Terracotta'));
  assert.ok(categories.includes('Handloom & Weaving'));
  assert.ok(categories.includes('Other'));

  assert.equal(questions.length, 3);
  assert.ok(questions[0].hindi.includes('नाम'));
  assert.ok(questions[1].hindi.includes('बनाया'));
  assert.ok(questions[2].hindi.includes('उपयोग'));

  assert.equal(typeof rupees(1250), 'string');
});

test('publish contract validation succeeds on valid mock payload', () => {
  const validPayload = {
    artisanCatalogId: 'test-cat-123',
    sellerId: 'seller-demo',
    title: 'Terracotta Handcrafted Vase',
    hindiTitle: 'टेराकोटा हस्तनिर्मित फूलदान',
    category: 'Pottery & Terracotta',
    description: 'Beautiful traditional earthen vase shaped on wheel.',
    hindiDescription: 'कुम्हार के चाक पर बना पारंपरिक मिट्टी का फूलदान।',
    bullets: ['Made from natural alluvial clay', 'Fired in traditional wood kiln'],
    hindiBullets: ['प्राकृतिक जलोढ़ मिट्टी से निर्मित', 'पारंपरिक भट्टी में पकाया गया'],
    specifics: { Material: 'Terracotta', Height: '25 cm', Weight: '800 g' },
    keywords: ['pottery', 'terracotta', 'vase', 'decor'],
    images: [
      'http://localhost:4000/uploads/cat-1/processed-1.png',
      'http://localhost:4000/uploads/cat-1/processed-2.png',
      'http://localhost:4000/uploads/cat-1/processed-3.png',
    ],
    price: 650,
    stock: 5,
  };

  const parsed = publishSchema.safeParse(validPayload);
  assert.ok(parsed.success, 'Valid payload should parse successfully');

  const mockResult = {
    listingId: 'prod-456',
    productUrl: 'http://localhost:3000/products/terracotta-handcrafted-vase',
    created: true,
  };
  const resultParsed = publishResultSchema.safeParse(mockResult);
  assert.ok(resultParsed.success, 'Valid result should parse successfully');
});

test('publish contract rejects payloads with missing or non-3 images', () => {
  const invalid = {
    artisanCatalogId: 'test-cat-123',
    sellerId: 'seller-demo',
    title: 'Terracotta Vase',
    hindiTitle: 'फूलदान',
    category: 'Pottery & Terracotta',
    description: 'A test vase',
    hindiDescription: 'परीक्षण फूलदान',
    bullets: ['Feature 1'],
    hindiBullets: ['विशेषता 1'],
    specifics: {},
    keywords: ['vase'],
    images: ['http://localhost:4000/uploads/cat-1/processed-1.png'], // only 1 image
    price: 500,
    stock: 1,
  };

  const parsed = publishSchema.safeParse(invalid);
  assert.equal(parsed.success, false, 'Payload with fewer than 3 images must fail validation');
});
