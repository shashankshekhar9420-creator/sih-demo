'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Camera, Check, CheckCheck, CircleHelp, Image, Leaf, Mic, Package, RefreshCw, Save, ShieldCheck, Sparkles, Store, Tag, Trash2 } from 'lucide-react';
import { categories, categorySchema, moneySchema, rupees, stockSchema } from '@sahaj/shared';
import type { Catalog } from '../lib/catalog';
import { catalogResponseSchema, dateLabel, deleteCatalogRequest, jsonRequest, request, RequestError, resumeStep, safeProductUrl, type ReviewValues } from './client-api';
import { CatalogReview, ImageComparison, StockStepper } from './catalog-review';
import { ImageUpload } from './image-upload';
import { VoiceRecorder } from './voice-recorder';
import { ContinueLabel, DemoNotice, ErrorNotice, LoadingPanel, StatusBadge, StepHeading } from './ui';

const steps = [
  { title: 'Photographs', short: 'Photos', icon: Camera, description: 'Three views. One beautiful creation.', help: 'Add exactly 3 photographs: a main view, a detail, and a texture close-up.' },
  { title: 'Image studio', short: 'Studio', icon: Image, description: 'A little space for your craft to shine.', help: 'Prepare a separate set of studio images for your listing. Your originals stay safe.' },
  { title: 'Your story', short: 'Voice', icon: Mic, description: 'Nobody knows your craft like you do.', help: 'Answer 3 simple questions in Hindi. Your voice gives your creation its story.' },
  { title: 'Category', short: 'Category', icon: Tag, description: 'Find the right home for your creation.', help: 'Choose the category that fits best. Then prepare your first bilingual catalog draft.' },
  { title: 'Your price', short: 'Price', icon: Sparkles, description: 'Put a value on the work you love.', help: 'Start with what it costs to make one piece. You always choose the final selling price.' },
  { title: 'Ready stock', short: 'Stock', icon: Package, description: 'How many are ready for a new home?', help: 'Count finished pieces that are ready to sell. You can update this later.' },
  { title: 'Review & publish', short: 'Review', icon: Store, description: 'Every detail, just the way you want it.', help: 'Make the words your own, check every fact, and share your work with the marketplace.' },
];

export function CatalogWizard({ id }: { id: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('1');
  const [revision, setRevision] = useState(0);
  const [published, setPublished] = useState(false);
  const mutation = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const endpoint = `/api/catalogs/${encodeURIComponent(id)}`;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request(endpoint, catalogResponseSchema, { signal: controller.signal }).then(({ catalog }) => {
      setCatalog(catalog); setCategory(catalog.category ?? ''); setCost(catalog.materialCost === null ? '' : String(catalog.materialCost)); setStock(String(catalog.stock));
      let initial = resumeStep(catalog);
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(`sahaj-stage:${id}`) ?? 'null');
        if (saved && typeof saved === 'object' && 'updatedAt' in saved && saved.updatedAt === catalog.updatedAt && 'step' in saved && typeof saved.step === 'number' && Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= initial) initial = saved.step;
      } catch { /* The catalog remains resumable when local storage is unavailable. */ }
      setStep(initial); setDirty(false); setMissing(false); setRevision(value => value + 1);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setMissing(error instanceof RequestError && error.status === 404);
      setError(error instanceof Error ? error.message : 'Could not open this catalog.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, id, refresh]);

  useEffect(() => {
    if (!catalog || loading) return;
    try { localStorage.setItem(`sahaj-stage:${id}`, JSON.stringify({ updatedAt: catalog.updatedAt, step })); } catch { /* Server-saved progress does not depend on local storage. */ }
  }, [catalog, id, step, loading]);

  useEffect(() => {
    if (catalog?.status !== 'PROCESSING' || busy) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      request(endpoint, catalogResponseSchema, { signal: controller.signal }).then(({ catalog: latest }) => {
        setCatalog(latest);
        if (latest.status !== 'PROCESSING') {
          setStep(resumeStep(latest)); setCategory(latest.category ?? ''); setCost(latest.materialCost === null ? '' : String(latest.materialCost)); setStock(String(latest.stock)); setRevision(value => value + 1);
        }
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not check progress.'); });
    }, 2500);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [catalog?.status, busy, endpoint]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current || mutation.current) { event.preventDefault(); event.returnValue = ''; }
    }
    function guardLink(event: MouseEvent) {
      const link = (event.target as Element).closest?.('a');
      if (!link || link.target === '_blank' || link.getAttribute('href')?.startsWith('#') || (!dirtyRef.current && !mutation.current)) return;
      if (mutation.current || !window.confirm('You have unsaved changes or recordings. Leave this page and discard them? Completed steps are already saved.')) { event.preventDefault(); event.stopPropagation(); }
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', guardLink, true); };
  }, []);

  useEffect(() => {
    if (loading) return;
    document.getElementById('step-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, loading, published]);

  function go(next: number) {
    if (mutation.current) return;
    if (dirty && !window.confirm('Leave this step without saving your changes? Completed steps will stay saved.')) return;
    setDirty(false); setError(''); setNotice(''); setStep(next);
    if (catalog) { setCategory(catalog.category ?? ''); setCost(catalog.materialCost === null ? '' : String(catalog.materialCost)); setStock(String(catalog.stock)); }
  }

  async function mutate(suffix: string, body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    const result = await request(`${endpoint}${suffix}`, catalogResponseSchema, body instanceof FormData ? { method, body } : jsonRequest(method, body));
    setCatalog(result.catalog);
    return result.catalog;
  }

  async function run(action: () => Promise<void>) {
    if (mutation.current || catalog?.status === 'PROCESSING') return;
    mutation.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); }
    catch (error) {
      setError(error instanceof Error ? error.message : 'This step could not be completed. Please try again.');
      try { const { catalog: latest } = await request(endpoint, catalogResponseSchema); setCatalog(latest); } catch { /* Keep the current editable draft when offline. */ }
    } finally { mutation.current = false; setBusy(false); }
  }

  async function saveReview(values: ReviewValues, exit = false) {
    await run(async () => {
      await mutate('', values, 'PATCH'); setDirty(false); dirtyRef.current = false; setRevision(value => value + 1); setNotice('Your changes are saved. Publish when you are ready.');
      if (exit) router.push('/');
    });
  }

  async function handleDelete() {
    if (locked) return;
    const confirmed = window.confirm(`Are you sure you want to delete "${catalog?.title || 'this catalog'}"? All uploaded photos, voice recordings, and drafts will be permanently deleted.`);
    if (!confirmed) return;
    setBusy(true);
    dirtyRef.current = false;
    mutation.current = false;
    try {
      await deleteCatalogRequest(id);
      router.push('/catalogs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete catalog.');
      setBusy(false);
    }
  }

  if (loading) return <LoadingPanel label="Opening your saved creation..." />;
  if (missing) return <div className="page-recovery"><Leaf size={38} /><h1>This catalog isn&apos;t here.</h1><p>It may have been removed, or the link may be incomplete.</p><Link href="/catalogs" className="button primary">Find my catalogs</Link></div>;
  if (!catalog) return <div className="page-recovery"><h1>Let&apos;s reconnect.</h1><ErrorNotice retry={() => setRefresh(value => value + 1)}>{error}</ErrorNotice><Link href="/" className="button secondary">Back to studio</Link></div>;
  const locked = busy || catalog.status === 'PROCESSING';
  const productUrl = safeProductUrl(catalog.productUrl);

  if (published) return <div className="publish-success"><span className="success-stamp"><CheckCheck size={40} strokeWidth={1.4} /></span><span className="eyebrow">FROM YOUR HANDS. OUT INTO THE WORLD.</span><h1 id="step-title" tabIndex={-1}>Your craft has a new home.</h1><p>Your catalog is published on the marketplace and ready to be discovered.</p><article className="success-product"><img src={catalog.processedImages[0]} alt={catalog.title ?? 'Your published creation'} /><div><StatusBadge status="PUBLISHED" /><span className="catalog-category">{catalog.category}</span><h2>{catalog.title}</h2><p lang="hi">{catalog.hindiTitle}</p><strong>{rupees(catalog.finalPrice ?? 0)}</strong><span>{catalog.stock} pieces available</span></div></article><div className="button-row">{productUrl && <a className="button primary" href={productUrl} target="_blank" rel="noopener noreferrer">View live product <ArrowUpRight size={18} /></a>}<Link href="/" className="button secondary">Back to my studio</Link></div><button className="text-link" onClick={() => { setPublished(false); setStep(6); }}>Make another edit <ArrowRight size={16} /></button><div className="success-note"><Leaf size={18} /><span>Every handmade thing carries a little of its maker. Thank you for sharing yours.</span></div></div>;

  return <div className="wizard">
    <div className="wizard-topline"><Link href="/catalogs" className="text-link"><ArrowLeft size={16} /> My catalogs</Link><div className="wizard-topline-actions"><span className="saved-indicator"><Check size={14} />{busy ? 'Saving...' : dirty ? 'Unsaved changes' : `Saved ${dateLabel(catalog.updatedAt)}`}</span><StatusBadge status={catalog.status} /><button type="button" className="button secondary small-button delete-catalog-btn" disabled={locked} onClick={handleDelete} title="Delete catalog" aria-label="Delete this catalog"><Trash2 size={14} /> Delete</button></div></div>
    <nav className="wizard-progress" aria-label="Catalog steps"><ol>{steps.map(({ title, short, icon: Icon }, index) => <li key={title} className={index === step ? 'current' : index < step ? 'completed' : ''}><button disabled={locked || index > resumeStep(catalog)} onClick={() => go(index)} aria-current={index === step ? 'step' : undefined} aria-label={`Step ${index + 1}: ${title}`}><span className="step-orb">{index < step ? <Check size={18} /> : <Icon size={18} />}</span><span className="step-desktop-label">{title}</span><span className="step-mobile-label">{short}</span></button></li>)}</ol></nav>
    <StepHeading eyebrow={`STEP 0${step + 1} OF 07 / ${steps[step].title.toUpperCase()}`} title={steps[step].description}>{steps[step].help}</StepHeading>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {!error && catalog.errorMessage && <ErrorNotice>{catalog.errorMessage} Your completed work is still saved. Review this step and retry.</ErrorNotice>}
    {notice && <div className="notice success-notice" role="status"><Check size={19} /><p>{notice}</p></div>}
    {catalog.status === 'PROCESSING' && !busy ? <div><LoadingPanel label={`Your catalog is working on ${catalog.processingStep?.replaceAll('-', ' ') ?? 'the current step'}...`} /><p className="fine-print">We are checking automatically. If this takes longer than expected, refresh to check the saved status.</p><button className="button secondary" onClick={() => setRefresh(value => value + 1)}>Refresh status</button></div> : <>
      {step === 0 && <ImageUpload key={`images-${revision}`} existing={catalog.rawImages} busy={locked} onDirty={setDirty} onContinue={() => go(1)} onUpload={files => run(async () => { const form = new FormData(); files.forEach(file => form.append('images', file)); await mutate('/images', form); setDirty(false); setStep(1); })} />}
      {step === 1 && <div className="image-studio-step"><DemoNotice>Studio lighting and automated background removal to pure white are applied to create clean studio copies for your listing. Your original photographs remain safe and unchanged.</DemoNotice><section className="panel image-studio-panel"><div className="section-heading"><div><span className="eyebrow">YOUR CREATION, PRESERVED</span><h2>{catalog.processedImages.length === 3 ? 'Originals & studio copies' : 'A clean start for your listing'}</h2></div><span className="badge"><ShieldCheck size={14} /> Originals kept safe</span></div>{catalog.processedImages.length === 3 ? <ImageComparison catalog={catalog} /> : <div className="studio-originals">{catalog.rawImages.map((src, index) => <figure key={src}><img src={src} alt={`Original product photograph ${index + 1}`} /><figcaption><span>0{index + 1}</span>{['Main view', 'Side & detail', 'Texture close-up'][index]}</figcaption></figure>)}</div>}<div className="studio-promise"><Leaf size={24} strokeWidth={1.4} /><p><strong>Your handwork is the hero.</strong><br />Shape, color, and texture stay exactly as you photographed them.</p></div></section><div className="step-actions"><button className="button secondary" disabled={locked} onClick={() => go(0)}><ArrowLeft size={17} /> Photographs</button>{catalog.processedImages.length === 3 ? <><button type="button" className="button secondary" disabled={locked} onClick={() => void run(async () => { await mutate('/process-images', { images: catalog.rawImages }); setNotice('Studio copies updated with clean white backgrounds. Compare them below, then continue to your story.'); })}><RefreshCw size={16} /> Re-process images</button><button className="button primary" disabled={locked} onClick={() => go(2)}><ContinueLabel>Tell your story</ContinueLabel></button></> : <button className="button primary" disabled={locked} onClick={() => void run(async () => { await mutate('/process-images', { images: catalog.rawImages }); setNotice('Three studio copies are saved. Compare them below, then continue to your story.'); })}><ContinueLabel busy={busy}>{busy ? 'Removing background & preparing studio copies...' : 'Prepare 3 studio copies'}</ContinueLabel></button>}</div></div>}
      {step === 2 && <VoiceRecorder key={`voice-${revision}`} catalog={catalog} busy={locked} onDirty={setDirty} onContinue={() => go(3)} onTranscribe={files => run(async () => { const form = new FormData(); files.forEach((file, index) => form.append(`audio${index + 1}`, file)); await mutate('/transcribe', form); setDirty(false); setRevision(value => value + 1); setNotice('All three recordings are saved. Open each voice result below to review its Hindi transcript and English translation.'); })} />}
      {step === 3 && <form onSubmit={event => { event.preventDefault(); if (!categorySchema.safeParse(category).success) { setError('Choose a category to continue.'); return; } void run(async () => { await mutate('', { category }, 'PATCH'); setDirty(false); const next = await mutate('/generate', { englishTranslations: catalog.englishTranslations, processedImages: catalog.processedImages, category }); setCatalog(next); setCost(''); setStep(4); }); }}><section className="category-panel panel"><span className="section-icon"><Tag size={27} strokeWidth={1.3} /></span><h2>What kind of craft is this?</h2><p>Choose the closest match. You can change it during your final review.</p><label className="field">Product category<select required value={category} disabled={locked} onChange={event => { setCategory(event.target.value); setDirty(event.target.value !== catalog.category); }}><option value="" disabled>Choose your craft...</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label><div className="category-chips" aria-hidden="true"><span>Earth &amp; clay</span><span>Thread &amp; texture</span><span>Wood &amp; wonder</span></div></section><DemoNotice>Catalog content is generated from your voice answers and selected category. Review every field before publishing — always verify materials, dimensions, and pricing before going live.</DemoNotice>{catalog.title && <div className="notice warning-notice"><p>Generating again replaces your edited English and Hindi content, details, keywords, and pricing. To keep your work and only change category, use the review screen instead.</p><button type="button" className="button secondary small-button" onClick={() => go(resumeStep(catalog))}>Keep existing draft</button></div>}<div className="step-actions"><button type="button" disabled={locked} className="button secondary" onClick={() => go(2)}><ArrowLeft size={17} /> Your story</button><button type="submit" disabled={locked || !category} className="button primary"><ContinueLabel busy={busy}>{busy ? 'Preparing your bilingual draft...' : catalog.title ? 'Replace & regenerate draft' : 'Generate my catalog'}</ContinueLabel></button></div></form>}
      {step === 4 && <form onSubmit={event => { event.preventDefault(); const parsed = moneySchema.refine(value => value <= 5000000).safeParse(cost.trim() ? Number(cost) : NaN); if (!parsed.success) { setError('Enter a making cost from 0 to 50,00,000, with at most two decimal places.'); return; } void run(async () => { await mutate('/price', { materialCost: parsed.data, category: catalog.category, description: catalog.description, keywords: catalog.keywords }); setDirty(false); setNotice('Your price suggestion is saved. You can change the final selling price in review.'); }); }}><div className="pricing-layout"><section className="panel cost-panel"><span className="eyebrow">START WITH YOUR COST</span><h2>What does one piece<br />cost you to make?</h2><p>Enter your making cost for one finished product.</p><label className="field" htmlFor="making-cost">Cost per piece (INR)</label><div className="currency-input"><span aria-hidden="true">INR</span><input id="making-cost" type="number" inputMode="decimal" min="0" max="5000000" step="0.01" required placeholder="0.00" value={cost} disabled={locked} onChange={event => { setCost(event.target.value); setDirty(event.target.value !== String(catalog.materialCost ?? '')); }} /></div><p className="fine-print">Include materials and what it takes to make it. Zero cost is allowed.</p><button className="button primary" type="submit" disabled={locked || !cost.trim()}><ContinueLabel busy={busy}>{busy ? 'Calculating...' : catalog.recommendedPrice !== null ? 'Recalculate suggestion' : 'Suggest a selling price'}</ContinueLabel></button></section><aside className="price-suggestion"><span className="small-emblem"><Sparkles size={22} /></span><span className="eyebrow">A STARTING POINT, NOT A RULE</span><h3>{catalog.recommendedPrice !== null ? 'Your suggested price' : 'A price that values your work.'}</h3>{catalog.recommendedPrice !== null ? <><strong className="suggested-amount">{rupees(catalog.recommendedPrice)}</strong><span>per handmade piece</span><div className="price-formula">{rupees(catalog.materialCost ?? 0)} making cost x 2</div><p>Your current selling price is <strong>{rupees(catalog.finalPrice ?? 0)}</strong>. Make it your own in the review.</p></> : <p>We&apos;ll suggest a price after you enter your making cost. The final decision is always yours.</p>}<span className="badge">You choose the final price</span></aside></div><DemoNotice>The suggested price is simply your making cost multiplied by 2. No live market data or price research is used. Recalculating also resets your final price to the new suggestion.</DemoNotice><div className="step-actions"><button type="button" className="button secondary" disabled={locked} onClick={() => go(3)}><ArrowLeft size={17} /> Category</button><button type="button" className="button primary" disabled={locked || dirty || catalog.recommendedPrice === null} onClick={() => go(5)}><ContinueLabel>Continue to stock</ContinueLabel></button></div></form>}
      {step === 5 && <form onSubmit={event => { event.preventDefault(); const parsed = stockSchema.safeParse(stock.trim() ? Number(stock) : NaN); if (!parsed.success) { setError('Enter a whole number of pieces from 0 to 1,00,000.'); return; } void run(async () => { await mutate('', { stock: parsed.data }, 'PATCH'); setDirty(false); setStep(6); setRevision(value => value + 1); }); }}><section className="panel stock-panel"><span className="stock-illustration"><Package size={54} strokeWidth={1} /></span><h2>A few pieces, or a whole collection?</h2><p>How many finished pieces are ready to sell right now?</p><label className="field" htmlFor="stock">Available pieces</label><StockStepper value={stock} onChange={value => { setStock(value); setDirty(value !== String(catalog.stock)); }} disabled={locked} /><span className="stock-unit">{Number(stock) === 1 ? 'handmade piece' : 'handmade pieces'}</span><div className="tip-note"><CircleHelp size={20} /><p>You can start small. Enter 0 if you are not ready to sell yet; the listing will show as sold out.</p></div></section><div className="step-actions"><button type="button" disabled={locked} className="button secondary" onClick={() => go(4)}><ArrowLeft size={17} /> Your price</button><button type="submit" className="button primary" disabled={locked}><ContinueLabel busy={busy}>{busy ? 'Saving stock...' : 'Save stock & review'}</ContinueLabel></button></div></form>}
      {step === 6 && <CatalogReview key={`review-${revision}`} catalog={catalog} busy={locked} onDirty={setDirty} onSave={saveReview} onReplace={() => go(0)} onReprice={() => go(4)} onPublish={values => run(async () => { await mutate('', values, 'PATCH'); setDirty(false); dirtyRef.current = false; await mutate('/publish', {}); setPublished(true); })} />}
    </>}
    <div className="wizard-footnote"><Save size={15} /><span>Completed steps are saved to your catalog. Use Save changes to keep review edits.</span><Link href="/guide">Need a hand? <ArrowUpRight size={14} /></Link></div>
  </div>;
}
