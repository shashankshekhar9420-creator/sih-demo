'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, ImagePlus, Minus, Plus, Save, Store, Trash2 } from 'lucide-react';
import { categories, rupees } from '@sahaj/shared';
import type { Catalog } from '../lib/catalog';
import { reviewSchema, safeProductUrl, type ReviewValues } from './client-api';
import { ContinueLabel, DemoNotice, ErrorNotice, StatusBadge } from './ui';

export function StockStepper({ value, onChange, disabled = false, id = 'stock' }: { value: string; onChange: (value: string) => void; disabled?: boolean; id?: string }) {
  return <div className="stock-stepper"><button type="button" aria-label="Decrease stock" disabled={disabled || Number(value) <= 0} onClick={() => onChange(String(Math.max(0, Number(value || 0) - 1)))}><Minus size={20} /></button><input id={id} aria-label="Available stock" type="number" inputMode="numeric" min="0" max="100000" step="1" required value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /><button type="button" aria-label="Increase stock" disabled={disabled || Number(value) >= 100000} onClick={() => onChange(String(Math.min(100000, Number(value || 0) + 1)))}><Plus size={20} /></button></div>;
}

export function ImageComparison({ catalog }: { catalog: Catalog }) {
  return <div className="comparison-grid">{[['Original photographs', catalog.rawImages], ['Studio copies', catalog.processedImages]].map(([title, images]) => <div key={title as string}><div className="comparison-label"><strong>{title as string}</strong><span className="badge">3 photos</span></div><div className="thumbnail-trio">{(images as string[]).map((src, index) => <a key={src} href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open ${title} ${index + 1} in a new tab`}><img src={src} alt={`${title}, ${['main view', 'detail view', 'texture close-up'][index]}`} loading="lazy" /><span>0{index + 1}</span></a>)}</div></div>)}</div>;
}

export function CatalogReview({ catalog, busy, onSave, onPublish, onReplace, onReprice, onDirty }: {
  catalog: Catalog; busy: boolean; onSave: (values: ReviewValues, exit?: boolean) => Promise<void>; onPublish: (values: ReviewValues) => Promise<void>;
  onReplace: () => void; onReprice: () => void; onDirty: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState({
    title: catalog.title ?? '', hindiTitle: catalog.hindiTitle ?? '', category: catalog.category ?? '', description: catalog.description ?? '', hindiDescription: catalog.hindiDescription ?? '',
    bullets: catalog.bullets.join('\n'), hindiBullets: catalog.hindiBullets.join('\n'), keywords: catalog.keywords.join(', '),
    recommendedPrice: String(catalog.recommendedPrice ?? ''), finalPrice: String(catalog.finalPrice ?? ''), stock: String(catalog.stock),
  });
  const [specifics, setSpecifics] = useState(Object.entries(catalog.specifics));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  function change(key: keyof typeof form, value: string) { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); }
  function values(): ReviewValues | null {
    setError('');
    const keys = specifics.map(([key]) => key.trim());
    if (keys.some(key => !key) || new Set(keys).size !== keys.length) { setError('Give each product detail a unique, nonempty name.'); return null; }
    if ([form.finalPrice, form.recommendedPrice, form.stock].some(value => !value.trim())) { setError('Enter a recommended price, final price, and stock. Zero is allowed.'); return null; }
    const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
    const parsed = reviewSchema.safeParse({ ...form, bullets: lines(form.bullets), hindiBullets: lines(form.hindiBullets),
      keywords: form.keywords.split(',').map(value => value.trim()).filter(Boolean), specifics: Object.fromEntries(specifics.map(([key, value]) => [key.trim(), value.trim()])),
      recommendedPrice: Number(form.recommendedPrice), finalPrice: Number(form.finalPrice), stock: Number(form.stock),
    });
    if (!parsed.success) { const issue = parsed.error.issues[0]; setError(`Check ${issue.path.join(' ') || 'your details'}: ${issue.message}`); return null; }
    return parsed.data;
  }
  const url = safeProductUrl(catalog.productUrl);
  return <form className="review-form" onSubmit={event => { event.preventDefault(); const parsed = values(); if (parsed && verified) void onPublish(parsed); }}>
    <DemoNotice>This draft contains demo-generated text, not verified product facts. Check both languages and remove placeholders. Studio images have clean white backgrounds; the suggested price is a formula, not market research.</DemoNotice>
    {catalog.commerceListingId && <div className="notice"><Store size={20} /><p>Editing here does not change your marketplace listing until you publish again. Publishing updates the same product, without creating a duplicate.{url && <> <a href={url} target="_blank" rel="noopener noreferrer" className="text-link">View current listing <ArrowUpRight size={15} /></a></>}</p></div>}
    <fieldset disabled={busy} className="review-fieldset">
      <section className="review-section"><div className="section-heading"><div><span className="eyebrow">01 / THE FIRST IMPRESSION</span><h2>Your photographs</h2></div><button type="button" className="button secondary small-button" onClick={onReplace}><ImagePlus size={17} /> Replace photos</button></div><ImageComparison catalog={catalog} /><p className="fine-print">Replacement resets all downstream work. You will be asked to confirm before uploading.</p></section>
      <section className="review-section"><div className="section-heading"><div><span className="eyebrow">02 / IN YOUR OWN WORDS</span><h2>A story in two languages</h2></div><StatusBadge status={catalog.status} /></div><div className="bilingual-grid"><label className="field">Product title <span>English</span><input required maxLength={200} value={form.title} onChange={event => change('title', event.target.value)} /></label><label className="field">Product title <span>Hindi</span><input lang="hi" required maxLength={200} value={form.hindiTitle} onChange={event => change('hindiTitle', event.target.value)} /></label></div><label className="field category-review">Category<select required value={form.category} onChange={event => change('category', event.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><div className="bilingual-grid"><label className="field">The product story <span>English</span><textarea required maxLength={10000} rows={6} value={form.description} onChange={event => change('description', event.target.value)} /></label><label className="field">The product story <span>Hindi</span><textarea lang="hi" required maxLength={10000} rows={6} value={form.hindiDescription} onChange={event => change('hindiDescription', event.target.value)} /></label><label className="field">Highlights <span>English / one bullet per line</span><textarea required rows={5} value={form.bullets} onChange={event => change('bullets', event.target.value)} /><small>1 to 30 highlights, up to 2,000 characters each.</small></label><label className="field">Highlights <span>Hindi / one bullet per line</span><textarea lang="hi" required rows={5} value={form.hindiBullets} onChange={event => change('hindiBullets', event.target.value)} /></label></div></section>
      <section className="review-section"><div className="section-heading"><div><span className="eyebrow">03 / THE DETAILS THAT MATTER</span><h2>What makes it yours</h2></div><button type="button" className="button secondary small-button" disabled={specifics.length >= 20} onClick={() => { setSpecifics(previous => [...previous, ['', '']]); setDirty(true); }}><Plus size={17} /> Add a detail</button></div><p className="section-description">Include verified material, size, color, and weight. Leave out anything you aren&apos;t sure of.</p><div className="specifics-editor">{specifics.map(([key, value], index) => <div className="specific-row" key={index}><label className="field">Detail name<input required maxLength={80} placeholder="e.g. Material" value={key} onChange={event => { setSpecifics(previous => previous.map((pair, i) => i === index ? [event.target.value, pair[1]] : pair)); setDirty(true); }} /></label><label className="field">Value<input maxLength={1000} placeholder="e.g. Natural terracotta clay" value={value} onChange={event => { setSpecifics(previous => previous.map((pair, i) => i === index ? [pair[0], event.target.value] : pair)); setDirty(true); }} /></label><button type="button" className="icon-button" aria-label={`Remove ${key || 'detail'} ${index + 1}`} onClick={() => { setSpecifics(previous => previous.filter((_, i) => i !== index)); setDirty(true); }}><Trash2 size={18} /></button></div>)}</div><label className="field">Keywords<span>Separate with commas</span><input required value={form.keywords} onChange={event => change('keywords', event.target.value)} placeholder="handmade, terracotta, home decor" /><small>1 to 30 words or phrases that help buyers find your creation.</small></label></section>
      <section className="review-section"><div className="section-heading"><div><span className="eyebrow">04 / READY FOR A NEW HOME</span><h2>Price & availability</h2></div><button type="button" className="text-link" onClick={onReprice}>Change making cost <ArrowUpRight size={16} /></button></div><div className="review-price-grid"><div className="cost-summary"><span>Cost to make one</span><strong>{rupees(catalog.materialCost ?? 0)}</strong><small>Demo suggestion: making cost x 2</small></div><label className="field">Recommended price<span>INR / editable</span><input required type="number" inputMode="decimal" min="0" max="10000000" step="0.01" value={form.recommendedPrice} onChange={event => change('recommendedPrice', event.target.value)} /></label><label className="field">Your selling price<span>INR / what buyers pay</span><input required type="number" inputMode="decimal" min="0" max="10000000" step="0.01" value={form.finalPrice} onChange={event => change('finalPrice', event.target.value)} /></label><div className="field"><label htmlFor="review-stock">Ready-to-sell pieces</label><StockStepper id="review-stock" value={form.stock} onChange={value => change('stock', value)} /><small>Zero stock shows as sold out.</small></div></div></section>
      <section className="publish-panel"><span className="publish-emblem"><Store size={28} strokeWidth={1.4} /></span><div><h2>A new chapter for your craft.</h2><p>Take one last look. These are the details your buyers will see.</p><label className="checkbox-label"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} /> I have checked the photos, both languages, details, price, and stock. The facts are accurate.</label></div></section>
    </fieldset>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <div className="review-actions"><div><span className={`save-hint ${dirty ? 'unsaved' : ''}`}><Check size={15} />{dirty ? 'You have unsaved changes' : 'Your latest saved catalog'}</span><button type="button" className="text-link" disabled={busy} onClick={() => { const parsed = values(); if (parsed) void onSave(parsed, true); }}>Save & return to studio</button></div><div className="button-row"><button type="button" disabled={busy} className="button secondary" onClick={() => { const parsed = values(); if (parsed) void onSave(parsed); }}><Save size={17} /> Save changes</button><button type="submit" disabled={busy || !verified} className="button primary"><ContinueLabel busy={busy}>{busy ? 'Saving your work...' : catalog.status === 'FAILED' ? 'Retry publishing' : catalog.commerceListingId ? 'Publish updates' : 'Publish to marketplace'}</ContinueLabel></button></div></div>
  </form>;
}
