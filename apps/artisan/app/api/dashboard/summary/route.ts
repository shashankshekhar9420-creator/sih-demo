import { api, jsonBody } from '../../../../lib/api';
import { aggregateProducts, buildSummaryStub, computeOverview } from '../../../../lib/dashboard/compute';
import { getDashboardData } from '../../../../lib/dashboard/fetch';
import { summaryRequestSchema } from '../../../../lib/dashboard/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Stub now — deterministic template. Real model later will replace buildSummaryStub
// with an LLM call, keeping the same response shape per locked spec §8.
export async function POST(request: Request) {
  return api(async () => {
    let body: unknown = {};
    try {
      body = await jsonBody(request);
    } catch {
      body = {};
    }
    const parsed = summaryRequestSchema.safeParse(body);
    const input = parsed.success ? parsed.data : {};

    // If client supplied aggregated fields, honor them; otherwise recompute server-side
    // so the endpoint works even when called without a body.
    if (
      typeof input.totalRevenue === 'number' &&
      typeof input.unitsSold === 'number' &&
      typeof input.totalOrders === 'number'
    ) {
      return buildSummaryStub({
        totalRevenue: input.totalRevenue,
        unitsSold: input.unitsSold,
        totalOrders: input.totalOrders,
        bestSellerTitle: input.bestSellerTitle ?? null,
        topTaskMessage: input.topTaskMessage ?? null,
      });
    }

    const { catalogs, orders } = await getDashboardData();
    const overview = computeOverview(catalogs, orders, true);
    const agg = aggregateProducts(orders);
    let bestSellerTitle: string | null = null;
    let bestUnits = -1;
    for (const [, v] of agg) if (v.unitsSold > bestUnits) { bestUnits = v.unitsSold; bestSellerTitle = v.title; }

    return buildSummaryStub({
      totalRevenue: overview.totalRevenue,
      unitsSold: overview.unitsSold,
      totalOrders: overview.totalOrders,
      bestSellerTitle,
      topTaskMessage: input.topTaskMessage ?? null,
    });
  });
}
