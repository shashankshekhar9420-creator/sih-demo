import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

// ---------------------------------------------------------------------------
// Image Processing Black Box — BB1
// Route: POST /api/catalogs/{id}/process-images
// Spec: remove background → white, studio lighting, subtle contact shadow,
//       preserve shape/color/texture/orientation, one output per input.
// ---------------------------------------------------------------------------
//
// 1. Primary engine: @imgly/background-removal-node via isolated worker
//    (scripts/process_image.cjs) — pure Node, runs locally with bundled ONNX
//    models. Isolates native bindings from Next.js process, segments background,
//    replaces with pure white (#FFFFFF), and adds studio lighting + contact shadow.
//
// 2. GPU engine (optional): Python + REMBG (U2-Net ONNX + CUDA) when enabled.
//    Set IMAGE_PROCESSOR=python and ensure scripts/image_processor.py + rembg
//    are installed.
//
// 3. Fallback engine: sharp (libvips) — ensures route never fails on any corrupted
//    input.
// ---------------------------------------------------------------------------

type ProcessInput = { bytes: Buffer; extension: string };

function shadowSvg(width: number, height: number): Buffer {
  const cx = Math.round(width / 2);
  const cy = Math.round(height * 0.945);
  const rx = Math.round(width * 0.33);
  const ry = Math.round(Math.max(6, height * 0.038));
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${Math.max(6, Math.round(width * 0.012))}"/></filter></defs>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(0,0,0,0.14)" filter="url(#b)"/>
  </svg>`;
  return Buffer.from(svg);
}

async function tryNodeBackgroundRemoval(inputBytes: Buffer, width: number, height: number): Promise<Buffer | null> {
  const localScript = path.join(process.cwd(), 'scripts', 'process_image.cjs');
  const rootScript = path.resolve(process.cwd(), '../../scripts', 'process_image.cjs');
  const script = existsSync(localScript) ? localScript : existsSync(rootScript) ? rootScript : null;
  if (!script) return null;

  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(path.join(tmpdir(), 'sahaj-imgly-'));
  const inPath = path.join(dir, 'in.jpg');
  const outPath = path.join(dir, 'out.jpg');

  try {
    await writeFile(inPath, inputBytes);
    const ok = await new Promise<boolean>(resolve => {
      const child = spawn(process.execPath, [script, inPath, outPath], { timeout: 35000 });
      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        console.error('[image-processor] worker spawn error:', err);
        resolve(false);
      });
      child.on('close', code => {
        if (code !== 0) {
          console.error('[image-processor] worker failed:', stderr.slice(0, 800));
          resolve(false);
        } else resolve(true);
      });
    });

    if (!ok) return null;
    const out = await readFile(outPath);
    const meta = await sharp(out).metadata();
    if (width > 0 && height > 0 && (meta.width !== width || meta.height !== height)) {
      return await sharp(out).resize(width, height, { fit: 'fill' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    }
    return out;
  } catch (err) {
    console.error('[image-processor] worker error:', err);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function tryPythonProcessor(inputBytes: Buffer, width: number, height: number): Promise<Buffer | null> {
  if (process.env.IMAGE_PROCESSOR !== 'python') return null;
  const localScript = path.join(process.cwd(), 'scripts', 'image_processor.py');
  const rootScript = path.resolve(process.cwd(), '../../scripts', 'image_processor.py');
  const script = existsSync(localScript) ? localScript : existsSync(rootScript) ? rootScript : null;
  if (!script) return null;
  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

  const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(path.join(tmpdir(), 'sahaj-img-'));
  const inPath = path.join(dir, 'in.jpg');
  const outPath = path.join(dir, 'out.jpg');
  try {
    await writeFile(inPath, inputBytes);
    const ok = await new Promise<boolean>(resolve => {
      const child = spawn(python, [script, inPath, outPath], { timeout: 20000 });
      let stderr = '';
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', () => resolve(false));
      child.on('close', code => {
        if (code !== 0) {
          console.error('[image-processor] python failed', stderr.slice(0, 800));
          resolve(false);
        } else resolve(true);
      });
    });
    if (!ok) return null;
    const out = await readFile(outPath);
    // Honour dimensions — python must not resize
    const meta = await sharp(out).metadata();
    if (meta.width !== width || meta.height !== height) {
      return await sharp(out).resize(width, height, { fit: 'fill' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    }
    return out;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function enhanceImage(input: ProcessInput): Promise<Buffer> {
  const meta = await sharp(input.bytes).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  // 1) GPU path — REMBG via Python, if enabled and available
  const py = await tryPythonProcessor(input.bytes, width, height);
  if (py) return py;

  // 2) AI background removal via isolated Node worker (@imgly/background-removal-node)
  const ai = await tryNodeBackgroundRemoval(input.bytes, width, height);
  if (ai) return ai;

  // 3) CPU fallback path — sharp only (if AI model fails)
  const base = sharp(input.bytes, { failOn: 'none' }).rotate();
  const lit = await base
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .modulate({ brightness: 1.07, saturation: 1.03 })
    .linear(1.06, 6)
    .normalize({ lower: 1, upper: 99 })
    .sharpen({ sigma: 0.45, m1: 0.8, m2: 1.6 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  if (width > 0 && height > 0) {
    return await sharp(lit)
      .composite([{ input: shadowSvg(width, height), blend: 'over' }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }
  return lit;
}
