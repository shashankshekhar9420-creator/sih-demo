'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BarChart3, BadgeIndianRupee, Boxes, Clock3, Layers, Sparkles, TrendingUp, Volume2 } from 'lucide-react';
import { rupees } from '@sahaj/shared';
import {
  inventoryResponseSchema,
  overviewResponseSchema,
  pricingFlagsResponseSchema,
  profitabilityResponseSchema,
  rankedResponseSchema,
  summaryResponseSchema,
  tasksResponseSchema,
  trendsResponseSchema,
} from '../../lib/dashboard/schemas';
import { request } from '../client-api';
import { ErrorNotice, LoadingPanel } from '../ui';

type Overview = typeof overviewResponseSchema._type;
type Ranked = typeof rankedResponseSchema._type;
type Inventory = typeof inventoryResponseSchema._type;
type Profit = typeof profitabilityResponseSchema._type;
type Pricing = typeof pricingFlagsResponseSchema._type;
type Tasks = typeof tasksResponseSchema._type;
type Trends = typeof trendsResponseSchema._type;
type Summary = typeof summaryResponseSchema._type;

function deltaLabel(v: number | null) {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}%`;
}

function deltaClass(v: number | null) {
  if (v === null) return 'delta-neutral';
  if (v > 0) return 'delta-up';
  if (v < 0) return 'delta-down';
  return 'delta-neutral';
}

export function BusinessDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ranked, setRanked] = useState<Ranked | null>(null);
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [profit, setProfit] = useState<Profit | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLang, setSummaryLang] = useState<'en' | 'hi'>('en');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    const opts = { signal: c.signal };
    Promise.all([
      request('/api/dashboard/overview', overviewResponseSchema, opts),
      request('/api/dashboard/products-ranked', rankedResponseSchema, opts),
      request('/api/dashboard/inventory', inventoryResponseSchema, opts),
      request('/api/dashboard/profitability', profitabilityResponseSchema, opts),
      request('/api/dashboard/pricing-flags', pricingFlagsResponseSchema, opts),
      request('/api/dashboard/tasks', tasksResponseSchema, opts),
      request('/api/dashboard/trends', trendsResponseSchema, opts),
    ])
      .then(([o, r, inv, p, pf, t, tr]) => {
        if (c.signal.aborted) return;
        setOverview(o);
        setRanked(r);
        setInventory(inv);
        setProfit(p);
        setPricing(pf);
        setTasks(t);
        setTrends(tr);
        // Fire summary after overview/ranked/tasks ready
        const bestTitle = r.bestSellers[0]?.title ?? null;
        const topTask = t.tasks[0]?.message ?? null;
        fetch('/api/dashboard/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalRevenue: o.totalRevenue,
            unitsSold: o.unitsSold,
            totalOrders: o.totalOrders,
            bestSellerTitle: bestTitle,
            topTaskMessage: topTask,
          }),
          signal: c.signal,
          cache: 'no-store',
        })
          .then(res => res.json())
          .then(body => {
            const parsed = summaryResponseSchema.safeParse(body);
            if (parsed.success && !c.signal.aborted) setSummary(parsed.data);
          })
          .catch(() => {});
      })
      .catch(e => {
        if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load Business Manager.');
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh]);

  if (loading && !overview) return <LoadingPanel label="Opening your Business Manager..." />;
  if (error) return <div className="dashboard"><ErrorNotice retry={() => setRefresh(v => v + 1)}>{error}</ErrorNotice></div>;
  if (!overview || !ranked || !inventory || !profit || !pricing || !tasks || !trends) return null;

  const maxDailyRev = Math.max(1, ...overview.daily.map(d => d.revenue));

  return (
    <div className="dashboard business-dashboard">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BUSINESS MANAGER</span>
          <h1>Your business, at a glance.</h1>
          <p>Sales, stock, profit, and what to do next — all in one place.</p>
        </div>
        <button className="button secondary small-button" onClick={() => setRefresh(v => v + 1)}>Refresh</button>
      </div>

      {/* Summary (AI stub) */}
      <section className="panel business-summary" aria-label="Summary">
        <div className="business-summary-head">
          <span className="eyebrow"><Sparkles size={14} /> Plain-language summary</span>
          <span className="fine-print">Stub — deterministic template. Real model later.</span>
        </div>
        {summary ? (
          <>
            <p className="business-summary-text">{summaryLang === 'en' ? summary.summaryEnglish : summary.summaryHindi}</p>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className={`button small-button ${summaryLang === 'en' ? 'primary' : 'secondary'}`} onClick={() => setSummaryLang('en')}>English</button>
              <button className={`button small-button ${summaryLang === 'hi' ? 'primary' : 'secondary'}`} onClick={() => setSummaryLang('hi')}>हिन्दी</button>
              <span className="save-hint"><Volume2 size={14} /> Audio {summary.audioUrl ? <a href={summary.audioUrl}>Play</a> : 'coming soon (null in stub)'}</span>
            </div>
          </>
        ) : (
          <p className="fine-print">Generating summary…</p>
        )}
      </section>

      {/* Overview stats */}
      <section aria-label="Sales overview">
        <div className="section-heading"><h2>Sales overview</h2><span className="fine-print">Last 30 days</span></div>
        <div className="stats-grid">
          <article className="stat-card"><div><span>Total revenue</span><BadgeIndianRupee size={18} /></div><strong>{rupees(overview.totalRevenue)}</strong><p>{overview.totalOrders} orders · {overview.unitsSold} units</p></article>
          <article className="stat-card"><div><span>Today vs yesterday</span><TrendingUp size={18} /></div><strong className={deltaClass(overview.todayVsYesterday?.revenueDelta ?? null)}>{deltaLabel(overview.todayVsYesterday?.revenueDelta ?? null)} revenue</strong><p>{deltaLabel(overview.todayVsYesterday?.ordersDelta ?? null)} orders</p></article>
          <article className="stat-card"><div><span>Week vs last week</span><BarChart3 size={18} /></div><strong className={deltaClass(overview.weekVsLastWeek?.revenueDelta ?? null)}>{deltaLabel(overview.weekVsLastWeek?.revenueDelta ?? null)} revenue</strong><p>{deltaLabel(overview.weekVsLastWeek?.ordersDelta ?? null)} orders</p></article>
          <article className="stat-card"><div><span>Commerce</span><Boxes size={18} /></div><strong>{overview.commerceAvailable ? 'Connected' : 'Unavailable'}</strong><p>{overview.commerceAvailable ? 'Orders live from marketplace' : 'Showing catalogs only'}</p></article>
        </div>
        {/* Tiny sparkline: daily revenue */}
        <div className="trend-bars" aria-label="Daily revenue last 30 days" role="img">
          {overview.daily.map(d => (
            <span
              key={d.date}
              className="trend-bar"
              title={`${d.date}: ${rupees(d.revenue)} · ${d.orders} orders`}
              style={{ height: `${Math.max(4, Math.round((d.revenue / maxDailyRev) * 56))}px` }}
            />
          ))}
        </div>
        <p className="fine-print">Bars show daily revenue for 30 days. Hover for details. {overview.commerceAvailable ? '' : 'Marketplace unavailable — bars show zero.'}</p>
      </section>

      {/* Tasks */}
      <section aria-label="To-do list" className="panel">
        <div className="section-heading" style={{ marginBottom: 12 }}><h2>What to do next</h2><span className="badge">{tasks.tasks.length} tasks</span></div>
        {tasks.tasks.length === 0 ? <p className="fine-print">All clear — nothing urgent right now.</p> : (
          <ul className="task-list">
            {tasks.tasks.map((t, i) => (
              <li key={`${t.type}-${i}`} className={`task-row task-${t.type}`}>
                <AlertTriangle size={16} />
                <span>{t.message}</span>
                <span className="badge">{t.type.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ranked products */}
      <section className="panel" aria-label="Best and worst sellers">
        <h2>Best & worst sellers</h2>
        <p className="fine-print" style={{ marginBottom: 16 }}>By units sold. Stagnant = no sale in 21 days.</p>
        <div className="rank-grid">
          <div>
            <h3>Best sellers</h3>
            {ranked.bestSellers.slice(0, 5).map(r => (
              <div key={r.productId} className="rank-row">
                {r.image ? <img src={r.image} alt="" /> : <span className="rank-placeholder"><Layers size={18} /></span>}
                <div><strong>{r.title}</strong><span>{r.unitsSold} units · {rupees(r.revenue)}{r.stagnant ? ' · stagnant' : ''}</span></div>
              </div>
            ))}
            {ranked.bestSellers.length === 0 && <p className="fine-print">No sales yet.</p>}
          </div>
          <div>
            <h3>Slow sellers</h3>
            {ranked.worstSellers.slice(0, 5).map(r => (
              <div key={r.productId} className="rank-row">
                {r.image ? <img src={r.image} alt="" /> : <span className="rank-placeholder"><Layers size={18} /></span>}
                <div><strong>{r.title}</strong><span>{r.unitsSold} units · {rupees(r.revenue)}{r.stagnant ? ' · stagnant' : ''}</span></div>
              </div>
            ))}
            {ranked.worstSellers.length === 0 && <p className="fine-print">No sales yet.</p>}
          </div>
        </div>
      </section>

      {/* Inventory */}
      <section className="panel" aria-label="Inventory">
        <h2>Inventory & stock health</h2>
        <p className="fine-print" style={{ marginBottom: 12 }}>{inventory.note}</p>
        {inventory.items.length === 0 ? <p className="fine-print">No published listings.</p> : (
          <div className="table-wrap">
            <table className="business-table">
              <thead><tr><th>Product</th><th>Est. stock</th><th>Avg/day (14d)</th><th>Days of supply</th><th>Flags</th></tr></thead>
              <tbody>
                {inventory.items.map(row => (
                  <tr key={row.catalogId}>
                    <td>{row.title ?? 'Untitled'}<br /><span className="fine-print">{row.category ?? '—'}</span></td>
                    <td><strong>{row.estimatedCurrentStock}</strong> <span className="fine-print">/ {row.originalStock}</span></td>
                    <td>{row.averageDailyUnitsSold}</td>
                    <td>{row.daysOfSupply ?? '—'}</td>
                    <td>
                      {row.lowStock && <span className="badge badge-failed">Low stock</span>} {row.fastMoving && <span className="badge badge-published">Fast</span>} {row.slowMoving && <span className="badge">Slow</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Profitability */}
      <section className="panel" aria-label="Profitability">
        <h2>Profitability</h2>
        <p className="fine-print" style={{ marginBottom: 12 }}>Profit uses order history unit price minus material cost. Excludes products where material cost is missing.</p>
        {profit.rankedByProfitDesc.length === 0 && profit.unavailable.length === 0 ? <p className="fine-print">No profit data — publish and get orders, or add material cost.</p> : (
          <>
            {profit.rankedByProfitDesc.length > 0 && (
              <div className="table-wrap">
                <table className="business-table">
                  <thead><tr><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Margin</th></tr></thead>
                  <tbody>
                    {profit.rankedByProfitDesc.slice(0, 8).map(r => (
                      <tr key={r.catalogId}>
                        <td>{r.title ?? 'Untitled'}</td>
                        <td>{r.totalUnitsSold}</td>
                        <td>{rupees(r.totalRevenue)}</td>
                        <td><strong>{rupees(r.totalProfit)}</strong></td>
                        <td>{r.marginPercent != null ? `${r.marginPercent}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {profit.unavailable.length > 0 && (
              <p className="warning-notice notice" style={{ marginTop: 12 }}><AlertTriangle size={16} /> {profit.unavailable.length} product(s) have no material cost — excluded from ranking.</p>
            )}
          </>
        )}
      </section>

      {/* Pricing flags */}
      <section className="panel" aria-label="Pricing intelligence">
        <h2>Pricing intelligence</h2>
        <p className="fine-print" style={{ marginBottom: 12 }}>Compares final price vs recommended (material cost × 2). Threshold ±20%.</p>
        {pricing.items.length === 0 ? <p className="fine-print">No published listings.</p> : (
          <div className="table-wrap">
            <table className="business-table">
              <thead><tr><th>Product</th><th>Recommended</th><th>Final</th><th>Flag</th><th>Suggestion</th></tr></thead>
              <tbody>
                {pricing.items.map(r => (
                  <tr key={r.catalogId}>
                    <td>{r.title ?? 'Untitled'}</td>
                    <td>{r.recommendedPrice != null ? rupees(r.recommendedPrice) : '—'}</td>
                    <td>{r.finalPrice != null ? rupees(r.finalPrice) : '—'}</td>
                    <td>{r.overpriced ? <span className="badge badge-failed">Overpriced</span> : r.underpriced ? <span className="badge">Underpriced</span> : <span className="badge badge-published">OK</span>}{r.stagnant ? ' · stagnant' : ''}</td>
                    <td>{r.suggestedNewPrice != null ? rupees(r.suggestedNewPrice) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Trends */}
      <section className="panel" aria-label="Trends and forecasting">
        <h2>Trends</h2>
        <p className="fine-print" style={{ marginBottom: 12 }}>{trends.note}</p>
        <div className="trend-kpis">
          <div><span>Week over week</span><strong className={deltaClass(trends.weekOverWeek?.revenueDelta ?? null)}>{deltaLabel(trends.weekOverWeek?.revenueDelta ?? null)} revenue</strong><span className="fine-print">{deltaLabel(trends.weekOverWeek?.ordersDelta ?? null)} orders</span></div>
          <div><span>Month over month</span><strong className={deltaClass(trends.monthOverMonth?.revenueDelta ?? null)}>{deltaLabel(trends.monthOverMonth?.revenueDelta ?? null)} revenue</strong><span className="fine-print">{deltaLabel(trends.monthOverMonth?.ordersDelta ?? null)} orders</span></div>
        </div>
        {/* 7-day SMA list (compact) */}
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="business-table">
            <thead><tr><th>Date</th><th>Revenue</th><th>7-day SMA</th></tr></thead>
            <tbody>
              {trends.movingAverage7d.slice(-14).map(r => (
                <tr key={r.date}><td>{r.date}</td><td>{rupees(r.revenue)}</td><td>{r.sma7 != null ? rupees(r.sma7) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {trends.upcomingSeasons.length > 0 && (
          <div className="notice" style={{ marginTop: 16 }}><Clock3 size={18} /><div><strong>Season ahead</strong>{trends.upcomingSeasons.map(s => <p key={`${s.category}-${s.occasion}`}>{s.category}: {s.occasion} — {s.note}</p>)}</div></div>
        )}
        {trends.upcomingSeasons.length === 0 && <p className="fine-print" style={{ marginTop: 12 }}>No festival peak in the next ~6 weeks for your categories.</p>}
      </section>

      <p className="fine-print">Business Manager data is cached per request and not stored. <a href="/business" className="text-link">Refresh <ArrowUpRight size={12} /></a></p>
    </div>
  );
}
