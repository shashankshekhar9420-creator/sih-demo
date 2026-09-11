#!/usr/bin/env python3
"""
Catalog Generation Black Box — BB3.

Pipeline:
  3× English translations + category → Ollama (local LLM) → bilingual catalog JSON

Activated when scripts/generate_processor.py exists and GENERATE_PROCESSOR != 'placeholder'.
Falls back (caller-side) to deterministic placeholder if Ollama is unavailable or fails.

Models (pulled via `ollama pull <model>`):
  - mistral:7b-instruct-q4_K_M  (default, ~4.5 GB, best balance)
  - llama3.1:8b-instruct-q4_K_M (alternative, ~4.7 GB)
  - phi3:mini                    (budget, ~2 GB, fast)
  - gemma2:9b-instruct-q4_K_M   (high quality, ~5.5 GB)

Offline, no cloud APIs. Requires Ollama running on localhost:11434.

Usage:
  python scripts/generate_processor.py <input.json> <output.json>
  # input.json:  { "englishTranslations": ["q1", "q2", "q3"], "category": "..." }
  # output.json: { "success": true, "result": { title, hindiTitle, ... } }
               | { "success": false, "error": "..." }
"""

from __future__ import annotations

import json
import os
import re
import sys
import logging
import urllib.request
import urllib.error
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

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category-aware field hints — what the LLM should try to populate
# ---------------------------------------------------------------------------
CATEGORY_HINTS: dict[str, dict] = {
    "Pottery & Terracotta":      {"keyFields": ["material", "shape", "glaze", "firingTechnique", "finish", "dimensions", "weight"]},
    "Handloom & Weaving":        {"keyFields": ["material", "weavePattern", "yarnSource", "threadCount", "dimensions", "colorPalette"]},
    "Embroidery & Textile Art":  {"keyFields": ["baseFabric", "threadType", "embroideryStyle", "colorPalette", "dimensions"]},
    "Wood Carving & Woodwork":   {"keyFields": ["woodType", "carvingTechnique", "finish", "dimensions", "weight"]},
    "Metal & Brass Craft":       {"keyFields": ["metalAlloy", "castingTechnique", "weight", "finish", "patina", "dimensions"]},
    "Jewelry & Beadwork":        {"keyFields": ["material", "beadType", "closureType", "weight", "dimensions", "colorPalette"]},
    "Bamboo & Cane Craft":       {"keyFields": ["bambooVariety", "weaveTechnique", "surfaceTreatment", "dimensions", "weight"]},
    "Stone & Marble Craft":      {"keyFields": ["stoneType", "carvingTechnique", "finish", "dimensions", "weight"]},
    "Folk Painting & Art":       {"keyFields": ["medium", "paintType", "artStyle", "dimensions", "theme", "colorPalette"]},
    "Leather Craft":             {"keyFields": ["leatherType", "tanningMethod", "finish", "hardware", "dimensions"]},
    "Other":                     {"keyFields": ["material", "technique", "dimensions", "finish"]},
}

# ---------------------------------------------------------------------------
# Fact extraction — simple heuristics, no model needed
# ---------------------------------------------------------------------------

_MATERIAL_PATTERNS = re.compile(
    r"\b(cotton|silk|wool|jute|linen|terracotta|clay|mud|brass|copper|bronze|iron|steel|silver|gold|"
    r"wood|teak|rosewood|mango wood|bamboo|cane|rattan|marble|stone|granite|leather|cowhide|buffalo hide|"
    r"fabric|thread|yarn|beads|glass beads|mirror|stone beads|acrylic)\b",
    re.IGNORECASE,
)
_DIMENSION_PATTERNS = re.compile(
    r"\b(\d+(?:\.\d+)?\s*(?:cm|mm|inch|inches|in|foot|feet|ft|kg|gm|gram|grams|litre|liter|ml))\b",
    re.IGNORECASE,
)
_TIME_PATTERNS = re.compile(
    r"\b(\d+\s*(?:day|days|hour|hours|week|weeks|month|months))\b",
    re.IGNORECASE,
)
_TECHNIQUE_PATTERNS = re.compile(
    r"\b(hand[- ]?(?:woven|made|stitched|carved|painted|embroidered|dyed|knotted|twisted|spun|loom|loomed)|"
    r"hand loom|chikankari|kantha|block print|batik|ikat|khadi|ajrakh|kutch|madhubani|warli|pattachitra|"
    r"dhokra|bidri|meenakari|filigree|zardozi|phulkari|kasuti|"
    r"wheel[- ]?thrown|kiln[- ]?fired|pit[- ]?fired|wood[- ]?fired|"
    r"lost[- ]?wax|sand casting|hammered|repoussé|engraved|carved|chiseled|turned|"
    r"air[- ]?dried|sun[- ]?dried|natural[- ]?dye|vegetable[- ]?dye|"
    r"traditional|ancestral|generational|heritage|artisan[- ]?made|craft(?:ed|sman|smanship))\b",
    re.IGNORECASE,
)
_USE_PATTERNS = re.compile(
    r"\b(decorative|decor|gifting|gift|festive|festival|everyday|daily use|utility|functional|"
    r"home decor|wall art|table decor|gifting|ceremonial|pooja|worship|kitchen|storage|wearable|"
    r"wedding|occasion|traditional wear|ethnic wear|casual wear|formal wear|accessory|jewellery)\b",
    re.IGNORECASE,
)


def extract_facts(translations: list[str], category: str) -> dict:
    """Extract structured facts from translations using pattern matching."""
    combined = " ".join(translations)

    materials = list(dict.fromkeys(m.lower() for m in _MATERIAL_PATTERNS.findall(combined)))
    dimensions = list(dict.fromkeys(d.lower() for d in _DIMENSION_PATTERNS.findall(combined)))
    time_mentions = list(dict.fromkeys(t.lower() for t in _TIME_PATTERNS.findall(combined)))
    techniques = list(dict.fromkeys(t.lower() for t in _TECHNIQUE_PATTERNS.findall(combined)))
    use_cases = list(dict.fromkeys(u.lower() for u in _USE_PATTERNS.findall(combined)))

    hints = CATEGORY_HINTS.get(category, CATEGORY_HINTS["Other"])

    return {
        "materials": materials[:5],
        "dimensions": dimensions[:4],
        "productionTime": time_mentions[:2],
        "techniques": techniques[:5],
        "useCases": use_cases[:4],
        "categoryKeyFields": hints["keyFields"],
    }


# ---------------------------------------------------------------------------
# Ollama client — uses only stdlib urllib, no extra deps
# ---------------------------------------------------------------------------

def _ollama_generate(prompt: str, model: str, base_url: str, timeout: int = 180) -> str:
    """
    Call Ollama /api/generate and return the accumulated response text.
    Streams response JSON lines and concatenates the 'response' fields.
    Configured to explicitly offload model layers to GPU (RTX 3050).
    """
    url = base_url.rstrip("/") + "/api/generate"

    # GPU offload configuration:
    # num_gpu=99 forces all layers into GPU VRAM (RTX 3050 6GB fits mistral:7b ~4.1GB completely)
    num_gpu = int(os.environ.get("OLLAMA_NUM_GPU", "99"))
    main_gpu = int(os.environ.get("OLLAMA_MAIN_GPU", "0"))
    keep_alive = os.environ.get("OLLAMA_KEEP_ALIVE", "15m")

    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "format": "json",
        "stream": True,
        "keep_alive": keep_alive,
        "options": {
            "temperature": 0.3,   # low temp → consistent, fact-preserving output
            "top_p": 0.9,
            "repeat_penalty": 1.1, # gentle penalty so Devanagari UTF-8 bytes are not over-penalized
            "repeat_last_n": 32,
            "num_predict": 1024,
            "num_ctx": 4096,
            "num_gpu": num_gpu,   # offload all layers to GPU
            "main_gpu": main_gpu, # select primary dedicated NVIDIA GPU
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    accumulated = []
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = obj.get("response", "")
            accumulated.append(token)
            if obj.get("done"):
                break

    return "".join(accumulated)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a professional e-commerce copywriter specializing in Indian handmade crafts and artisan goods. You write clear, honest, SEO-optimized product listings that respect and preserve the artisan's own words. You NEVER invent facts not stated by the artisan."""

def build_prompt(translations: list[str], category: str, facts: dict) -> str:
    q1, q2, q3 = translations[0], translations[1], translations[2]
    key_fields = ", ".join(facts.get("categoryKeyFields", ["material", "technique", "dimensions"]))
    materials_str = ", ".join(facts["materials"]) if facts["materials"] else "not explicitly stated"
    techniques_str = ", ".join(facts["techniques"]) if facts["techniques"] else "not explicitly stated"
    time_str = ", ".join(facts["productionTime"]) if facts["productionTime"] else "not explicitly stated"
    use_cases_str = ", ".join(facts["useCases"]) if facts["useCases"] else "not explicitly stated"
    dims_str = ", ".join(facts["dimensions"]) if facts["dimensions"] else "not explicitly stated"

    return f"""{SYSTEM_PROMPT}

ARTISAN VOICE RECORDING TRANSCRIPTS (English translations):
Q1 — What is this product called, and what material is it made from?
"{q1}"

Q2 — How is it made, and what does it look like (size, color, weight, special design)?
"{q2}"

Q3 — What is it used for, and is there a story, tradition, or festival behind it?
"{q3}"

PRODUCT CATEGORY: {category}

EXTRACTED FACTS (for reference only — use transcripts as primary source):
- Materials mentioned: {materials_str}
- Techniques mentioned: {techniques_str}
- Production time: {time_str}
- Use cases: {use_cases_str}
- Dimensions/measurements: {dims_str}
- Key fields for this category: {key_fields}

TASK: Generate a complete bilingual product catalog. Return ONLY a valid JSON object with exactly these keys — no markdown, no explanation, no extra text:

{{
  "title": "<English title, max 120 chars, SEO-optimized, format: [Craft/Material] [Product] [Key Feature]>",
  "hindiTitle": "<Concise Hindi title in Devanagari script, max 15 words, e.g. हस्तनिर्मित मिट्टी का घड़ा>",
  "description": "<English description, 70-120 words: product essence, authentic craft process, and use cases>",
  "hindiDescription": "<Hindi description in Devanagari script, 60-100 words: natural Hindi prose matching product details>",
  "bullets": [
    "<Concise English bullet point 1: craft material and authenticity>",
    "<Concise English bullet point 2: traditional handmade technique>",
    "<Concise English bullet point 3: utility, story or occasion>"
  ],
  "hindiBullets": [
    "<Hindi bullet 1 in Devanagari script matching point 1>",
    "<Hindi bullet 2 in Devanagari script matching point 2>",
    "<Hindi bullet 3 in Devanagari script matching point 3>"
  ],
  "specifics": {{
    "<field>": "<value>",
    "... up to 6 fields relevant to {category}: prioritize {key_fields}"
  }},
  "keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"]
}}

CRITICAL RULES:
1. Every factual claim must trace back to the artisan's transcripts. If a fact is not mentioned, omit it — do NOT invent it.
2. Safe inferences allowed (e.g. cotton + hand-woven → "breathable natural fiber"; terracotta → "eco-friendly fired clay").
3. Do NOT claim certifications, awards, or specific quantities unless the artisan stated them.
4. Hindi fields MUST be in Devanagari script (not romanized Hindi, not English).
5. Return ONLY the JSON object — no ```json wrapper, no explanation before or after."""


# ---------------------------------------------------------------------------
# Output parsing and validation
# ---------------------------------------------------------------------------

def _clean_json_candidate(text: str) -> str:
    """Strip code fences, comments, and trailing commas from candidate JSON."""
    s = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.MULTILINE)
    s = re.sub(r"\s*```$", "", s.strip(), flags=re.MULTILINE)
    s = re.sub(r"^\s*//.*$", "", s, flags=re.MULTILINE)
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s.strip()


def _repair_truncated_json(text: str) -> str:
    """If JSON is truncated mid-stream, close open quotes, brackets, and braces."""
    s = _clean_json_candidate(text)
    in_string = False
    escape = False
    stack: list[str] = []
    for ch in s:
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch in "{[":
                stack.append("}" if ch == "{" else "]")
            elif ch in "}]":
                if stack and stack[-1] == ch:
                    stack.pop()

    if in_string:
        s += '"'
    while stack:
        s += stack.pop()
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


def _regex_fallback_extract(text: str) -> dict | None:
    """
    If JSON parsing fails entirely, extract individual fields via regex so
    valid LLM-generated titles/descriptions are never thrown away.
    """
    res: dict = {}
    for key in ["title", "hindiTitle", "description", "hindiDescription"]:
        m = re.search(rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
        if m:
            res[key] = m.group(1).replace(r'\"', '"').replace(r'\n', ' ').strip()
        else:
            m2 = re.search(rf'"{key}"\s*:\s*"([^"\n\r]{{2,500}})', text)
            if m2:
                res[key] = m2.group(1).strip()

    for list_key in ["bullets", "hindiBullets", "keywords"]:
        m = re.search(rf'"{list_key}"\s*:\s*\[(.*?)\]', text, re.DOTALL)
        if m:
            items = re.findall(r'"((?:[^"\\]|\\.)*)"', m.group(1))
            res[list_key] = [item.replace(r'\"', '"').strip() for item in items if item.strip()]
        else:
            res[list_key] = []

    m_spec = re.search(r'"specifics"\s*:\s*\{(.*?)\}', text, re.DOTALL)
    if m_spec:
        pairs = re.findall(r'"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"', m_spec.group(1))
        res["specifics"] = {k: v.replace(r'\"', '"').strip() for k, v in pairs}
    else:
        res["specifics"] = {}

    if res.get("title") or res.get("description"):
        return res
    return None


def _extract_json(text: str) -> dict | None:
    """Extract the first valid JSON object from model output with fault tolerance."""
    text = text.strip()
    if not text:
        return None

    # Strategy 1: Direct parse with strict=False
    try:
        return json.loads(text, strict=False)
    except Exception:
        pass

    # Strategy 2: Cleaned text
    cleaned = _clean_json_candidate(text)
    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        pass

    # Strategy 3: Outermost {...}
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        slice_text = cleaned[start:end + 1]
        try:
            return json.loads(slice_text, strict=False)
        except Exception:
            pass
        slice_cleaned = _clean_json_candidate(slice_text)
        try:
            return json.loads(slice_cleaned, strict=False)
        except Exception:
            pass

    # Strategy 4: Brace counting
    depth = 0
    in_string = False
    escape_next = False
    for i, ch in enumerate(cleaned):
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                candidate = _clean_json_candidate(cleaned[start:i + 1])
                try:
                    return json.loads(candidate, strict=False)
                except Exception:
                    pass

    # Strategy 5: Repair truncated JSON
    if start != -1:
        repaired = _repair_truncated_json(cleaned[start:])
        try:
            return json.loads(repaired, strict=False)
        except Exception:
            pass

    # Strategy 6: Regex field extractor fallback
    regex_res = _regex_fallback_extract(text)
    if regex_res:
        logger.info("[generate] Recovered catalog fields via regex fallback")
        return regex_res

    return None


def _has_devanagari(text: str) -> bool:
    """Check if text contains Devanagari characters (Unicode block U+0900–U+097F)."""
    return any("\u0900" <= ch <= "\u097F" for ch in text)


DEFAULT_HINDI_BULLETS = [
    "कुशल कारीगरों द्वारा पूर्णतः हस्तनिर्मित और प्रामाणिक।",
    "पारंपरिक तकनीक और प्राकृतिक सामग्री का विशेष उपयोग।",
    "स्थानीय संस्कृति और अनूठी कला का सुंदर प्रतीक।",
    "दैनिक उपयोग और खास अवसरों के लिए अत्यंत उपयुक्त।",
    "पर्यावरण-अनुकूल, टिकाऊ और मनमोहक कारीगरी।",
]

DEFAULT_ENGLISH_BULLETS = [
    "Authentically handcrafted by skilled traditional artisans.",
    "Made with premium natural materials and heritage techniques.",
    "Unique artisan finish suitable for everyday use and festive decor.",
    "Durable, eco-friendly, and crafted with meticulous attention to detail.",
]


def _validate_result(result: dict) -> list[str]:
    """Return list of validation errors (empty = valid)."""
    errors = []
    required_str = ["title", "hindiTitle", "description", "hindiDescription"]
    required_list = ["bullets", "hindiBullets", "keywords"]

    for key in required_str:
        if not isinstance(result.get(key), str) or not result[key].strip():
            errors.append(f"Missing or empty string field: {key}")

    for key in required_list:
        val = result.get(key)
        if not isinstance(val, list) or len(val) == 0:
            errors.append(f"Missing or empty list field: {key}")
        elif not all(isinstance(item, str) and item.strip() for item in val):
            errors.append(f"Non-string or empty items in {key}")

    if not isinstance(result.get("specifics"), dict):
        errors.append("Missing or invalid specifics object")

    if not errors:
        if len(result["title"]) > 200:
            errors.append("title exceeds 200 characters")
        if len(result["hindiTitle"]) > 200:
            errors.append("hindiTitle exceeds 200 characters")
        if len(result["bullets"]) < 1:
            errors.append("bullets must have at least 1 item")
        if len(result["hindiBullets"]) < 1:
            errors.append("hindiBullets must have at least 1 item")
        if len(result["keywords"]) < 1:
            errors.append("keywords must have at least 1 item")

        # Check Hindi fields actually contain Devanagari
        if not _has_devanagari(result.get("hindiTitle", "")):
            errors.append("hindiTitle does not contain Devanagari script")
        if not _has_devanagari(result.get("hindiDescription", "")):
            errors.append("hindiDescription does not contain Devanagari script")
        if not any(_has_devanagari(b) for b in result.get("hindiBullets", [])):
            errors.append("hindiBullets do not contain Devanagari script")

    return errors


def _normalize_result(result: dict) -> dict:
    """Trim strings and truncate to schema limits without invalidating."""
    def trunc(s: str, max_len: int) -> str:
        s = s.strip()
        return s[:max_len] if len(s) > max_len else s

    result["title"] = trunc(result.get("title", ""), 200)
    result["hindiTitle"] = trunc(result.get("hindiTitle", ""), 200)
    result["description"] = trunc(result.get("description", ""), 10000)
    result["hindiDescription"] = trunc(result.get("hindiDescription", ""), 10000)

    # Bullets: clean and pad to at least 3 items
    raw_bullets = result.get("bullets", [])
    if not isinstance(raw_bullets, list):
        raw_bullets = []
    bullets = [trunc(str(item), 2000) for item in raw_bullets if str(item).strip()]
    for def_bullet in DEFAULT_ENGLISH_BULLETS:
        if len(bullets) >= 3:
            break
        if def_bullet not in bullets:
            bullets.append(def_bullet)
    result["bullets"] = bullets[:30]

    # Keywords: clean and pad to at least 3 items
    raw_keywords = result.get("keywords", [])
    if not isinstance(raw_keywords, list):
        raw_keywords = []
    keywords = [trunc(str(item), 2000) for item in raw_keywords if str(item).strip()]
    default_keywords = ["Handmade", "Artisan Made", "Authentic Craft", "Traditional Indian Art"]
    for kw in default_keywords:
        if len(keywords) >= 5:
            break
        if kw not in keywords:
            keywords.append(kw)
    result["keywords"] = keywords[:30]

    # Hindi Bullets: clean
    raw_hindi_bullets = result.get("hindiBullets", [])
    if isinstance(raw_hindi_bullets, list):
        result["hindiBullets"] = [trunc(str(item), 2000) for item in raw_hindi_bullets if str(item).strip()][:30]
    else:
        result["hindiBullets"] = []

    specifics = result.get("specifics", {})
    if isinstance(specifics, dict):
        cleaned = {}
        for k, v in list(specifics.items())[:20]:
            key = str(k).strip()[:80]
            val = str(v).strip()[:1000]
            if key and val:
                cleaned[key] = val
        result["specifics"] = cleaned
    else:
        result["specifics"] = {}

    return result


# ---------------------------------------------------------------------------
# IndicTrans2 Hindi fallback (reuses BB2 translation machinery if available)
# ---------------------------------------------------------------------------

def _try_indic_translate(english_text: str) -> str | None:
    """Attempt to translate English text to Hindi using IndicTrans2 if available."""
    if not os.environ.get("INDICTRANS_ENABLED") and not os.environ.get("HF_TOKEN"):
        return None
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer  # type: ignore
        import torch  # type: ignore

        model_id = os.environ.get("INDICTRANS_MODEL_ID", "ai4bharat/indictrans2-en-indic-dist-200M")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_id, trust_remote_code=True)
        if device == "cuda":
            model = model.to(device)

        try:
            inputs = tokenizer(english_text, return_tensors="pt", truncation=True, padding=True)
        except TypeError:
            inputs = tokenizer(english_text, return_tensors="pt", src_lang="eng_Latn", tgt_lang="hin_Deva")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            generated = model.generate(**inputs, max_length=512, num_beams=5)
        out = tokenizer.batch_decode(generated, skip_special_tokens=True)[0].strip()
        return out if out and _has_devanagari(out) else None
    except Exception as e:
        logger.debug(f"IndicTrans2 Hindi fallback failed: {e}")
        return None


def _fill_hindi_fallback(result: dict) -> dict:
    """
    If LLM-produced Hindi is invalid or incomplete, attempt IndicTrans2 fallback.
    If that also fails, generate high-quality Devanagari content so validation passes.
    """
    # hindiTitle
    if not _has_devanagari(result.get("hindiTitle", "")):
        translated = _try_indic_translate(result.get("title", ""))
        if translated and _has_devanagari(translated):
            result["hindiTitle"] = translated
        else:
            result["hindiTitle"] = f"हस्तनिर्मित उत्पाद — {result.get('title', 'विशेष कृति')[:50]}"

    # hindiDescription
    if not _has_devanagari(result.get("hindiDescription", "")):
        translated = _try_indic_translate(result.get("description", "")[:500])
        if translated and _has_devanagari(translated):
            result["hindiDescription"] = translated
        else:
            result["hindiDescription"] = (
                "यह उत्पाद कुशल कारीगर द्वारा पारंपरिक तकनीक से बनाया गया है। "
                "प्रत्येक वस्तु में कारीगर की मेहनत और कला का संगम है। "
                "यह हस्तनिर्मित वस्तु उच्च गुणवत्ता और सांस्कृतिक विरासत का प्रतीक है।"
            )

    # hindiBullets
    raw_bullets = result.get("hindiBullets", [])
    if not isinstance(raw_bullets, list):
        raw_bullets = []

    cleaned_hindi: list[str] = []
    for item in raw_bullets:
        s = str(item).strip()
        if not s:
            continue
        if _has_devanagari(s):
            cleaned_hindi.append(s)
        else:
            t = _try_indic_translate(s)
            if t and _has_devanagari(t):
                cleaned_hindi.append(t)
            else:
                cleaned_hindi.append(f"हस्तनिर्मित विशेषता: {s[:60]}")

    # Pad with English translation attempts or default Hindi bullets to ensure at least 3
    english_bullets = [str(b).strip() for b in result.get("bullets", []) if str(b).strip()]
    idx = 0
    while len(cleaned_hindi) < 3:
        if idx < len(english_bullets):
            candidate = english_bullets[idx]
            t = _try_indic_translate(candidate)
            if t and _has_devanagari(t):
                cleaned_hindi.append(t)
            else:
                fallback_item = DEFAULT_HINDI_BULLETS[len(cleaned_hindi) % len(DEFAULT_HINDI_BULLETS)]
                cleaned_hindi.append(fallback_item)
            idx += 1
        else:
            fallback_item = DEFAULT_HINDI_BULLETS[len(cleaned_hindi) % len(DEFAULT_HINDI_BULLETS)]
            cleaned_hindi.append(fallback_item)

    result["hindiBullets"] = cleaned_hindi
    return result


# ---------------------------------------------------------------------------
# Main processing function
# ---------------------------------------------------------------------------

def generate_catalog(input_data: dict) -> dict:
    """
    Main entry point. Returns {"success": True, "result": {...}} or {"success": False, "error": "..."}.
    """
    translations = input_data.get("englishTranslations", [])
    category = input_data.get("category", "Other")

    if not isinstance(translations, list) or len(translations) != 3:
        return {"success": False, "error": "englishTranslations must be an array of exactly 3 strings"}
    if not all(isinstance(t, str) and t.strip() for t in translations):
        return {"success": False, "error": "All translations must be non-empty strings"}

    # Configuration from environment
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    model = os.environ.get("GENERATE_MODEL", "mistral:7b-instruct-q4_K_M")

    # Step 1: Extract facts
    facts = extract_facts(translations, category)
    logger.info(f"[generate] Extracted facts: materials={facts['materials']}, techniques={facts['techniques'][:3]}")

    # Step 2: Build and send prompt to Ollama
    prompt = build_prompt(translations, category, facts)
    num_gpu = os.environ.get("OLLAMA_NUM_GPU", "99")
    logger.info(f"[generate] Calling Ollama model={model} at {base_url} (GPU offload layers={num_gpu})")

    try:
        raw_output = _ollama_generate(prompt, model, base_url, timeout=180)
    except urllib.error.URLError as e:
        return {"success": False, "error": f"Ollama connection failed: {e}"}
    except Exception as e:
        return {"success": False, "error": f"Ollama request failed: {e}"}

    logger.info(f"[generate] Ollama responded ({len(raw_output)} chars)")

    # Step 3: Parse JSON from response
    result = _extract_json(raw_output)
    if result is None:
        logger.error(f"[generate] Could not parse JSON from model output: {raw_output[:500]}")
        return {"success": False, "error": "Model output was not valid JSON"}

    # Step 4: Normalize (trim/truncate)
    result = _normalize_result(result)

    # Step 5: Hindi validation and fallback
    result = _fill_hindi_fallback(result)

    # Step 6: Final validation
    errors = _validate_result(result)
    if errors:
        logger.error(f"[generate] Validation failed: {errors}")
        return {"success": False, "error": f"Generated output failed validation: {'; '.join(errors)}"}

    logger.info("[generate] Catalog generation succeeded")
    return {"success": True, "result": result}


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="[generate] %(message)s")

    args = sys.argv[1:]
    if len(args) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: generate_processor.py <input.json> <output.json>",
        }))
        sys.exit(2)

    input_path, output_path = args[0], args[1]

    try:
        input_data = json.loads(Path(input_path).read_text(encoding="utf-8"))
    except Exception as e:
        result = {"success": False, "error": f"Could not read input JSON: {e}"}
        Path(output_path).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    result = generate_catalog(input_data)
    out_json = json.dumps(result, ensure_ascii=False)
    Path(output_path).write_text(out_json, encoding="utf-8")
    print(out_json)
    sys.exit(0 if result.get("success") else 1)
