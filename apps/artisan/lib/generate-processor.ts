import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Catalog Generation Black Box — BB3
// Route: POST /api/catalogs/{id}/generate
// Contract: 3 English translations + category →
//           { title, hindiTitle, description, hindiDescription,
//             bullets, hindiBullets, specifics, keywords }
// ---------------------------------------------------------------------------
//
// 1) Python AI engine: Ollama (local LLM, default mistral:7b-instruct-q4_K_M)
//    Runs offline via Ollama REST API on localhost:11434.
//    Activated when GENERATE_PROCESSOR=python (or not set to 'placeholder')
//    and scripts/generate_processor.py is present.
//
// 2) Node placeholder fallback (deterministic, no fabrication):
//    Returns the current template-based output when Python is disabled or fails.
//    Preserves the route contract so the wizard always completes.
//
// Both paths produce the same response shape and go through generatedSchema.parse()
// in workflow.ts — the Zod gate prevents malformed AI output from reaching the DB.
// ---------------------------------------------------------------------------

export type GenerateInput = {
  englishTranslations: [string, string, string];
  category: string;
};

export type GenerateResult = {
  title: string;
  hindiTitle: string;
  description: string;
  hindiDescription: string;
  bullets: string[];
  hindiBullets: string[];
  specifics: Record<string, string>;
  keywords: string[];
};

// ---------------------------------------------------------------------------
// Placeholder fallback — deterministic, same as the original stub
// ---------------------------------------------------------------------------

const TOPICS = ['product name and material', 'craft and appearance', 'use and story'] as const;

const HINDI_PLACEHOLDER_BULLETS = [
  'यह उत्पाद हस्तनिर्मित है।',
  'परंपरागत तकनीक से बनाया गया।',
  'उच्च गुणवत्ता की सामग्री का उपयोग।',
  'रोज़मर्रा और खास अवसरों के लिए उपयुक्त।',
  'कारीगर की मेहनत और कला का प्रतीक।',
];

export function placeholderGenerate(input: GenerateInput): GenerateResult {
  return {
    title: `Demo ${input.category} catalog`,
    hindiTitle: `डेमो कैटलॉग: ${input.category}`,
    description: `Demo catalog in ${input.category}. ${input.englishTranslations.join(' ')}`,
    hindiDescription: `डेमो कैटलॉग। ${TOPICS.map((t, i) => `प्रश्न ${i + 1}: ${t}`).join('। ')}।`,
    bullets: input.englishTranslations.map(
      (t, i) => `Demo placeholder for question ${i + 1}: ${TOPICS[i]}. ${t.slice(0, 120)}`,
    ),
    hindiBullets: HINDI_PLACEHOLDER_BULLETS,
    specifics: {
      'Demo notice': 'Placeholder content only. Add verified material, size, color, and weight before publishing.',
    },
    keywords: [input.category, 'demo catalog', 'handmade', 'artisan'],
  };
}

// ---------------------------------------------------------------------------
// Python processor bridge
// ---------------------------------------------------------------------------

function findScript(): string | null {
  const candidates = [
    path.join(process.cwd(), 'scripts', 'generate_processor.py'),
    path.resolve(process.cwd(), '../../scripts', 'generate_processor.py'),
    path.resolve(process.cwd(), '..', '..', 'scripts', 'generate_processor.py'),
    path.resolve(__dirname, '../../../../scripts', 'generate_processor.py'),
  ];
  return candidates.find(c => existsSync(c)) ?? null;
}

async function tryPythonProcessor(input: GenerateInput): Promise<GenerateResult | null> {
  if (process.env.GENERATE_PROCESSOR === 'placeholder') return null;

  const script = findScript();
  if (!script) {
    console.warn('[generate-processor] generate_processor.py not found in candidate paths');
    return null;
  }

  const python = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const dir = await mkdtemp(path.join(tmpdir(), 'sahaj-gen-'));
  const inPath = path.join(dir, 'input.json');
  const outPath = path.join(dir, 'output.json');

  try {
    const inputPayload = {
      englishTranslations: input.englishTranslations,
      category: input.category,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
      model: process.env.GENERATE_MODEL ?? 'mistral:7b-instruct-q4_K_M',
    };
    await writeFile(inPath, JSON.stringify(inputPayload, null, 2), 'utf-8');

    const timeout = process.env.GENERATE_TIMEOUT_MS ? Number(process.env.GENERATE_TIMEOUT_MS) : 300_000;
    const ok = await new Promise<boolean>(resolve => {
      const child = spawn(python, [script, inPath, outPath], {
        timeout,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
          GENERATE_MODEL: process.env.GENERATE_MODEL ?? 'mistral:7b-instruct-q4_K_M',
          OLLAMA_NUM_GPU: process.env.OLLAMA_NUM_GPU ?? '99',
          OLLAMA_MAIN_GPU: process.env.OLLAMA_MAIN_GPU ?? '0',
          OLLAMA_KEEP_ALIVE: process.env.OLLAMA_KEEP_ALIVE ?? '15m',
        },
      });

      let stderr = '';
      let stdout = '';
      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

      child.on('error', err => {
        console.error('[generate-processor] python spawn error', err);
        resolve(false);
      });
      child.on('close', code => {
        if (code !== 0) {
          console.error('[generate-processor] python script failed', stderr.slice(0, 1200), stdout.slice(0, 400));
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    if (!ok) return null;

    let raw: unknown = null;
    try {
      const txt = await readFile(outPath, 'utf-8');
      raw = JSON.parse(txt);
    } catch {
      return null;
    }

    const obj = raw as Record<string, unknown>;
    if (!obj.success) {
      console.error('[generate-processor] python script reported failure', (obj.error as string | undefined)?.slice(0, 400));
      return null;
    }

    const result = obj.result as Record<string, unknown> | undefined;
    if (!result || typeof result !== 'object') {
      console.error('[generate-processor] python output missing result object');
      return null;
    }

    // Validate required fields exist before returning
    const required = ['title', 'hindiTitle', 'description', 'hindiDescription', 'bullets', 'hindiBullets', 'keywords', 'specifics'];
    for (const key of required) {
      if (!(key in result)) {
        console.error(`[generate-processor] python output missing required field: ${key}`);
        return null;
      }
    }

    return result as GenerateResult;
  } catch (e) {
    console.error('[generate-processor] wrapper error', e);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Public entry point called from workflow.ts
// ---------------------------------------------------------------------------

export async function generateWithModel(input: GenerateInput): Promise<GenerateResult> {
  // 1) Try real model (Ollama + LLM via Python)
  const real = await tryPythonProcessor(input);
  if (real) {
    console.info('[generate-processor] using AI-generated catalog (Ollama)');
    return real;
  }

  // 2) Fallback: deterministic placeholder (preserves route contract)
  console.warn('[generate-processor] using placeholder fallback');
  return placeholderGenerate(input);
}
