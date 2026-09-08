import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './api';

const root = path.resolve(process.cwd(), 'public', 'uploads');
const audioTypes: Record<string, string> = {
  'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg',
};
export type Upload = { bytes: Buffer; extension: string; mime: string };

export async function uploadsFromRequest(request: Request, kind: 'images' | 'audio'): Promise<Upload[]> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    throw new ApiError(400, 'Send multipart/form-data.');
  }
  const maximum = 3 * (kind === 'images' ? 10 : 20) * 1024 * 1024 + 1024 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Upload exactly three files.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new ApiError(400, 'Upload exceeds the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
  } catch {
    throw new ApiError(400, 'Invalid multipart upload.');
  }
  const entries = Array.from(form.entries());
  const keys = kind === 'images' ? ['images', 'images', 'images'] : ['audio1', 'audio2', 'audio3'];
  if (entries.length !== 3 || entries.some(([key]) => !keys.includes(key)) ||
    (kind === 'audio' && keys.some(key => form.getAll(key).length !== 1))) {
    throw new ApiError(400, kind === 'images' ? 'Upload exactly three files using the images field.' : 'Upload one file each in audio1, audio2, and audio3.');
  }
  const files = kind === 'images' ? form.getAll('images') : keys.map(key => form.get(key));
  return Promise.all(files.map(async file => {
    if (!file || typeof file === 'string' || file.size === 0 || file.size > (kind === 'images' ? 10 : 20) * 1024 * 1024) {
      throw new ApiError(400, `Each ${kind === 'images' ? 'image must be nonempty and at most 10' : 'audio file must be nonempty and at most 20'} MB.`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = file.type.toLowerCase().split(';')[0].trim();
    if (kind === 'audio') {
      if (!Object.hasOwn(audioTypes, mime)) throw new ApiError(400, 'Supported audio: WebM, WAV, MP3, MP4, or Ogg.');
      return { bytes, extension: audioTypes[mime], mime };
    }
    const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR';
    const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!((mime === 'image/png' && png) || (mime === 'image/jpeg' && jpeg))) {
      throw new ApiError(400, 'Images must be genuine JPEG or PNG files with a matching MIME type.');
    }
    return { bytes, extension: png ? 'png' : 'jpg', mime };
  }));
}

export async function saveUploads(id: string, kind: 'raw' | 'processed' | 'audio', uploads: Upload[]) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ApiError(400, 'Invalid catalog ID.');
  const directory = path.join(root, id);
  await mkdir(directory, { recursive: true });
  return Promise.all(uploads.map(async upload => {
    const filename = `${kind}-${randomUUID()}.${upload.extension}`;
    await writeFile(path.join(directory, filename), upload.bytes, { flag: 'wx' });
    return `/uploads/${id}/${filename}`;
  }));
}

export async function readUpload(url: string, owner?: string, kind?: 'raw' | 'processed') {
  const match = /^\/uploads\/([a-zA-Z0-9_-]{1,100})\/((raw|processed|audio)-[0-9a-f-]{36}\.(jpg|png|webm|wav|mp3|m4a|ogg))$/.exec(url);
  if (!match || (owner && match[1] !== owner) || (kind && match[3] !== kind)) {
    throw new ApiError(400, 'Invalid or unowned upload path.');
  }
  try {
    const filename = await realpath(path.join(root, match[1], match[2]));
    const realRoot = await realpath(root);
    const relative = path.relative(realRoot, filename);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ApiError(400, 'Invalid upload path.');
    return { bytes: await readFile(filename), extension: match[4] };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(404, 'Upload not found.', 'NOT_FOUND');
  }
}
