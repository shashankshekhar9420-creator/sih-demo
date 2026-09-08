import { AlertCircle, ArrowRight, Check, LoaderCircle, Sprout } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Catalog } from '../lib/catalog';

export function StatusBadge({ status }: { status: Catalog['status'] }) {
  const labels = { DRAFT: 'In progress', PROCESSING: 'Processing', READY: 'Ready to publish', PUBLISHED: 'Published', FAILED: 'Needs attention' };
  return <span className={`badge badge-${status.toLowerCase()}`}>{status === 'PUBLISHED' && <Check size={12} />}{status === 'PROCESSING' && <LoaderCircle size={12} className="spin" />}{labels[status]}</span>;
}

export function ErrorNotice({ children, retry }: { children: ReactNode; retry?: () => void }) {
  return <div className="notice error-notice" role="alert"><AlertCircle size={20} /><div>{children}</div>{retry && <button className="button small-button secondary" onClick={retry}>Try again</button>}</div>;
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return <div className="notice demo-notice"><span className="demo-label">DEMO</span><p>{children}</p></div>;
}

export function LoadingPanel({ label = 'Opening your studio...' }: { label?: string }) {
  return <div className="loading-panel" role="status"><LoaderCircle className="spin" size={28} /><p>{label}</p><span>Your craft will be right here.</span></div>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Sprout size={32} strokeWidth={1.3} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="step-heading"><span className="eyebrow">{eyebrow}</span><h1 tabIndex={-1} id="step-title">{title}</h1><p>{children}</p></div>;
}

export function ContinueLabel({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return <>{busy && <LoaderCircle className="spin" size={18} />}{children}{!busy && <ArrowRight size={18} />}</>;
}

export function CraftIllustration() {
  return <svg className="craft-illustration" viewBox="0 0 430 310" fill="none" aria-hidden="true">
    <defs><pattern id="weave" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M0 3h12M3 0v12M0 9h12M9 0v12" stroke="#BD9D76" strokeWidth="1" opacity=".5" /></pattern><linearGradient id="clay" x1="150" y1="70" x2="310" y2="270" gradientUnits="userSpaceOnUse"><stop stopColor="#D39771"/><stop offset="1" stopColor="#A55336"/></linearGradient></defs>
    <circle cx="265" cy="141" r="132" fill="#E9DECD"/><path d="M30 267h365" stroke="#BCAE96"/><ellipse cx="233" cy="270" rx="133" ry="13" fill="#806145" opacity=".12"/>
    <path d="M50 182h109l-12 84H63z" fill="#C7AF8B"/><path d="M50 182h109l-12 84H63z" fill="url(#weave)"/><path d="M75 182v-21c0-34 58-34 58 0v21" stroke="#A78B63" strokeWidth="7"/><path d="M51 185h108" stroke="#947651" strokeWidth="5"/>
    <path d="M201 73h62l-6 54c2 16 47 33 49 80 2 30-13 61-25 61h-102c-14 0-28-29-26-59 2-47 46-64 49-82z" fill="url(#clay)"/>
    <ellipse cx="232" cy="75" rx="32" ry="9" fill="#9C543A"/><ellipse cx="232" cy="74" rx="24" ry="5" fill="#6D412F"/><path d="M172 192c31 9 83 10 116 0M166 205c35 9 88 10 128 0M167 219c34 10 88 10 127 0" stroke="#E2B290" strokeWidth="2" opacity=".65"/>
    <path d="M234 70c-2-28 9-54 33-68M238 55c-23-4-35-18-33-34 22 2 33 15 33 34M249 28c24 6 43-2 51-16-22-8-41-1-51 16" stroke="#69765A" strokeWidth="2.4"/><path d="M238 55c-23-4-35-18-33-34 22 2 33 15 33 34M249 28c24 6 43-2 51-16-22-8-41-1-51 16" fill="#899276"/>
    <path d="M314 223h64c-1 23-9 44-32 44s-31-21-32-44z" fill="#EEE5D5"/><ellipse cx="346" cy="223" rx="32" ry="8" fill="#D6C6AB"/><path d="M330 230v20M342 232v27M354 232v27M366 229v20" stroke="#C4B493"/>
    <path d="m340 95 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" stroke="#B37A50" strokeWidth="1.2"/><path d="M92 93h21m-10-10v21" stroke="#A77B54" strokeWidth="1.3"/><circle cx="137" cy="58" r="3" fill="#A77B54"/>
  </svg>;
}
