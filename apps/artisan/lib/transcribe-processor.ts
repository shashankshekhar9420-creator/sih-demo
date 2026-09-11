import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Voice Transcription + Translation Black Box — BB2
// Route: POST /api/catalogs/{id}/transcribe
// Contract: 3 audios (audio1/2/3) -> 3× {questionNumber, sourceLanguage, transcript, englishTranslation}
// ---------------------------------------------------------------------------
//
// 1) Python AI engine: Whisper small (ASR, auto-detect, 99 langs) +
//    English translation via Whisper translation task / IndicTrans2.
//    Runs offline via local PyTorch.
//
// 2) Local Node placeholder fallback (deterministic, no fabrication):
//    topics derived from question index; used only if python is disabled or fails.
//
// Both paths preserve the route contract (same request validation, same
// response shape, same DB writes, same error envelope).
// ---------------------------------------------------------------------------

export type TranscriptRow = {
  questionNumber: number;
  sourceLanguage: string;
  transcript: string;
  englishTranslation: string;
};

const TOPICS = ['product name and material', 'craft and appearance', 'use and story'] as const;

export function placeholderRows(): TranscriptRow[] {
  return TOPICS.map((topic, index) => ({
    questionNumber: index + 1,
    sourceLanguage: 'hi',
    transcript: `\u0921\u0947\u092e\u094b \u092a\u094d\u0932\u0947\u0938\u0939\u094b\u0932\u094d\u0921\u0930: \u092a\u094d\u0930\u0936\u094d\u0928 ${index + 1}\u0964 \u092f\u0939 \u0906\u092a\u0915\u0940 \u0930\u093f\u0915\u0949\u0930\u094d\u0921\u093f\u0902\u0917 \u0915\u093e \u0935\u093e\u0938\u094d\u0924\u0935\u093f\u0915 \u0932\u093f\u092a\u094d\u092f\u0902\u0924\u0930\u0923 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964`,
    englishTranslation: `Demo placeholder for question ${index + 1}: ${topic}. This is not a transcription of your recording. Replace with verified product facts.`,
  }));
}

function normalizeRow(raw: unknown, q: number): TranscriptRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const qn = typeof r.questionNumber === 'number' ? r.questionNumber : q;
  const lang = typeof r.sourceLanguage === 'string' && r.sourceLanguage.trim() ? r.sourceLanguage.trim().slice(0, 5).toLowerCase() : 'hi';
  const transcript = typeof r.transcript === 'string' ? r.transcript.trim() : '';
  const englishTranslation = typeof r.englishTranslation === 'string' ? r.englishTranslation.trim() : '';
  return {
    questionNumber: qn,
    sourceLanguage: lang || 'hi',
    transcript: transcript || placeholderRows()[q - 1]!.transcript,
    englishTranslation: englishTranslation || transcript || placeholderRows()[q - 1]!.englishTranslation,
  };
}

async function tryPythonProcessor(audioBuffers: Buffer[], extensions: string[]): Promise<TranscriptRow[] | null> {
  if (process.env.TRANSCRIBE_PROCESSOR === 'placeholder') return null;

  const candidates = [
    path.join(process.cwd(), 'scripts', 'transcribe_processor.py'),
    path.resolve(process.cwd(), '../../scripts', 'transcribe_processor.py'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'transcribe_processor.py'),
    path.resolve(__dirname, '../../../../scripts', 'transcribe_processor.py'),
  ];
  const script = candidates.find(candidate => existsSync(candidate)) ?? null;
  if (!script) {
    console.warn('[transcribe] transcribe_processor.py not found in candidate paths');
    return null;
  }

  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const dir = await mkdtemp(path.join(tmpdir(), 'sahaj-tr-'));
  const inPaths: string[] = [];
  const outJson = path.join(dir, 'out.json');

  try {
    for (let i = 0; i < audioBuffers.length; i++) {
      const p = path.join(dir, `in${i + 1}.${extensions[i] || 'webm'}`);
      await writeFile(p, audioBuffers[i]);
      inPaths.push(p);
    }

    const timeout = process.env.TRANSCRIBE_TIMEOUT_MS ? Number(process.env.TRANSCRIBE_TIMEOUT_MS) : 300_000;
    const ok = await new Promise<boolean>(resolve => {
      const child = spawn(python, [script, ...inPaths, outJson], {
        timeout,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          WHISPER_MODEL: process.env.WHISPER_MODEL ?? 'small',
        },
      });
      let stderr = '';
      let stdout = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        console.error('[transcribe] python spawn error', err);
        resolve(false);
      });
      child.on('close', code => {
        if (code !== 0) {
          console.error('[transcribe] python failed', stderr.slice(0, 1200), stdout.slice(0, 600));
          resolve(false);
        } else resolve(true);
      });
    });

    if (!ok) return null;

    let raw: unknown = null;
    try {
      const txt = await readFile(outJson, 'utf8');
      raw = JSON.parse(txt);
    } catch {
      return null;
    }

    const obj = raw as Record<string, unknown>;
    const arr = Array.isArray(obj.transcripts) ? (obj.transcripts as unknown[]) : null;
    if (!arr || arr.length !== 3) {
      console.error('[transcribe] unexpected output shape', JSON.stringify(raw).slice(0, 800));
      return null;
    }

    const rows: TranscriptRow[] = [];
    for (let i = 0; i < 3; i++) {
      const n = normalizeRow(arr[i], i + 1);
      if (!n) return null;
      rows.push(n);
    }
    return rows;
  } catch (e) {
    console.error('[transcribe] wrapper error', e);
    return null;
  } finally {
    for (const p of inPaths) await unlink(p).catch(() => {});
    await unlink(outJson).catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function transcribeWithModels(
  audioBuffers: Buffer[],
  extensions: string[],
): Promise<TranscriptRow[]> {
  if (audioBuffers.length !== 3) {
    throw new Error('Expected 3 audio buffers');
  }

  // 1) Try real models (Whisper small ASR + Translation via Python)
  const real = await tryPythonProcessor(audioBuffers, extensions);
  if (real) return real;

  // 2) Fallback: deterministic placeholder (no fabrication, preserves contract)
  console.warn('[transcribe] using placeholder fallback');
  return placeholderRows();
}
