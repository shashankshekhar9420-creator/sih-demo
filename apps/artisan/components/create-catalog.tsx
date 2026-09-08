'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { catalogResponseSchema, jsonRequest, request } from './client-api';
import { ContinueLabel, ErrorNotice } from './ui';

export function CreateCatalogButton({ label = 'Create a catalog' }: { label?: string }) {
  const router = useRouter();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const { catalog } = await request('/api/catalogs', catalogResponseSchema, jsonRequest('POST', {}));
      router.push(`/catalogs/${catalog.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create your catalog.');
      pending.current = false; setBusy(false);
    }
  }
  return <div className="create-action"><button className="button primary" disabled={busy} onClick={create}>{!busy && <Plus size={19} />}<ContinueLabel busy={busy}>{busy ? 'Creating your draft...' : label}</ContinueLabel></button>{error && <ErrorNotice>{error}</ErrorNotice>}</div>;
}
