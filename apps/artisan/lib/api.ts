import { z, ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'VALIDATION_ERROR') {
    super(message);
  }
}

export type CatalogContext = { params: Promise<{ id: string }> };
export async function catalogId(context: CatalogContext) {
  return z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).parse((await context.params).id);
}

export async function jsonBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(400, 'Send an application/json request.');
  }
  // Bound JSON before parsing instead of trusting Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A JSON body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) {
        await reader.cancel();
        throw new ApiError(400, 'JSON body is too large.');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid JSON body.');
  } finally {
    reader.releaseLock();
  }
}

export async function api<T>(action: () => Promise<T>, status = 200): Promise<Response> {
  try {
    return Response.json(await action(), { status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ApiError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof ZodError) {
      return Response.json({ error: 'Invalid request fields. Check required values, types, and counts.', code: 'VALIDATION_ERROR' }, { status: 400 });
    }
    // Never log request bodies, upstream responses, credentials, or error stacks.
    console.error('[artisan api] Unexpected request failure', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
