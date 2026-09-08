import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(root, name), 'utf8');

test('package and Prisma isolation match the workspace contract', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.name, '@sahaj/commerce');
  assert.equal(pkg.dependencies['@prisma/client'], '6.19.0');
  assert.equal(pkg.devDependencies.prisma, '6.19.0');
  assert.equal(pkg.scripts.build, 'next build');
  assert.equal(pkg.scripts.dev, 'next dev -p 3000');
  assert.equal(pkg.scripts.start, 'next start -p 3000');
  assert.equal(pkg.scripts['db:setup'], 'prisma generate && prisma db push');
  assert.equal(pkg.scripts.seed, 'tsx prisma/seed.ts');
  const schema = await read('prisma/schema.prisma');
  assert.match(schema, /output\s*=\s*"\.\.\/generated\/client"/);
  assert.match(schema, /url\s*=\s*"file:\.\/commerce\.db"/);
  assert.match(schema, /artisanCatalogId\s+String\?\s+@unique/);
  JSON.parse(await read('tsconfig.json'));
});

test('all local SVG artwork has balanced elements and no external dependencies', async () => {
  const files = (await readdir(path.join(root, 'public/art'))).filter(f => f.endsWith('.svg'));
  assert.equal(files.length, 9);
  for (const file of files) {
    const svg = await read(`public/art/${file}`);
    assert.match(svg, /^<svg\s/);
    assert.match(svg, /viewBox="[\d .-]+"/);
    assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)="https?:/i);
    const stack = [];
    for (const tag of svg.match(/<[^>]+>/g) || []) {
      if (tag.startsWith('<?') || tag.startsWith('<!')) continue;
      const name = tag.match(/^<\/?([\w:-]+)/)?.[1];
      assert.ok(name, `${file}: invalid element ${tag}`);
      if (tag.startsWith('</')) assert.equal(stack.pop(), name, `${file}: mismatched closing element`);
      else if (!tag.endsWith('/>')) stack.push(name);
    }
    assert.equal(stack.length, 0, `${file}: unclosed elements`);
  }
});

test('all required routes exist and dynamic siblings use the same name', async () => {
  const required = ['products', 'products/[slug]', 'products/[slug]/orders', 'seller/dashboard', 'seller/products', 'seller/products/[id]', 'seller/orders', 'seller/orders/[id]', 'seller/login', 'seller/logout', 'artisan/catalogs/publish', 'artisan/catalogs/update', 'artisan/orders'];
  for (const route of required) assert.match(await read(`app/api/${route}/route.ts`), /export const (GET|POST|PUT|PATCH)/);
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const dynamicNames = entries.filter(e => e.isDirectory() && /^\[/.test(e.name));
    // Empty directories left by a rename aren't Next routes.
    const populated = [];
    for (const entry of dynamicNames) if ((await readdir(path.join(directory, entry.name), { recursive: true })).some(name => /\.(ts|tsx)$/.test(name))) populated.push(entry.name);
    assert.ok(populated.length <= 1, `Conflicting dynamic names in ${directory}: ${populated}`);
    for (const entry of entries) if (entry.isDirectory()) await walk(path.join(directory, entry.name));
  }
  await walk(path.join(root, 'app'));
});

test('seller pages enforce sessions and client modules contain no server credentials', async () => {
  for (const file of ['layout.tsx', 'dashboard/page.tsx', 'products/page.tsx', 'orders/page.tsx']) {
    assert.match(await read(`app/seller/(protected)/${file}`), /await protectSellerPage\(\)/);
  }
  for (const file of await readdir(path.join(root, 'components'))) {
    const source = await read(`components/${file}`);
    assert.doesNotMatch(source, /local-demo-key|demo123|DEMO_SESSION_SECRET|from ['"].*\/config['"]/);
  }
  assert.doesNotMatch(await read('app/globals.css'), /@import|https?:\/\//);
});
