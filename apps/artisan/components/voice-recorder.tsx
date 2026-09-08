'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FileAudio, Mic, Square, Volume2, X } from 'lucide-react';
import { questions } from '@sahaj/shared';
import type { Catalog } from '../lib/catalog';
import { ContinueLabel, DemoNotice, ErrorNotice } from './ui';

const audioTypes: Record<string, string> = { 'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };

export function VoiceRecorder({ catalog, busy, onTranscribe, onContinue, onDirty }: {
  catalog: Catalog; busy: boolean; onTranscribe: (files: File[]) => Promise<void>; onContinue: () => void; onDirty: (dirty: boolean) => void;
}) {
  const [question, setQuestion] = useState(0);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const attempt = useRef(0);
  const active = useRef(false);
  const mounted = useRef(true);
  const discarded = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaBusy = recording || starting || finishing;
  const locked = busy || uploading || mediaBusy;
  const changed = files.some(Boolean);
  const count = questions.filter((_, index) => files[index] || catalog.audioPaths[index]).length;
  const current = questions[question];

  useEffect(() => {
    mounted.current = true;
    setSupported(typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia);
    return () => {
      mounted.current = false; attempt.current++; discarded.current = true; active.current = false;
      if (recorder.current) {
        recorder.current.ondataavailable = null; recorder.current.onstop = null; recorder.current.onerror = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      stream.current?.getTracks().forEach(track => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    const urls = files.map(file => file ? URL.createObjectURL(file) : '');
    setPreviews(urls);
    return () => urls.forEach(url => { if (url) URL.revokeObjectURL(url); });
  }, [files]);
  useEffect(() => { onDirty(changed || mediaBusy); }, [changed, mediaBusy, onDirty]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  function stop(cancel = false) {
    discarded.current = cancel;
    attempt.current++; active.current = false;
    if (recorder.current && recorder.current.state !== 'inactive') {
      setFinishing(true); recorder.current.stop();
    }
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    setStarting(false); setRecording(false);
  }

  function acceptFile(file: File) {
    const type = file.type.split(';')[0].toLowerCase();
    if (!Object.hasOwn(audioTypes, type) || !file.size || file.size > 20 * 1024 * 1024) {
      setError('Use a nonempty WebM, WAV, MP3, MP4, or Ogg audio file, up to 20 MB.'); return;
    }
    setError('');
    setFiles(previous => previous.map((item, index) => index === question ? file : item));
  }

  async function start() {
    if (active.current || locked) return;
    active.current = true;
    const token = ++attempt.current;
    setError(''); setStarting(true); setSeconds(0); discarded.current = false;
    window.speechSynthesis?.cancel();
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || token !== attempt.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const instance = mime ? new MediaRecorder(acquired, { mimeType: mime }) : new MediaRecorder(acquired);
      recorder.current = instance;
      const chunks: Blob[] = [];
      let size = 0;
      instance.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); size += event.data.size; }
        if (size > 20 * 1024 * 1024 && instance.state !== 'inactive') {
          stop(true); setError('This recording reached 20 MB. Please make a shorter recording.');
        }
      };
      instance.onerror = () => { stop(true); if (mounted.current) setError('The microphone stopped unexpectedly. Try again or upload an audio file.'); };
      instance.onstop = () => {
        acquired?.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        active.current = false; setFinishing(false); setRecording(false);
        if (discarded.current) return;
        const type = (instance.mimeType || chunks[0]?.type || '').split(';')[0];
        if (!Object.hasOwn(audioTypes, type)) { setError('This browser records an unsupported format. Please upload a supported audio file instead.'); return; }
        acceptFile(new File(chunks, `question-${question + 1}.${audioTypes[type]}`, { type }));
      };
      instance.start(1000); setStarting(false); setRecording(true);
    } catch {
      acquired?.getTracks().forEach(track => track.stop());
      if (!mounted.current || token !== attempt.current) return;
      active.current = false; setStarting(false); setRecording(false);
      setError('Microphone access is unavailable. Allow it in your browser settings, or upload a recording below.');
    }
  }

  async function submit() {
    if (locked || count !== 3) return;
    setUploading(true); setError('');
    try {
      const allFiles = await Promise.all(questions.map(async (_, index) => {
        if (files[index]) return files[index]!;
        const response = await fetch(catalog.audioPaths[index]);
        if (!response.ok) throw new Error(`Could not load recording ${index + 1}. Please record it again.`);
        const blob = await response.blob();
        return new File([blob], `question-${index + 1}.${audioTypes[blob.type.split(';')[0]] ?? 'webm'}`, { type: blob.type });
      }));
      if (!mounted.current) return;
      await onTranscribe(allFiles);
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'Could not send your recordings.'); }
    finally { if (mounted.current) setUploading(false); }
  }

  function speakQuestion() {
    if (!('speechSynthesis' in window)) { setError('Reading aloud is not supported in this browser. You can read the Hindi question or its English guide below.'); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(current.hindi); utterance.lang = 'hi-IN'; utterance.rate = 0.85;
    utterance.onerror = event => { if (mounted.current && !['canceled', 'interrupted'].includes(event.error)) setError('A Hindi voice is not available here. Please use the question shown on screen.'); };
    window.speechSynthesis.speak(utterance);
  }

  return <div className="voice-step">
    <DemoNotice>Voice transcription is a demo: each question receives its own fixed Hindi transcript and English translation, not a transcription of your audio. Replace generated text with your real product facts before publishing.</DemoNotice>
    {catalog.title && changed && <div className="notice warning-notice"><div><strong>Transcribing again resets generated content and prices.</strong><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={locked} /> I understand and want to regenerate this catalog.</label></div></div>}
    <div className="voice-question-tabs" aria-label="Recording questions">{questions.map((item, index) => <button key={item.title} disabled={locked} className={question === index ? 'current' : ''} onClick={() => { window.speechSynthesis?.cancel(); setQuestion(index); setError(''); }} aria-pressed={question === index}><span>{files[index] || catalog.audioPaths[index] ? <Check size={17} /> : `0${index + 1}`}</span><div><small>QUESTION {index + 1}</small><strong>{item.title}</strong></div></button>)}</div>
    <section className={`recording-card ${recording ? 'is-recording' : ''}`}>
      <div className="recording-card-top"><span className="eyebrow">QUESTION {question + 1} OF 3</span><button className="button secondary small-button" disabled={locked} onClick={speakQuestion}><Volume2 size={17} /> Listen to question</button></div>
      <h2 lang="hi" className="hindi-question">{current.hindi}</h2><p className="question-translation">{current.english}</p>
      <div className="microphone-area"><span className={`microphone-orbit ${recording ? 'recording' : ''}`}><Mic size={38} strokeWidth={1.3} /></span><div className="recording-state" role="status">{recording ? <><span className="recording-dot" /> Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</> : starting ? 'Waiting for microphone permission...' : finishing ? 'Preparing your recording...' : files[question] || catalog.audioPaths[question] ? 'Your answer is ready to listen to.' : 'Take your time. Tell it in your own words.'}</div>
        {recording ? <div className="button-row"><button className="button primary" onClick={() => stop()}><Square size={17} fill="currentColor" /> Stop & keep recording</button><button className="button secondary" onClick={() => stop(true)}><X size={17} /> Cancel</button></div> : starting ? <button className="button secondary" onClick={() => stop(true)}>Cancel microphone request</button> : <button className="button primary record-button" disabled={!supported || locked} onClick={() => void start()}><Mic size={19} />{files[question] || catalog.audioPaths[question] ? 'Record a new answer' : 'Start recording'}</button>}
      </div>
      {!supported && <p className="fallback-note">Microphone recording isn&apos;t available here. Upload an audio file instead.</p>}
      {(previews[question] || catalog.audioPaths[question]) && <div className="audio-preview"><span><Check size={16} /> Answer {question + 1} {files[question] ? '(not saved yet)' : '(saved)'}</span><audio key={previews[question] || catalog.audioPaths[question]} controls preload="metadata" src={previews[question] || catalog.audioPaths[question]} aria-label={`Preview answer ${question + 1}`} />{files[question] && <button className="text-link" disabled={locked} onClick={() => setFiles(previous => previous.map((file, index) => index === question ? null : file))}>Discard new recording</button>}</div>}
      <div className="audio-fallback"><span>Prefer an existing recording?</span><button className="button secondary small-button" disabled={locked} onClick={() => fileInput.current?.click()}><FileAudio size={17} /> Upload audio</button><small>WebM, WAV, MP3, MP4 or Ogg. Max 20 MB.</small></div>
      <input ref={fileInput} type="file" className="visually-hidden" tabIndex={-1} accept="audio/webm,audio/wav,audio/mpeg,audio/mp4,audio/ogg,.webm,.wav,.mp3,.m4a,.mp4,.ogg" onChange={event => { const file = event.target.files?.[0]; if (file) acceptFile(file); event.target.value = ''; }} />
    </section>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    <div className="question-pagination"><button className="button secondary" disabled={locked || question === 0} onClick={() => { window.speechSynthesis?.cancel(); setQuestion(value => value - 1); }}><ChevronLeft size={17} /> Previous question</button><span>{count} of 3 answers ready</span><button className="button secondary" disabled={locked || question === 2} onClick={() => { window.speechSynthesis?.cancel(); setQuestion(value => value + 1); }}>Next question <ChevronRight size={17} /></button></div>
    {catalog.englishTranslations.length === 3 && <section className="transcript-section"><div className="section-heading"><div><span className="eyebrow">ONE RESULT FOR EACH QUESTION</span><h2>Your saved voice results</h2></div><span className="badge">Source: {catalog.sourceLanguage === 'hi' ? 'Hindi' : catalog.sourceLanguage ?? 'Detected language'}</span></div>{questions.map((item, index) => <details className="transcript-card" key={item.title}><summary><span>0{index + 1}</span> {item.title}<span className="badge">Demo result</span></summary><div className="bilingual-grid"><div><span className="field-caption">HINDI TRANSCRIPT</span><p lang="hi">{catalog.regionalTranscripts[index]}</p></div><div><span className="field-caption">ENGLISH TRANSLATION</span><p>{catalog.englishTranslations[index]}</p></div></div></details>)}</section>}
    <div className="step-actions"><span className="save-hint">Exactly 3 answers, one for each question.</span>{!changed && catalog.englishTranslations.length === 3 ? <button className="button primary" disabled={locked} onClick={onContinue}><ContinueLabel>Keep results & continue</ContinueLabel></button> : <button className="button primary" disabled={locked || count !== 3 || (!!catalog.title && changed && !confirmed)} onClick={() => void submit()}><ContinueLabel busy={busy || uploading}>{busy || uploading ? 'Preparing 3 voice results...' : 'Save & transcribe 3 answers'}</ContinueLabel></button>}</div>
  </div>;
}
