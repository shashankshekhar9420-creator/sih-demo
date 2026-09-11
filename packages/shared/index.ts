import { z } from 'zod';

export const categories = ['Pottery & Terracotta', 'Handloom & Weaving', 'Embroidery & Textile Art', 'Wood Carving & Woodwork', 'Metal & Brass Craft', 'Jewelry & Beadwork', 'Bamboo & Cane Craft', 'Stone & Marble Craft', 'Folk Painting & Art', 'Leather Craft', 'Other'] as const;
export const categorySchema = z.enum(categories);
export const text = z.string().trim().min(1).max(10000);
export const stringsSchema = z.array(z.string().trim().min(1).max(2000)).max(30);
export const specificsSchema = z.record(z.string().min(1).max(80), z.string().max(1000)).refine(v => Object.keys(v).length <= 20, 'At most 20 specifics');
export const moneySchema = z.number().finite().min(0).max(10000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Use at most two decimal places');
export const stockSchema = z.number().int().min(0).max(100000);
export const generatedSchema = z.object({
  title: text.max(200), hindiTitle: text.max(200), description: text,
  hindiDescription: text, bullets: stringsSchema.min(1), hindiBullets: stringsSchema.min(1),
  specifics: specificsSchema, keywords: stringsSchema.min(1),
});
export const publishSchema = generatedSchema.extend({
  artisanCatalogId: z.string().min(1).max(100), sellerId: z.literal('seller-demo'), category: categorySchema,
  images: z.array(z.string().url().max(2000)).length(3), price: moneySchema, stock: stockSchema,
}).strict();
export const publishResultSchema = z.object({listingId: text, productUrl: z.string().url(), created: z.boolean()});
export const orderStatusSchema = z.enum(['PAID', 'DISPATCHED', 'DELIVERED']);
export const artisanOrderSchema = z.object({
  id: z.string(), productId: z.string(), sellerId: z.string(), buyerName: z.string(),
  buyerEmail: z.string(), address: z.string(), quantity: z.number().int(), total: z.number(),
  status: orderStatusSchema, createdAt: z.string(), updatedAt: z.string(),
  product: z.object({title: z.string(), images: z.array(z.string()), slug: z.string()}),
});
export const artisanOrdersResponseSchema = z.object({orders: z.array(artisanOrderSchema)});
export type ArtisanOrder = z.infer<typeof artisanOrderSchema>;
export function parseStrings(value: string | unknown): string[] {
  if (Array.isArray(value)) return value.map(item => (typeof item === 'string' ? item : String(item ?? '')));
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => (typeof item === 'string' ? item : String(item ?? '')));
  } catch {
    return [];
  }
}
export function parseSpecifics(value: string | unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) {
      if (typeof k === 'string' && v !== null && v !== undefined) {
        result[k] = typeof v === 'string' ? v : String(v);
      }
    }
    return result;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k === 'string' && v !== null && v !== undefined) {
        result[k] = typeof v === 'string' ? v : String(v);
      }
    }
    return result;
  } catch {
    return {};
  }
}
export function rupees(value: number): string {return new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(value);}

export const questions = [
  {title: 'Name & material', hindi: 'इस उत्पाद का नाम क्या है, और यह किस चीज़ से बना है?', english: 'What is this product called, and what material is it made from?'},
  {title: 'Craft & appearance', hindi: 'यह कैसे बनाया गया है, और यह देखने में कैसा है — आकार, रंग, वज़न, और कोई खास डिज़ाइन?', english: 'How is it made? Tell us its size, color, weight, and special design.'},
  {title: 'Use & story', hindi: 'इसका उपयोग किस लिए होता है, और क्या इसके पीछे कोई कहानी, परंपरा, या त्योहार जुड़ा है?', english: 'What is it used for? Is there a story, tradition, or festival behind it?'},
] as const;
