#!/usr/bin/env python3
"""
Voice Transcription + Translation Black Box — BB2.

Pipeline:
  Audio (webm/wav/mp3/m4a/ogg) -> Whisper small (ASR, auto-detect) -> English Translation

Activated when scripts/transcribe_processor.py exists (and TRANSCRIBE_PROCESSOR != 'placeholder').
Falls back (caller-side) to deterministic placeholder if models missing or fail.

Models:
  - openai-whisper small (466 MB, 99 langs, ~2GB VRAM, CUDA via PyTorch or CPU)
  - Direct audio-to-English translation via Whisper translation task + optional IndicTrans2

Offline, no cloud APIs.

Usage:
  python scripts/transcribe_processor.py <audio1> <audio2> <audio3> [output_json]
  # prints JSON to stdout: {"transcripts": [...], "success": true}
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import logging
from pathlib import Path

# Configure UTF-8 encoding for Windows stdout/stderr
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure ffmpeg is in PATH for Whisper audio decoding
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    alias_name = "ffmpeg.exe" if sys.platform == "win32" else "ffmpeg"
    alias_path = os.path.join(ffmpeg_dir, alias_name)
    if not os.path.exists(alias_path) and os.path.exists(ffmpeg_exe):
        try:
            shutil.copyfile(ffmpeg_exe, alias_path)
        except Exception:
            pass
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception as e:
    pass

logger = logging.getLogger(__name__)

# ------------------------------------------------------------
# Language mapping: Whisper ISO 639-1 -> IndicTrans2 tag
# IndicTrans2 uses FLORES tags like hin_Deva, tam_Taml, etc.
# ------------------------------------------------------------
WHISPER_TO_INDIC = {
    "hi": "hin_Deva",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "bn": "ben_Beng",
    "gu": "guj_Gujr",
    "pa": "pan_Guru",
    "mr": "mar_Deva",
    "or": "ory_Orya",
    "as": "asm_Beng",
    "ur": "urd_Arab",
    "ne": "npi_Deva",
    "sd": "snd_Arab",
    "en": "eng_Latn",
}

SUPPORTED_INDIC = set(WHISPER_TO_INDIC.values())

# ------------------------------------------------------------
# Lazy singletons so 3 audios reuse loaded models in one invocation
# ------------------------------------------------------------
_whisper_model = None
_translator_model = None
_translator_tokenizer = None
_indic_attempted = False

def _get_whisper():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    try:
        import whisper  # type: ignore
        import torch  # type: ignore

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model_name = os.environ.get("WHISPER_MODEL", "small")
        logger.info(f"Loading Whisper {model_name} on {device}")
        _whisper_model = whisper.load_model(model_name, device=device)
        return _whisper_model
    except Exception as e:
        logger.warning(f"Whisper not available: {e}")
        return None

def _get_indic_translator():
    global _translator_model, _translator_tokenizer, _indic_attempted
    if _translator_model is not None and _translator_tokenizer is not None:
        return _translator_model, _translator_tokenizer
    if _indic_attempted:
        return None, None
    _indic_attempted = True

    # Only attempt if explicitly enabled or HF token is provided
    if not os.environ.get("INDICTRANS_ENABLED") and not os.environ.get("HF_TOKEN"):
        return None, None

    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
        import torch  # type: ignore

        model_id = os.environ.get("INDICTRANS_MODEL_ID", "ai4bharat/indictrans2-indic-en-dist-200M")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Loading IndicTrans2 {model_id} on {device}")
        _translator_tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        _translator_model = AutoModelForSeq2SeqLM.from_pretrained(model_id, trust_remote_code=True)
        if device == "cuda":
            _translator_model = _translator_model.to(device)  # type: ignore
        return _translator_model, _translator_tokenizer
    except Exception as e:
        logger.debug(f"IndicTrans2 not available: {e}")
        return None, None

def _translate_with_indic(text: str, src_whisper_lang: str) -> str | None:
    if not text or src_whisper_lang == "en":
        return text
    model, tokenizer = _get_indic_translator()
    if model is None or tokenizer is None:
        return None
    indic_tag = WHISPER_TO_INDIC.get(src_whisper_lang)
    if indic_tag is None or indic_tag not in SUPPORTED_INDIC:
        return None
    try:
        import torch  # type: ignore
        device = next(model.parameters()).device  # type: ignore
        try:
            inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)  # type: ignore
        except TypeError:
            inputs = tokenizer(text, return_tensors="pt", src_lang=indic_tag)  # type: ignore
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():  # type: ignore
            generated = model.generate(**inputs, max_length=256, num_beams=5, num_return_sequences=1)  # type: ignore
        out = tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()  # type: ignore
        return out if out else None
    except Exception as e:
        logger.warning(f"IndicTrans translation failed ({src_whisper_lang}): {e}")
        return None

INDIAN_ARTISAN_PROMPT = (
    "हस्तशिल्प और भारतीय कारीगरी: यह हस्तनिर्मित उत्पाद है। "
    "मिट्टी, टेराकोटा, चमड़ा, लकड़ी, धातु, पीतल, हथकरघा, कपड़ा, नक्काशी, पारंपरिक कला।"
)

def _transcribe_one(path: str, model) -> tuple[str, str, str]:
    """
    Returns (transcript, lang, englishTranslation).
    Uses Whisper ASR with auto-detected language for transcript in original script,
    and Whisper translation task (or IndicTrans2) for faithful English translation.
    """
    try:
        # 1. Transcribe into original script with Indian craft prompt hint and Hindi focus
        whisper_lang = os.environ.get("WHISPER_LANGUAGE", "hi")
        kwargs: dict = {
            "task": "transcribe",
            "initial_prompt": INDIAN_ARTISAN_PROMPT,
            "fp16": False,
            "verbose": False,
        }
        if whisper_lang:
            kwargs["language"] = whisper_lang

        res_tr = model.transcribe(path, **kwargs)
        transcript = (res_tr.get("text") or "").strip()
        lang = (res_tr.get("language") or whisper_lang or "hi").strip().lower()[:2]

        if not transcript:
            return "", lang or "hi", ""

        # 2. English translation:
        # If the audio is already in English, transcript is the translation
        if lang == "en":
            return transcript, "en", transcript

        # Try IndicTrans2 first if available
        eng_translation = _translate_with_indic(transcript, lang)

        # If IndicTrans2 not available, use Whisper's direct translation task with detected language
        if not eng_translation:
            try:
                res_en = model.transcribe(
                    path,
                    task="translate",
                    language=lang if lang in WHISPER_TO_INDIC else "hi",
                    initial_prompt="Indian handmade artisan craft and goods.",
                    fp16=False,
                    verbose=False,
                )
                eng_translation = (res_en.get("text") or "").strip()
            except Exception as e:
                logger.warning(f"Whisper translate task failed: {e}")
                eng_translation = transcript

        return transcript, lang, eng_translation
    except Exception as e:
        logger.error(f"Transcribe failed for {path}: {e}")
        return "", "hi", ""

def process_batch(input_paths: list[str]) -> dict:
    model = _get_whisper()
    if model is None:
        return {"success": False, "error": "Whisper model not available (install openai-whisper + torch)"}

    transcripts = []
    for idx, p in enumerate(input_paths):
        q_num = idx + 1
        path = str(p)
        if not Path(path).exists():
            return {"success": False, "error": f"Audio not found: {path}"}
        text, lang, eng = _transcribe_one(path, model)

        # Normalize lang
        if not lang or len(lang) != 2:
            lang = "hi"
        transcripts.append({
            "questionNumber": q_num,
            "sourceLanguage": lang,
            "transcript": text,
            "englishTranslation": eng or text,
        })

    return {"transcripts": transcripts, "success": True}

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[transcribe] %(message)s")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    output_path = None
    input_paths = args
    if len(args) >= 4 and args[-1].endswith(".json"):
        input_paths = args[:-1]
        output_path = args[-1]
    if "--output" in sys.argv:
        try:
            oi = sys.argv.index("--output")
            output_path = sys.argv[oi + 1]
            input_paths = [a for a in args if a != output_path]
        except Exception:
            pass

    if not input_paths:
        print(json.dumps({"success": False, "error": "Usage: transcribe_processor.py <audio1> <audio2> <audio3> [output.json]"}), file=sys.stdout)
        sys.exit(2)

    result = process_batch(input_paths)
    out_json = json.dumps(result, ensure_ascii=False)
    if output_path:
        Path(output_path).write_text(out_json, encoding="utf-8")
    print(out_json)
    sys.exit(0 if result.get("success") else 1)
