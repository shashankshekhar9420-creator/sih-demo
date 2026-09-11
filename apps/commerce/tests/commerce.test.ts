import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { artisanOrdersResponseSchema, publishResultSchema } from '@sahaj/shared';
import { PrismaClient } from '../generated/client';

// Run after db:setup + seed with the commerce dev/start server listening on port 3000.
const base = process.env.COMMERCE_APP_URL || 'http://localhost:3000';
const artisan = process.env.ARTISAN_APP_URL || 'http://localhost:4000';
const db = new PrismaClient();
const catalogId = `commerce-test-${randomUUID()}`;
const foreignProductId = `commerce-test-${randomUUID()}`;
const headers = { 'Content-Type': 'application/json', 'x-demo-api-key': process.env.DEMO_API_KEY || 'local-demo-key' };
let listingId: string;
let cookie: string;
let slug: string;
let receipt: string;
let orderId: string;
const payload = { artisanCatalogId: catalogId, sellerId: 'seller-demo', title: 'Integration Test Vase', hindiTitle: 'परीक्षण फूलदान', category: 'Pottery & Terracotta', description: 'A test listing for local commerce verification.', hindiDescription: 'स्थानीय परीक्षण के लिए फूलदान।', bullets: ['Made by hand'], hindiBullets: ['हाथ से बना'], specifics: { Material: 'Clay' }, keywords: ['test'], images: [1, 2, 3].map(i => `${artisan}/uploads/test-${i}.png`), price: 123.45, stock: 2 };
const buyer = { buyerName: 'Demo Buyer', buyerEmail: 'test@example.test', address: '12 Demo Lane, Jaipur 302001', quantity: 1 };
async function api(path: string, init?: RequestInit) {
  const response = await fetch(new URL(path, base), init);
  const body = await response.json();
  return { response, body };
}
after(async () => {
  await db.order.deleteMany({ where: { product: { artisanCatalogId: catalogId } } });
  await db.product.deleteMany({ where: { OR: [{ artisanCatalogId: catalogId }, { id: foreignProductId }] } });
  await db.$disconnect();
});

test('commerce end-to-end contracts and safety', async t => {
  await t.test('seller pages and APIs reject missing and forged sessions', async () => {
    for (const path of ['/api/seller/dashboard', '/api/seller/products', '/api/seller/orders']) {
      const { response, body } = await api(path, { headers: { Cookie: 'sahaj-seller=forged.payload' } });
      assert.equal(response.status, 401); assert.equal(body.code, 'UNAUTHORIZED');
    }
    for (const path of ['/seller', '/seller/dashboard', '/seller/products', '/seller/orders']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.equal(response.status, 307); assert.ok(response.headers.get('location')?.includes('/seller/login'));
    }
    for (const path of ['/api/seller/products/anything', '/api/seller/orders/anything']) {
      assert.equal((await api(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).response.status, 401);
    }
  });
  await t.test('publish validates key, schema and image origin', async () => {
    const path = '/api/artisan/catalogs/publish';
    assert.equal((await api(path, { method: 'POST', body: JSON.stringify(payload) })).response.status, 401);
    assert.equal((await api(path, { method: 'POST', headers, body: '{' })).response.status, 400);
    assert.equal((await api(path, { method: 'POST', headers, body: JSON.stringify({ ...payload, price: -1 }) })).response.status, 400);
    assert.equal((await api(path, { method: 'POST', headers, body: JSON.stringify({ ...payload, images: ['http://evil.test/a', ...payload.images.slice(1)] }) })).response.status, 400);
    const { response, body } = await api(path, { method: 'POST', headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    const result = publishResultSchema.parse(body);
    assert.equal(result.created, true); listingId = result.listingId; slug = new URL(result.productUrl).pathname.split('/').pop()!;
    assert.equal((await fetch(result.productUrl)).status, 200);
  });
  await t.test('publish and update preserve ID and slug across retries and title changes', async () => {
    for (const [path, method] of [['publish', 'POST'], ['update', 'PUT']]) {
      const { response, body } = await api(`/api/artisan/catalogs/${path}`, { method, headers, body: JSON.stringify({ ...payload, title: 'A Changed Test Title' }) });
      assert.equal(response.status, 200); assert.equal(body.created, false); assert.equal(body.listingId, listingId); assert.ok(body.productUrl.endsWith(`/products/${slug}`));
    }
    assert.equal(await db.product.count({ where: { artisanCatalogId: catalogId } }), 1);
  });
  await t.test('catalog search, category, sorting and safe validation', async () => {
    const found = await api('/api/products?search=A%20Changed%20Test%20Title&category=Pottery%20%26%20Terracotta&sort=newest');
    assert.equal(found.response.status, 200); assert.equal(found.body.products.length, 1); assert.equal(found.body.products[0].id, listingId);
    for (const sort of ['price-asc', 'price-desc']) {
      const { body } = await api(`/api/products?sort=${sort}`);
      const prices = body.products.map((p: { price: number }) => p.price);
      assert.deepEqual(prices, [...prices].sort((a, b) => sort === 'price-asc' ? a - b : b - a));
    }
    assert.equal((await api('/api/products?sort=wrong')).response.status, 400);
    assert.equal((await api('/api/products?category=wrong')).response.status, 400);
    const detail = await api(`/api/products/${slug}`);
    assert.equal(detail.body.product.images.length, 3); assert.equal(detail.body.product.price, 123.45);
    assert.equal((await api('/api/products/not-a-product')).response.status, 404);
  });
  await t.test('login uses a signed HTTP-only cookie', async () => {
    assert.equal((await api('/api/seller/login', { method: 'POST', headers, body: JSON.stringify({ email: 'wrong@example.test', password: 'wrong' }) })).response.status, 401);
    const { response } = await api('/api/seller/login', { method: 'POST', headers, body: JSON.stringify({ email: process.env.DEMO_SELLER_EMAIL || 'demo@sahaj-market.test', password: process.env.DEMO_SELLER_PASSWORD || 'demo123' }) });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get('set-cookie')!;
    assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=lax/i);
    cookie = setCookie.split(';')[0]; assert.ok(!cookie.includes('demo123'));
    assert.equal((await api('/api/seller/dashboard', { headers: { Cookie: cookie } })).response.status, 200);
    const dashPage = await fetch(`${base}/seller/dashboard`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(dashPage.status, 200);
  });
  await t.test('seller scoping, hidden listings and cross-origin protection', async () => {
    await db.product.create({ data: { id: foreignProductId, sellerId: 'seller-assam', title: 'Foreign test product', slug: foreignProductId, category: 'Other', description: 'Test', price: 1, stock: 1 } });
    const edit = (id: string, body: object, origin?: string) => api(`/api/seller/products/${id}`, { method: 'PATCH', headers: { ...headers, Cookie: cookie, ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
    assert.equal((await edit(foreignProductId, { price: 100 })).response.status, 404);
    assert.equal((await edit(listingId, { stock: 2 }, 'https://evil.test')).response.status, 401);
    assert.equal((await edit(listingId, { isPublished: false })).response.status, 200);
    assert.equal((await api(`/api/products/${slug}`)).response.status, 404);
    assert.equal((await api(`/api/products/${listingId}/orders`, { method: 'POST', headers, body: JSON.stringify(buyer) })).response.status, 404);
    assert.equal((await edit(listingId, { isPublished: true, price: 123.45, stock: 1 })).response.status, 200);
  });
  await t.test('validation and atomic concurrent buy never oversell', async () => {
    const path = `/api/products/${listingId}/orders`;
    assert.equal((await api(path, { method: 'POST', headers, body: JSON.stringify({ ...buyer, quantity: 0 }) })).response.status, 400);
    assert.equal((await api(path, { method: 'POST', headers, body: JSON.stringify({ ...buyer, total: 0 }) })).response.status, 400);
    const results = await Promise.all([1, 2, 3].map(() => api(path, { method: 'POST', headers, body: JSON.stringify(buyer) })));
    const success = results.filter(r => r.response.status === 201);
    assert.equal(success.length, 1); assert.ok(results.every(r => [201, 409].includes(r.response.status)));
    const { body } = success[0]; assert.equal(body.order.total, 123.45); assert.equal(body.order.status, 'PAID');
    receipt = body.confirmationUrl; orderId = body.order.id;
    const product = await db.product.findUniqueOrThrow({ where: { id: listingId } });
    assert.equal(product.stock, 0); assert.equal(await db.order.count({ where: { productId: listingId } }), 1);
    assert.equal((await api(path, { method: 'POST', headers, body: JSON.stringify(buyer) })).response.status, 409);
  });
  await t.test('receipt is private; artisan orders exactly match the shared contract', async () => {
    assert.equal((await fetch(`${base}/orders/${orderId}`)).status, 404);
    assert.equal((await fetch(new URL(receipt, base))).status, 200);
    assert.equal((await api('/api/artisan/orders?sellerId=seller-demo')).response.status, 401);
    assert.equal((await api('/api/artisan/orders?sellerId=seller-assam', { headers })).response.status, 400);
    const { response, body } = await api('/api/artisan/orders?sellerId=seller-demo', { headers });
    assert.equal(response.status, 200); assert.deepEqual(artisanOrdersResponseSchema.parse(body), body);
    const order = body.orders.find((o: { id: string }) => o.id === orderId);
    assert.ok(order); assert.deepEqual(Object.keys(order.product).sort(), ['images', 'slug', 'title']); assert.ok(!('confirmationToken' in order));
    assert.ok(body.orders.every((o: { sellerId: string }) => o.sellerId === 'seller-demo'));
  });
  await t.test('order status advances safely and logout clears the cookie', async () => {
    const update = (status: string) => api(`/api/seller/orders/${orderId}`, { method: 'PATCH', headers: { ...headers, Cookie: cookie }, body: JSON.stringify({ status }) });
    assert.equal((await update('DELIVERED')).response.status, 409);
    assert.equal((await update('DISPATCHED')).response.status, 200);
    assert.equal((await update('PAID')).response.status, 409);
    assert.equal((await update('DELIVERED')).response.status, 200);
    const { response } = await api('/api/seller/logout', { method: 'POST', headers: { ...headers, Cookie: cookie } });
    assert.equal(response.status, 200); assert.match(response.headers.get('set-cookie')!, /expires=Thu, 01 Jan 1970/i);
  });
});
