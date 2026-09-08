import 'server-only';
import { z } from 'zod';
import { ApiError } from './api';

export function integrationUrl(app: 'artisan' | 'commerce') {
  return z.string().url().refine(value => ['http:', 'https:'].includes(new URL(value).protocol)).parse(
    app === 'artisan' ? process.env.ARTISAN_APP_URL || 'http://localhost:4000' : process.env.COMMERCE_APP_URL || 'http://localhost:3000',
  );
}

export async function commerceRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  try {
    const response = await fetch(new URL(endpoint, integrationUrl('commerce')), {
      ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'x-demo-api-key': process.env.DEMO_API_KEY || 'local-demo-key' },
    });
    if (!response.ok) throw new Error('Upstream request rejected');
    return await response.json();
  } catch {
    console.error('[artisan commerce] Marketplace request failed');
    throw new ApiError(502, 'Marketplace is unavailable. Please try again.', 'COMMERCE_UNAVAILABLE');
  }
}
