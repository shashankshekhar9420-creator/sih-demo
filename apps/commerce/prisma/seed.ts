import { randomBytes } from 'node:crypto';
import { PrismaClient, type Prisma } from '../generated/client';
import { categorySchema, moneySchema, stockSchema } from '@sahaj/shared';

const db = new PrismaClient();
const sellers = [
  { id: 'seller-demo', name: 'Meera Devi', email: 'demo@sahaj-market.test', location: 'Jaipur, Rajasthan', story: 'Earth, thread and a lifetime of practice. Meera brings the warmth of Rajasthan into everyday objects.' },
  { id: 'seller-assam', name: 'Biren Das', email: 'biren@example.test', location: 'Majuli, Assam', story: 'Biren learned to weave beside his father. Today, local bamboo and cotton carry the family tradition forward.' },
  { id: 'seller-kutch', name: 'Rehana Khatri', email: 'rehana@example.test', location: 'Kutch, Gujarat', story: 'A love of color, a patient needle, and stories stitched into every piece. Craft runs in Rehana\'s family.' },
];

const products = [
  { id: 'seed-vase', sellerId: 'seller-demo', title: 'The Earthsong Terracotta Vase', hindiTitle: 'मिट्टी का हस्तनिर्मित फूलदान', category: 'Pottery & Terracotta', slug: 'earthsong-terracotta-vase', art: 'vase', price: 850, stock: 7,
    description: 'A soft curve, a warm earthen hue, and the quiet marks of the potter\'s wheel. This unglazed terracotta vase lends a grounded beauty to a shelf or a sunlit table. Pair it with dried stems, or let its sculptural shape tell the story on its own.',
    hindiDescription: 'कुम्हार के चाक पर बना मिट्टी का यह फूलदान घर में सादगी और गर्माहट लाता है। सूखे फूलों के साथ सजाएं या इसे अकेले रखें।',
    bullets: ['Wheel-thrown and finished by hand', 'Unglazed terracotta with a natural, matte surface', 'Best for dried flowers; not intended to hold water'],
    hindiBullets: ['चाक पर बना और हाथ से तैयार किया गया', 'प्राकृतिक मिट्टी की सतह', 'सूखे फूलों के लिए उपयुक्त'],
    specifics: { Material: 'Natural terracotta', Size: 'Approximately 24 cm tall', Color: 'Warm rust', Care: 'Wipe with a dry cloth' }, keywords: ['terracotta', 'vase', 'earthy', 'home decor'] },
  { id: 'seed-saree', sellerId: 'seller-assam', title: 'Slow Sunday Cotton Saree', category: 'Handloom & Weaving', slug: 'slow-sunday-cotton-saree', art: 'saree', price: 2450, stock: 5,
    description: 'Unhurried mornings, the soft rustle of cotton, and an olive border that feels like a familiar landscape. This handwoven saree celebrates the quiet elegance of natural fibers, with a gentle drape that gets softer with every wear.',
    bullets: ['Handwoven cotton with an olive border', 'Lightweight, breathable weave', 'Subtle variations are part of the handloom character'], specifics: { Material: 'Cotton', Size: '5.5 m length, approximately 1.15 m width', Color: 'Natural ivory and olive', Care: 'Gentle hand wash separately' }, keywords: ['cotton', 'saree', 'handloom', 'woven'] },
  { id: 'seed-basket', sellerId: 'seller-assam', title: 'The Everyday Bamboo Basket', category: 'Bamboo & Cane Craft', slug: 'everyday-bamboo-basket', art: 'basket', price: 680, stock: 12,
    description: 'For market mornings, a tangle of yarn, or the little things that deserve a beautiful home. Biren hand-weaves each basket from split bamboo, building a sturdy form with a wonderfully light touch.',
    bullets: ['Handwoven split bamboo', 'Rounded handle for easy carrying', 'A versatile basket for everyday storage'], specifics: { Material: 'Bamboo', Size: 'Approximately 30 x 24 x 28 cm', Color: 'Natural honey', Care: 'Keep dry; dust with a soft brush' }, keywords: ['bamboo', 'basket', 'storage', 'woven'] },
  { id: 'seed-cushion', sellerId: 'seller-kutch', title: 'Wildflower Embroidered Cushion', category: 'Embroidery & Textile Art', slug: 'wildflower-embroidered-cushion', art: 'cushion', price: 1250, stock: 3,
    description: 'A small garden, stitched by hand. Rust-colored blooms and olive leaves wander across a warm cotton ground, bringing a little of Kutch\'s textile tradition to your favorite reading corner. Cushion cover only; insert is not included.',
    bullets: ['Floral embroidery worked by hand', 'Cotton cushion cover with a concealed closure', 'Cover only; cushion insert not included'], specifics: { Material: 'Cotton with cotton embroidery thread', Size: '40 x 40 cm', Color: 'Ivory, rust and olive', Care: 'Gentle spot clean' }, keywords: ['cushion', 'embroidery', 'floral', 'home decor'] },
  { id: 'seed-diya', sellerId: 'seller-demo', title: 'Evening Light Brass Diyas', category: 'Metal & Brass Craft', slug: 'evening-light-brass-diyas', art: 'diya', price: 960, stock: 9,
    description: 'Two small pools of golden light. Shaped and hand-finished in brass, these traditional diyas bring a sense of ceremony to quiet evenings and festive gatherings alike. Their surface will develop a mellow patina with time.',
    bullets: ['A set of two hand-finished brass diyas', 'Traditional shallow bowl and raised base', 'Never leave a burning lamp unattended'], specifics: { Material: 'Brass', Size: 'Approximately 10 cm wide each', Color: 'Warm gold', Contents: 'Two diyas; oil and wicks not included' }, keywords: ['brass', 'diya', 'festive', 'lighting'] },
  { id: 'seed-tray', sellerId: 'seller-demo', title: 'Botanical Hand-Painted Tray', category: 'Wood Carving & Woodwork', slug: 'botanical-hand-painted-tray', art: 'tray', price: 1480, stock: 4,
    description: 'A branch in bloom, painted onto warm-grained wood. This tray turns a cup of chai and a quiet moment into something worth savoring. Raised edges and inset handles make it as practical as it is lovely.',
    bullets: ['Botanical motif painted by hand', 'Raised edges with inset carrying handles', 'Each piece has its own wood grain and brushwork'], specifics: { Material: 'Mango wood', Size: '35 x 28 cm', Color: 'Natural wood, olive and rust', Care: 'Wipe clean; do not soak or place in a dishwasher' }, keywords: ['tray', 'wood', 'hand painted', 'botanical'] },
  { id: 'seed-earrings', sellerId: 'seller-kutch', title: 'Desert Bloom Beaded Earrings', category: 'Jewelry & Beadwork', slug: 'desert-bloom-beaded-earrings', art: 'earrings', price: 420, stock: 2,
    description: 'The colors of a desert evening, gathered into a playful pair. Terracotta and sage beads frame a teardrop silhouette, with a gentle movement that catches the light. An everyday reminder to wear a little joy.',
    bullets: ['Hand-assembled beadwork', 'Teardrop form with small hanging beads', 'Sold as one pair'], specifics: { Material: 'Glass beads and brass-tone metal', Size: 'Approximately 5 cm drop', Color: 'Terracotta, sage and antique gold', Care: 'Keep dry; store separately' }, keywords: ['earrings', 'beaded', 'jewelry', 'gift'] },
  { id: 'seed-hanging', sellerId: 'seller-assam', title: 'Ochre & Olive Woven Wall Art', category: 'Handloom & Weaving', slug: 'ochre-olive-woven-wall-art', art: 'hanging', price: 1850, stock: 0,
    description: 'A little landscape made of thread. Bands of rust, olive and undyed cotton form a quiet geometric rhythm, finished with a generous fringe and a wooden hanging rod. A tactile focal point for a well-loved corner.',
    bullets: ['Handwoven geometric textile', 'Finished with a cotton fringe', 'Wooden hanging rod and cord included'], specifics: { Material: 'Cotton yarn and wood', Size: 'Approximately 35 x 55 cm including fringe', Color: 'Rust, ochre, olive and natural', Care: 'Dust gently; avoid direct sunlight' }, keywords: ['wall art', 'weaving', 'textile', 'home decor'] },
];

async function seed() {
  // Insert missing demo records only: reruns preserve seller edits, stock and order progress.
  await db.$transaction(async tx => {
    for (const seller of sellers) await tx.seller.upsert({ where: { id: seller.id }, create: seller, update: {} });
    for (const [index, product] of products.entries()) {
      const { art, bullets, specifics, keywords, hindiBullets, ...fields } = product;
      const data: Prisma.ProductUncheckedCreateInput = { ...fields,
        category: categorySchema.parse(fields.category), price: moneySchema.parse(fields.price), stock: stockSchema.parse(fields.stock),
        bulletsJson: JSON.stringify(bullets), specificsJson: JSON.stringify(specifics), keywordsJson: JSON.stringify(keywords),
        hindiBulletsJson: JSON.stringify(hindiBullets || []), imagesJson: JSON.stringify([`/art/${art}.svg`]),
        createdAt: new Date(Date.UTC(2026, 7, 20, 12, 0, index)),
      };
      await tx.product.upsert({ where: { id: product.id }, create: data, update: {} });
    }
    const orders = [
      { id: 'seed-order-1001', productId: 'seed-vase', buyerName: 'Ananya Sharma', buyerEmail: 'ananya@example.test', address: 'Demo House 12, Garden Lane\nJaipur, Rajasthan 302001', quantity: 2, status: 'PAID' as const, total: 1700 },
      { id: 'seed-order-1002', productId: 'seed-diya', buyerName: 'Rohan Mehta', buyerEmail: 'rohan@example.test', address: 'Demo Flat 4, Lake Road\nAhmedabad, Gujarat 380001', quantity: 1, status: 'DISPATCHED' as const, total: 960 },
      { id: 'seed-order-1003', productId: 'seed-basket', buyerName: 'Kavya Rao', buyerEmail: 'kavya@example.test', address: 'Demo Home 8, Park Street\nBengaluru, Karnataka 560001', quantity: 1, status: 'DELIVERED' as const, total: 680 },
      { id: 'seed-order-1004', productId: 'seed-cushion', buyerName: 'Ishaan Sen', buyerEmail: 'ishaan@example.test', address: 'Demo Apartment 3, River Road\nKolkata, West Bengal 700001', quantity: 2, status: 'PAID' as const, total: 2500 },
    ];
    for (const [index, order] of orders.entries()) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: order.productId } });
      await tx.order.upsert({ where: { id: order.id }, create: { ...order, sellerId: product.sellerId, confirmationToken: randomBytes(24).toString('hex'), createdAt: new Date(Date.UTC(2026, 7, 26 + index, 10)) }, update: {} });
    }
  }, { timeout: 20000 });
  console.log('Commerce seed ready: 3 sellers, 8 products, 4 example orders. Existing records preserved.');
}

seed().catch(error => { console.error('Commerce seed failed:', error instanceof Error ? error.name : 'UnknownError'); process.exitCode = 1; }).finally(() => db.$disconnect());
