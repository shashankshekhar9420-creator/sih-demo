const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient: ArtisanClient } = require('../apps/artisan/generated/client');
const { PrismaClient: CommerceClient } = require('../apps/commerce/generated/client');

const artisanPrisma = new ArtisanClient();
const commercePrisma = new CommerceClient();

async function clean() {
  console.log('--- Cleaning Artisan Catalogs & Uploads ---');
  
  // 1. Delete all catalogs in artisan
  const deletedCatalogs = await artisanPrisma.catalog.deleteMany({});
  console.log(`Deleted ${deletedCatalogs.count} artisan catalog(s)`);

  // 2. Clean uploads folder except .gitkeep
  const uploadsDir = path.resolve(__dirname, '..', 'apps', 'artisan', 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const entries = fs.readdirSync(uploadsDir);
    for (const entry of entries) {
      if (entry === '.gitkeep') continue;
      const fullPath = path.join(uploadsDir, entry);
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Removed uploads entry: ${entry}`);
    }
  }

  // 3. Clean any orders first to satisfy foreign key constraints
  const deletedOrders = await commercePrisma.order.deleteMany({});
  console.log(`Deleted ${deletedOrders.count} commerce order(s)`);

  // 4. Clean any commerce products created from artisan catalogs (artisanCatalogId !== null)
  const deletedCommerceProducts = await commercePrisma.product.deleteMany({
    where: { artisanCatalogId: { not: null } }
  });
  console.log(`Deleted ${deletedCommerceProducts.count} artisan-published commerce product(s)`);

  // Verify counts
  const finalCatalogs = await artisanPrisma.catalog.count();
  const finalProducts = await commercePrisma.product.count();
  const finalOrders = await commercePrisma.order.count();
  const finalSellers = await commercePrisma.seller.count();

  console.log('\n--- Final Database Status ---');
  console.log(`Artisan Catalogs: ${finalCatalogs} (Clean slate ready for demo)`);
  console.log(`Commerce Products: ${finalProducts} (Standard seed products preserved)`);
  console.log(`Commerce Orders: ${finalOrders} (Clean slate ready for demo)`);
  console.log(`Commerce Sellers: ${finalSellers} (3 demo sellers preserved)`);

  await artisanPrisma.$disconnect();
  await commercePrisma.$disconnect();
}

clean().catch(console.error);
