import type { ArtisanOrder } from '@sahaj/shared';
import type { Catalog } from '../catalog';
import {
  lastNDayKeys,
  parseDate,
  percentDelta,
  round2,
  toDateKey,
} from './helpers';
import { upcomingSeasonReminders } from './festivals';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DailyPoint = { date: string; revenue: number; orders: number };

export type OverviewResult = {
  totalRevenue: number;
  totalOrders: number;
  unitsSold: number;
  daily: DailyPoint[];
  todayVsYesterday: { revenueDelta: number | null; ordersDelta: number | null } | null;
  weekVsLastWeek: { revenueDelta: number | null; ordersDelta: number | null } | null;
  commerceAvailable: boolean;
};

export type RankedProduct = {
  productId: string;
  title: string;
  image: string | null;
  slug: string | null;
  unitsSold: number;
  revenue: number;
  lastSoldAt: string | null;
  stagnant: boolean;
};

export type RankedResult = {
  bestSellers: RankedProduct[];
  worstSellers: RankedProduct[];
  stagnantCatalogIds: string[];
  commerceAvailable: boolean;
};

export type InventoryRow = {
  catalogId: string;
  title: string | null;
  category: string | null;
  commerceListingId: string | null;
  originalStock: number;
  estimatedCurrentStock: number;
  averageDailyUnitsSold: number;
  daysOfSupply: number | null;
  lowStock: boolean;
  fastMoving: boolean;
  slowMoving: boolean;
  createdAt: string;
};

export type InventoryResult = {
  items: InventoryRow[];
  commerceAvailable: boolean;
  // Honest limitation surfaced to UI.
  note: string;
};

export type ProfitRow = {
  catalogId: string;
  title: string | null;
  productId: string | null;
  totalUnitsSold: number;
  totalRevenue: number;
  totalProfit: number;
  marginPercent: number | null;
  averageUnitPrice: number | null;
  profitDataUnavailable: boolean;
};

export type ProfitabilityResult = {
  rankedByProfitDesc: ProfitRow[];
  rankedByProfitAsc: ProfitRow[];
  unavailable: ProfitRow[];
  commerceAvailable: boolean;
};

export type PricingFlagRow = {
  catalogId: string;
  title: string | null;
  finalPrice: number | null;
  recommendedPrice: number | null;
  overpriced: boolean;
  underpriced: boolean;
  stagnant: boolean;
  suggestedNewPrice: number | null;
};

export type TasksResult = {
  tasks: Array<{ type: string; message: string; relatedProductId: string | null; priority: number }>;
  commerceAvailable: boolean;
};

export type TrendsResult = {
  weekOverWeek: { revenueDelta: number | null; ordersDelta: number | null } | null;
  monthOverMonth: { revenueDelta: number | null; ordersDelta: number | null } | null;
  movingAverage7d: Array<{ date: string; revenue: number; sma7: number | null }>;
  upcomingSeasons: ReturnType<typeof upcomingSeasonReminders>;
  note: string;
  commerceAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Shared: product aggregation
// ---------------------------------------------------------------------------

export type ProductAgg = {
  productId: string;
  title: string;
  image: string | null;
  slug: string | null;
  unitsSold: number;
  revenue: number;
  lastSoldAt: string | null;
  lastSoldAtMs: number;
};

export function aggregateProducts(orders: ArtisanOrder[]): Map<string, ProductAgg> {
  const map = new Map<string, ProductAgg>();
  for (const o of orders) {
    const pid = o.productId;
    if (!pid) continue;
    const cur = map.get(pid);
    const ms = parseDate(o.createdAt)?.getTime() ?? 0;
    if (!cur) {
      map.set(pid, {
        productId: pid,
        title: o.product.title,
        image: o.product.images[0] ?? null,
        slug: o.product.slug ?? null,
        unitsSold: o.quantity,
        revenue: o.total,
        lastSoldAt: o.createdAt,
        lastSoldAtMs: ms,
      });
    } else {
      cur.unitsSold += o.quantity;
      cur.revenue = round2(cur.revenue + o.total);
      if (ms > cur.lastSoldAtMs) {
        cur.lastSoldAt = o.createdAt;
        cur.lastSoldAtMs = ms;
        cur.title = o.product.title;
        cur.image = o.product.images[0] ?? cur.image;
        cur.slug = o.product.slug ?? cur.slug;
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// 1. Overview
// ---------------------------------------------------------------------------

export function computeOverview(
  catalogs: Catalog[],
  orders: ArtisanOrder[],
  commerceAvailable: boolean,
  now = new Date(),
): OverviewResult {
  void catalogs;
  const totalRevenue = round2(orders.reduce((s, o) => s + o.total, 0));
  const totalOrders = orders.length;
  const unitsSold = orders.reduce((s, o) => s + o.quantity, 0);

  const keys = lastNDayKeys(now, 30);
  const byDay = new Map<string, DailyPoint>();
  for (const k of keys) byDay.set(k, { date: k, revenue: 0, orders: 0 });
  for (const o of orders) {
    const d = parseDate(o.createdAt);
    if (!d) continue;
    const k = toDateKey(d);
    const entry = byDay.get(k);
    if (entry) {
      entry.revenue = round2(entry.revenue + o.total);
      entry.orders += 1;
    }
  }
  const daily = keys.map(k => byDay.get(k)!);

  // Need at least 2 days of history for deltas; otherwise null.
  const distinctDays = new Set(orders.map(o => parseDate(o.createdAt)).filter(Boolean).map(d => toDateKey(d!)));
  const hasEnoughHistory = distinctDays.size >= 2;

  let todayVsYesterday: OverviewResult['todayVsYesterday'] = null;
  let weekVsLastWeek: OverviewResult['weekVsLastWeek'] = null;

  if (hasEnoughHistory && daily.length >= 2) {
    const today = daily[daily.length - 1];
    const yesterday = daily[daily.length - 2];
    todayVsYesterday = {
      revenueDelta: percentDelta(today.revenue, yesterday.revenue),
      ordersDelta: percentDelta(today.orders, yesterday.orders),
    };
  }
  if (hasEnoughHistory && daily.length >= 14) {
    const last7 = daily.slice(-7);
    const prev7 = daily.slice(-14, -7);
    const curRev = round2(last7.reduce((s, d) => s + d.revenue, 0));
    const prevRev = round2(prev7.reduce((s, d) => s + d.revenue, 0));
    const curOrd = last7.reduce((s, d) => s + d.orders, 0);
    const prevOrd = prev7.reduce((s, d) => s + d.orders, 0);
    weekVsLastWeek = {
      revenueDelta: percentDelta(curRev, prevRev),
      ordersDelta: percentDelta(curOrd, prevOrd),
    };
  }

  return { totalRevenue, totalOrders, unitsSold, daily, todayVsYesterday, weekVsLastWeek, commerceAvailable };
}

// ---------------------------------------------------------------------------
// 2. Ranked + stagnant
// ---------------------------------------------------------------------------

const STAGNANT_DAYS = 21;

export function computeRanked(
  catalogs: Catalog[],
  orders: ArtisanOrder[],
  commerceAvailable: boolean,
  now = new Date(),
): RankedResult {
  const agg = aggregateProducts(orders);
  const published = catalogs.filter(c => c.status === 'PUBLISHED' && c.commerceListingId);

  // Map listingId -> catalog for fallback title
  const listingToCatalog = new Map<string, Catalog>();
  for (const c of published) if (c.commerceListingId) listingToCatalog.set(c.commerceListingId, c);

  // Build ranked entries: include products that have sales, plus stagnant catalogs with no sales
  const ranked: RankedProduct[] = [];
  const stagnantCatalogIds: string[] = [];
  const cutoffMs = now.getTime() - STAGNANT_DAYS * 24 * 60 * 60 * 1000;

  for (const [, a] of agg) {
    const isStagnant = a.lastSoldAtMs < cutoffMs;
    ranked.push({
      productId: a.productId,
      title: a.title,
      image: a.image,
      slug: a.slug,
      unitsSold: a.unitsSold,
      revenue: a.revenue,
      lastSoldAt: a.lastSoldAt,
      stagnant: isStagnant,
    });
  }

  // Published catalogs with no orders at all are stagnant
  for (const c of published) {
    const lid = c.commerceListingId!;
    if (!agg.has(lid)) {
      // No sales ever — treat as stagnant (flagged separately). Include a row with zero sales for visibility.
      stagnantCatalogIds.push(c.id);
      ranked.push({
        productId: lid,
        title: c.title ?? 'Untitled',
        image: c.processedImages[0] ?? c.rawImages[0] ?? null,
        slug: null,
        unitsSold: 0,
        revenue: 0,
        lastSoldAt: null,
        stagnant: true,
      });
    } else {
      const entry = ranked.find(r => r.productId === lid);
      if (entry?.stagnant) stagnantCatalogIds.push(c.id);
    }
  }

  const bestSellers = [...ranked].sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
  const worstSellers = [...ranked].sort((a, b) => a.unitsSold - b.unitsSold || a.revenue - b.revenue);

  return { bestSellers, worstSellers, stagnantCatalogIds, commerceAvailable };
}

// ---------------------------------------------------------------------------
// 3. Inventory (derived, not live-synced)
// ---------------------------------------------------------------------------

/**
 * KNOWN LIMITATION: stock is derived, not read live from Commerce.
 * If the seller edits stock directly from the Commerce seller dashboard,
 * this will drift out of sync. Acceptable for the prototype.
 */
export function computeInventory(
  catalogs: Catalog[],
  orders: ArtisanOrder[],
  commerceAvailable: boolean,
  now = new Date(),
): InventoryResult {
  const published = catalogs.filter(c => c.status === 'PUBLISHED');
  const windowMs = 14 * 24 * 60 * 60 * 1000;
  const windowStart = now.getTime() - windowMs;

  // Per-catalog average daily units sold last 14 days
  const avgByCatalog = new Map<string, number>();
  for (const c of published) {
    const lid = c.commerceListingId;
    let sum14 = 0;
    if (lid) {
      for (const o of orders) {
        if (o.productId !== lid) continue;
        const ms = parseDate(o.createdAt)?.getTime() ?? 0;
        if (ms >= windowStart) sum14 += o.quantity;
      }
    }
    avgByCatalog.set(c.id, sum14 / 14);
  }

  // Percentile thresholds for fast/slow (only among products with avg > 0)
  const avgs = [...avgByCatalog.values()].filter(v => v > 0).sort((a, b) => a - b);
  let fastThreshold: number | null = null;
  let slowThreshold: number | null = null;
  if (avgs.length >= 2) {
    // Top 25%: >= 75th percentile; bottom 25%: <= 25th percentile
    const q1Idx = Math.floor(avgs.length * 0.25);
    const q3Idx = Math.ceil(avgs.length * 0.75) - 1;
    slowThreshold = avgs[q1Idx];
    fastThreshold = avgs[Math.max(0, Math.min(q3Idx, avgs.length - 1))];
  }

  const items: InventoryRow[] = published.map(c => {
    const lid = c.commerceListingId;
    let soldSinceCreate = 0;
    if (lid) {
      const createdMs = parseDate(c.createdAt)?.getTime() ?? 0;
      for (const o of orders) {
        if (o.productId !== lid) continue;
        const ms = parseDate(o.createdAt)?.getTime() ?? 0;
        if (ms >= createdMs) soldSinceCreate += o.quantity;
      }
    }
    const estimatedCurrentStock = c.stock - soldSinceCreate;
    const averageDailyUnitsSold = avgByCatalog.get(c.id) ?? 0;
    const daysOfSupply = averageDailyUnitsSold > 0 ? round2(estimatedCurrentStock / averageDailyUnitsSold) : null;
    const lowStock = estimatedCurrentStock <= 3 || (daysOfSupply !== null && daysOfSupply < 7);

    let fastMoving = false;
    let slowMoving = false;
    if (fastThreshold !== null && slowThreshold !== null) {
      if (averageDailyUnitsSold >= fastThreshold && averageDailyUnitsSold > 0) fastMoving = true;
      if (averageDailyUnitsSold <= slowThreshold && c.stock > 0) slowMoving = true;
      // Don't double-flag; fast takes precedence if thresholds equal (small N)
      if (fastMoving && slowMoving) slowMoving = false;
    }

    return {
      catalogId: c.id,
      title: c.title,
      category: c.category,
      commerceListingId: lid ?? null,
      originalStock: c.stock,
      estimatedCurrentStock,
      averageDailyUnitsSold: round2(averageDailyUnitsSold),
      daysOfSupply,
      lowStock,
      fastMoving,
      slowMoving,
      createdAt: c.createdAt,
    };
  });

  return {
    items,
    commerceAvailable,
    note: 'Stock is derived from catalog stock minus orders since publish — not live-synced from Commerce. Edits in the Commerce seller dashboard will drift.',
  };
}

// ---------------------------------------------------------------------------
// 4. Profitability
// ---------------------------------------------------------------------------

export function computeProfitability(
  catalogs: Catalog[],
  orders: ArtisanOrder[],
  commerceAvailable: boolean,
): ProfitabilityResult {
  const byListing = new Map<string, Catalog>();
  for (const c of catalogs) if (c.commerceListingId) byListing.set(c.commerceListingId, c);

  // Group orders by productId
  const grouped = aggregateProducts(orders);
  const listingIdsFromOrders = new Set(grouped.keys());
  // Also include published catalogs with listingId but zero orders (profit 0, but cost known)
  for (const c of catalogs) if (c.commerceListingId && c.status === 'PUBLISHED') listingIdsFromOrders.add(c.commerceListingId);

  const rows: ProfitRow[] = [];
  const unavailable: ProfitRow[] = [];

  for (const lid of listingIdsFromOrders) {
    const catalog = byListing.get(lid);
    if (!catalog) continue; // order for product not in artisan catalogs — skip
    if (catalog.materialCost == null) {
      unavailable.push({
        catalogId: catalog.id,
        title: catalog.title,
        productId: lid,
        totalUnitsSold: grouped.get(lid)?.unitsSold ?? 0,
        totalRevenue: grouped.get(lid)?.revenue ?? 0,
        totalProfit: 0,
        marginPercent: null,
        averageUnitPrice: null,
        profitDataUnavailable: true,
      });
      continue;
    }
    const agg = grouped.get(lid);
    const units = agg?.unitsSold ?? 0;
    const revenue = agg?.revenue ?? 0;
    // Profit per order line: (total/quantity - materialCost) * quantity
    let totalProfit = 0;
    let weightedMarginSum = 0;
    let denomForMargin = 0;
    let unitPriceSum = 0;
    let unitPriceCount = 0;
    for (const o of orders) {
      if (o.productId !== lid) continue;
      const unitPrice = o.quantity > 0 ? o.total / o.quantity : 0;
      const profitPerUnit = unitPrice - catalog.materialCost;
      totalProfit += profitPerUnit * o.quantity;
      // Weighted margin: profit / revenue
      weightedMarginSum += profitPerUnit * o.quantity;
      denomForMargin += unitPrice * o.quantity;
      unitPriceSum += unitPrice;
      unitPriceCount += 1;
    }
    const marginPercent = denomForMargin > 0 ? round2((weightedMarginSum / denomForMargin) * 100) : null;
    const averageUnitPrice = unitPriceCount > 0 ? round2(unitPriceSum / unitPriceCount) : null;
    rows.push({
      catalogId: catalog.id,
      title: catalog.title,
      productId: lid,
      totalUnitsSold: units,
      totalRevenue: round2(revenue),
      totalProfit: round2(totalProfit),
      marginPercent,
      averageUnitPrice,
      profitDataUnavailable: false,
    });
  }

  const rankedByProfitDesc = [...rows].sort((a, b) => b.totalProfit - a.totalProfit);
  const rankedByProfitAsc = [...rows].sort((a, b) => a.totalProfit - b.totalProfit);

  return { rankedByProfitDesc, rankedByProfitAsc, unavailable, commerceAvailable };
}

// ---------------------------------------------------------------------------
// 5. Pricing flags
// ---------------------------------------------------------------------------

export function computePricingFlags(
  catalogs: Catalog[],
  stagnantCatalogIds: Set<string>,
): PricingFlagRow[] {
  return catalogs
    .filter(c => c.status === 'PUBLISHED')
    .map(c => {
      const overpriced = c.finalPrice != null && c.recommendedPrice != null ? c.finalPrice > c.recommendedPrice * 1.2 : false;
      const underpriced = c.finalPrice != null && c.recommendedPrice != null ? c.finalPrice < c.recommendedPrice * 0.8 : false;
      const stagnant = stagnantCatalogIds.has(c.id);
      const suggestedNewPrice =
        stagnant && c.finalPrice != null ? round2(c.finalPrice * 0.9) : null;
      return {
        catalogId: c.id,
        title: c.title,
        finalPrice: c.finalPrice,
        recommendedPrice: c.recommendedPrice,
        overpriced,
        underpriced,
        stagnant,
        suggestedNewPrice,
      };
    });
}

// ---------------------------------------------------------------------------
// 6. Tasks
// ---------------------------------------------------------------------------

export function computeTasks(params: {
  catalogs: Catalog[];
  orders: ArtisanOrder[];
  ranked: RankedResult;
  inventory: InventoryResult;
  pricingFlags: PricingFlagRow[];
  now?: Date;
}): TasksResult {
  const { catalogs, orders, ranked, inventory, pricingFlags, now = new Date() } = params;
  const byListing = new Map<string, Catalog>();
  for (const c of catalogs) if (c.commerceListingId) byListing.set(c.commerceListingId, c);
  const byCatalogId = new Map<string, Catalog>();
  for (const c of catalogs) byCatalogId.set(c.id, c);

  type Task = { type: string; message: string; relatedProductId: string | null; priority: number };
  const tasks: Task[] = [];
  const seen = new Set<string>();

  const push = (type: string, relatedProductId: string | null, message: string, priority: number) => {
    const key = `${type}:${relatedProductId ?? 'none'}`;
    if (seen.has(key)) return;
    seen.add(key);
    tasks.push({ type, message, relatedProductId, priority });
  };

  // 1) Pending orders >48h (highest priority 0)
  const fortyEightH = 48 * 60 * 60 * 1000;
  for (const o of orders) {
    if (o.status !== 'PAID') continue;
    const ms = parseDate(o.createdAt)?.getTime();
    if (ms == null) continue;
    if (now.getTime() - ms > fortyEightH) {
      push('pending_order', o.productId, `You have a pending order for ${o.product.title} to fulfill`, 0);
    }
  }

  // 2) Low stock (priority 1)
  for (const row of inventory.items) {
    if (row.lowStock) {
      const title = row.title ?? 'Untitled';
      push('low_stock', row.commerceListingId, `You're running low on stock for ${title} — consider making more`, 1);
    }
  }

  // 3) Stagnant (priority 2)
  for (const cid of ranked.stagnantCatalogIds) {
    const cat = byCatalogId.get(cid);
    const title = cat?.title ?? 'A listing';
    push('stagnant', cat?.commerceListingId ?? null, `${title} hasn't sold in 3 weeks — consider lowering the price or improving photos`, 2);
  }

  // 4) Overpriced (priority 3)
  for (const flag of pricingFlags) {
    if (flag.overpriced) {
      const title = flag.title ?? 'Untitled';
      push('overpriced', flag.catalogId, `Your price for ${title} may be too high compared to similar items`, 3);
    }
  }

  tasks.sort((a, b) => a.priority - b.priority);
  const top = tasks.slice(0, 5);
  return { tasks: top, commerceAvailable: inventory.commerceAvailable && ranked.commerceAvailable };
}

// ---------------------------------------------------------------------------
// 7. Trends
// ---------------------------------------------------------------------------

export function computeTrends(
  catalogs: Catalog[],
  orders: ArtisanOrder[],
  commerceAvailable: boolean,
  now = new Date(),
): TrendsResult {
  void catalogs;
  const keys30 = lastNDayKeys(now, 30);
  const keys60 = lastNDayKeys(now, 60);
  // Build revenue/orders by day for 60 days (for MoM)
  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const k of keys60) byDay.set(k, { revenue: 0, orders: 0 });
  for (const o of orders) {
    const d = parseDate(o.createdAt);
    if (!d) continue;
    const k = toDateKey(d);
    const e = byDay.get(k);
    if (e) {
      e.revenue = round2(e.revenue + o.total);
      e.orders += 1;
    }
  }

  const daily30 = keys30.map(k => ({ date: k, ...byDay.get(k)! }));
  const daily60 = keys60.map(k => ({ date: k, ...byDay.get(k)! }));

  // WoW: last7 vs prev7
  let weekOverWeek: TrendsResult['weekOverWeek'] = null;
  if (daily30.length >= 14) {
    const last7 = daily30.slice(-7);
    const prev7 = daily30.slice(-14, -7);
    const curRev = round2(last7.reduce((s, d) => s + d.revenue, 0));
    const prevRev = round2(prev7.reduce((s, d) => s + d.revenue, 0));
    const curOrd = last7.reduce((s, d) => s + d.orders, 0);
    const prevOrd = prev7.reduce((s, d) => s + d.orders, 0);
    // If total history <2 weeks of non-zero days, still compute but percentDelta handles zero.
    // However spec says comparison fields null if insufficient history. We'll gate on distinct days.
    const distinctDays = new Set(orders.map(o => parseDate(o.createdAt)).filter(Boolean).map(d => toDateKey(d!)));
    if (distinctDays.size >= 2) {
      weekOverWeek = {
        revenueDelta: percentDelta(curRev, prevRev),
        ordersDelta: percentDelta(curOrd, prevOrd),
      };
    }
  }

  let monthOverMonth: TrendsResult['monthOverMonth'] = null;
  if (daily60.length >= 60) {
    const last30 = daily60.slice(-30);
    const prev30 = daily60.slice(-60, -30);
    const curRev = round2(last30.reduce((s, d) => s + d.revenue, 0));
    const prevRev = round2(prev30.reduce((s, d) => s + d.revenue, 0));
    const curOrd = last30.reduce((s, d) => s + d.orders, 0);
    const prevOrd = prev30.reduce((s, d) => s + d.orders, 0);
    const distinctDays = new Set(orders.map(o => parseDate(o.createdAt)).filter(Boolean).map(d => toDateKey(d!)));
    if (distinctDays.size >= 2) {
      monthOverMonth = {
        revenueDelta: percentDelta(curRev, prevRev),
        ordersDelta: percentDelta(curOrd, prevOrd),
      };
    }
  }

  // 7-day SMA for last 30 days
  const movingAverage7d: TrendsResult['movingAverage7d'] = daily30.map((point, idx) => {
    if (idx < 6) return { date: point.date, revenue: point.revenue, sma7: null };
    const window = daily30.slice(idx - 6, idx + 1);
    const sma7 = round2(window.reduce((s, d) => s + d.revenue, 0) / 7);
    return { date: point.date, revenue: point.revenue, sma7 };
  });

  const sellerCategories = [...new Set(catalogs.map(c => c.category).filter(Boolean) as string[])];
  const upcomingSeasons = upcomingSeasonReminders(sellerCategories, now);

  return {
    weekOverWeek,
    monthOverMonth,
    movingAverage7d,
    upcomingSeasons,
    note: 'Simple moving average and percentage comparisons — not a trained forecasting model. There is not enough order history in a prototype to train anything real.',
    commerceAvailable,
  };
}

// ---------------------------------------------------------------------------
// 8. Summary (stub, deterministic template)
// ---------------------------------------------------------------------------

export function buildSummaryStub(input: {
  totalRevenue: number;
  unitsSold: number;
  totalOrders: number;
  bestSellerTitle: string | null;
  topTaskMessage: string | null;
}): { summaryEnglish: string; summaryHindi: string; audioUrl: null } {
  const { totalRevenue, unitsSold, bestSellerTitle, topTaskMessage } = input;
  const rupees = `₹${totalRevenue.toLocaleString('en-IN')}`;
  const best = bestSellerTitle ?? '—';
  const taskLine = topTaskMessage ? ` ${topTaskMessage}` : '';
  const summaryEnglish = `This week you sold ${unitsSold} items and earned ${rupees}. Your best seller is ${best}.${taskLine ? ` ${taskLine.trim()}` : ''}`.trim();
  // Hardcoded Hindi template with same values (stub — no transliteration engine).
  const summaryHindi = `इस हफ़्ते आपने ${unitsSold} आइटम बेचे और ${rupees} कमाए। आपका सबसे ज़्यादा बिकने वाला उत्पाद ${best} है।${topTaskMessage ? ` ${topTaskMessage}` : ''}`.trim();
  return { summaryEnglish, summaryHindi, audioUrl: null };
}
