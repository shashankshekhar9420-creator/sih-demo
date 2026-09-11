import { z } from 'zod';

export const dailyPointSchema = z.object({ date: z.string(), revenue: z.number(), orders: z.number() });
export const deltaSchema = z.object({ revenueDelta: z.number().nullable(), ordersDelta: z.number().nullable() });

export const overviewResponseSchema = z.object({
  totalRevenue: z.number(),
  totalOrders: z.number(),
  unitsSold: z.number(),
  daily: z.array(dailyPointSchema),
  todayVsYesterday: deltaSchema.nullable(),
  weekVsLastWeek: deltaSchema.nullable(),
  commerceAvailable: z.boolean(),
});

export const rankedProductSchema = z.object({
  productId: z.string(),
  title: z.string(),
  image: z.string().nullable(),
  slug: z.string().nullable(),
  unitsSold: z.number(),
  revenue: z.number(),
  lastSoldAt: z.string().nullable(),
  stagnant: z.boolean(),
});

export const rankedResponseSchema = z.object({
  bestSellers: z.array(rankedProductSchema),
  worstSellers: z.array(rankedProductSchema),
  stagnantCatalogIds: z.array(z.string()),
  commerceAvailable: z.boolean(),
});

export const inventoryRowSchema = z.object({
  catalogId: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  commerceListingId: z.string().nullable(),
  originalStock: z.number(),
  estimatedCurrentStock: z.number(),
  averageDailyUnitsSold: z.number(),
  daysOfSupply: z.number().nullable(),
  lowStock: z.boolean(),
  fastMoving: z.boolean(),
  slowMoving: z.boolean(),
  createdAt: z.string(),
});

export const inventoryResponseSchema = z.object({
  items: z.array(inventoryRowSchema),
  commerceAvailable: z.boolean(),
  note: z.string(),
});

export const profitRowSchema = z.object({
  catalogId: z.string(),
  title: z.string().nullable(),
  productId: z.string().nullable(),
  totalUnitsSold: z.number(),
  totalRevenue: z.number(),
  totalProfit: z.number(),
  marginPercent: z.number().nullable(),
  averageUnitPrice: z.number().nullable(),
  profitDataUnavailable: z.boolean(),
});

export const profitabilityResponseSchema = z.object({
  rankedByProfitDesc: z.array(profitRowSchema),
  rankedByProfitAsc: z.array(profitRowSchema),
  unavailable: z.array(profitRowSchema),
  commerceAvailable: z.boolean(),
});

export const pricingFlagRowSchema = z.object({
  catalogId: z.string(),
  title: z.string().nullable(),
  finalPrice: z.number().nullable(),
  recommendedPrice: z.number().nullable(),
  overpriced: z.boolean(),
  underpriced: z.boolean(),
  stagnant: z.boolean(),
  suggestedNewPrice: z.number().nullable(),
});

export const pricingFlagsResponseSchema = z.object({
  items: z.array(pricingFlagRowSchema),
  commerceAvailable: z.boolean(),
});

export const taskSchema = z.object({
  type: z.string(),
  message: z.string(),
  relatedProductId: z.string().nullable(),
  priority: z.number(),
});

export const tasksResponseSchema = z.object({
  tasks: z.array(taskSchema),
  commerceAvailable: z.boolean(),
});

export const trendsResponseSchema = z.object({
  weekOverWeek: deltaSchema.nullable(),
  monthOverMonth: deltaSchema.nullable(),
  movingAverage7d: z.array(z.object({ date: z.string(), revenue: z.number(), sma7: z.number().nullable() })),
  upcomingSeasons: z.array(z.object({ category: z.string(), occasion: z.string(), note: z.string(), monthsUntilPeak: z.number() })),
  note: z.string(),
  commerceAvailable: z.boolean(),
});

export const summaryRequestSchema = z
  .object({
    totalRevenue: z.number().optional(),
    unitsSold: z.number().optional(),
    totalOrders: z.number().optional(),
    bestSellerTitle: z.string().nullable().optional(),
    topTaskMessage: z.string().nullable().optional(),
  })
  .passthrough();

export const summaryResponseSchema = z.object({
  summaryEnglish: z.string(),
  summaryHindi: z.string(),
  audioUrl: z.string().nullable(),
});
