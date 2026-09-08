import { z } from 'zod';
import { api } from '../../../lib/api';
import { readUpload } from '../../../lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contentTypes: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webm: 'audio/webm', wav: 'audio/wav',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg',
};

// Next's public-file manifest does not include uploads created after next build.
export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  let response: Response | undefined;
  const error = await api(async () => {
    const segments = z.array(z.string().regex(/^[a-zA-Z0-9_.-]+$/)).length(2).parse((await context.params).path);
    const file = await readUpload(`/uploads/${segments.join('/')}`);
    response = new Response(new Uint8Array(file.bytes), { headers: {
      'Content-Type': contentTypes[file.extension], 'Content-Length': String(file.bytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    } });
    return {};
  });
  return response ?? error;
}
