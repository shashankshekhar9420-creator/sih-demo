'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, Upload, X } from 'lucide-react';
import { ContinueLabel, ErrorNotice } from './ui';

const angles = [
  { title: 'The whole creation', detail: 'Main view', hint: 'Let the full shape be seen.' },
  { title: 'A different angle', detail: 'Side or detail', hint: 'Show what makes it special.' },
  { title: 'The little details', detail: 'Texture close-up', hint: 'Bring your handwork closer.' },
];

export function ImageUpload({ busy, existing, onUpload, onContinue, onDirty }: {
  busy: boolean; existing: string[]; onUpload: (files: File[]) => Promise<void>; onContinue: () => void; onDirty: (dirty: boolean) => void;
}) {
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const target = useRef<number | null>(null);
  const count = files.filter(Boolean).length;
  useEffect(() => {
    const urls = files.map(file => file ? URL.createObjectURL(file) : '');
    setPreviews(urls);
    onDirty(files.some(Boolean));
    return () => urls.forEach(url => { if (url) URL.revokeObjectURL(url); });
  }, [files, onDirty]);

  function addFiles(incoming: File[], index: number | null = null) {
    if (busy) return;
    setError('');
    if (!incoming.length) return;
    if (incoming.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024)) {
      setError('Choose JPG or PNG photographs, each between 1 byte and 10 MB.'); return;
    }
    if ((index !== null && incoming.length !== 1) || (index === null && incoming.length > 3 - count)) {
      setError(index !== null ? 'Choose one photograph for this view.' : 'We need exactly 3 photographs. Remove a photo before adding another.'); return;
    }
    setFiles(previous => {
      const next = [...previous];
      if (index !== null) next[index] = incoming[0];
      else for (const file of incoming) next[next.indexOf(null)] = file;
      return next;
    });
  }
  return <div className="photo-step">
    <div className="tip-note"><span className="small-emblem"><Camera size={19} /></span><p><strong>A window and a plain background are all you need.</strong><br />Use natural light. Keep the whole product in focus.</p><span className="badge">{count} / 3 photos</span></div>
    {existing.length === 3 && <div className="notice warning-notice"><div><strong>Replacing photos starts this catalog over.</strong><p>All three images will be replaced. Processed images, recordings, generated text, pricing, and stock will reset. An existing marketplace listing stays unchanged until you publish again.</p><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /> I understand. Replace this catalog&apos;s photos.</label></div></div>}
    <div className={`image-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
      <div className="photo-slots">{angles.map((angle, index) => <div className={`photo-slot ${files[index] ? 'filled' : ''}`} key={angle.title}><div className="photo-slot-image">{previews[index] ? <><img src={previews[index]} alt={`${angle.detail} preview`} /><span className="photo-check"><Check size={15} /></span><button type="button" className="icon-button photo-remove" disabled={busy} aria-label={`Remove ${angle.detail} photo`} onClick={() => setFiles(previous => previous.map((file, i) => i === index ? null : file))}><X size={16} /></button></> : <button className="photo-add" disabled={busy} onClick={() => { target.current = index; picker.current?.click(); }}><span className="photo-number">0{index + 1}</span><ImagePlus size={32} strokeWidth={1.2} /><strong>{angle.detail}</strong><span>Choose a photo</span></button>}</div><div className="photo-slot-caption"><h3>{angle.title}</h3><p>{angle.hint}</p></div></div>)}</div>
      <div className="dropzone-actions"><p><Upload size={17} /> Drop your photos here, or</p><button className="button secondary" disabled={busy || count === 3} onClick={() => { target.current = null; picker.current?.click(); }}>Choose photos</button><button className="button secondary" disabled={busy || count === 3} onClick={() => { target.current = files.indexOf(null); camera.current?.click(); }}><Camera size={17} /> Take a photo</button></div><p className="fine-print">Exactly 3 photos. JPG or PNG. Up to 10 MB each.</p>
    </div>
    <input ref={picker} type="file" className="visually-hidden" tabIndex={-1} accept="image/jpeg,image/png" multiple onChange={event => { addFiles(Array.from(event.target.files ?? []), target.current); event.target.value = ''; }} />
    <input ref={camera} type="file" className="visually-hidden" tabIndex={-1} accept="image/jpeg,image/png" capture="environment" onChange={event => { addFiles(Array.from(event.target.files ?? []), target.current); event.target.value = ''; }} />
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <div className="step-actions"><span className="save-hint">Photos are saved when you continue.</span><div>{existing.length === 3 && count === 0 && <button className="button primary" disabled={busy} onClick={onContinue}>Keep current photos <Check size={17} /></button>}{count > 0 || existing.length !== 3 ? <button className="button primary" disabled={busy || count !== 3 || (existing.length === 3 && !confirmed)} onClick={() => void onUpload(files as File[])}><ContinueLabel busy={busy}>{busy ? 'Saving photographs...' : 'Save 3 photos & continue'}</ContinueLabel></button> : null}</div></div>
  </div>;
}
