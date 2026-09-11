import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.generate_processor import (
    extract_facts,
    build_prompt,
    _extract_json,
    _validate_result,
    _normalize_result,
    _fill_hindi_fallback,
    generate_catalog,
)

def test_fact_extraction():
    trans = [
        "This is a handmade terracotta vase made from alluvial clay and mud.",
        "It is hand carved, kiln-fired for 2 days, height is 25 cm and weight is 800 gm.",
        "It is used for home decor and gifting during festive Diwali pooja."
    ]
    facts = extract_facts(trans, "Pottery & Terracotta")
    assert "terracotta" in facts["materials"] or "clay" in facts["materials"], "Materials extraction failed"
    assert any("25 cm" in d for d in facts["dimensions"]), "Dimensions extraction failed"
    assert any("kiln" in t or "carved" in t for t in facts["techniques"]), "Techniques extraction failed"
    assert "material" in facts["categoryKeyFields"]
    print("✔ Fact extraction test passed")

def test_prompt_builder():
    trans = ["Clay pot", "Wheel thrown red clay", "For water storage"]
    facts = extract_facts(trans, "Pottery & Terracotta")
    prompt = build_prompt(trans, "Pottery & Terracotta", facts)
    assert "ARTISAN VOICE RECORDING TRANSCRIPTS" in prompt
    assert "Q1 — What is this product called" in prompt
    assert "Devanagari" in prompt
    assert "Pottery & Terracotta" in prompt
    print("✔ Prompt builder test passed")

def test_json_extraction():
    raw_sample = """Here is the generated catalog for your product:
```json
{
  "title": "Handmade Terracotta Water Pitcher",
  "hindiTitle": "पारंपरिक मिट्टी का मटका",
  "description": "Handcrafted clay pitcher made from natural riverbed clay. Perfect for naturally cooling drinking water.",
  "hindiDescription": "प्राकृतिक नदी की मिट्टी से बना हस्तनिर्मित मटका। पीने के पानी को ठंडा रखने के लिए उत्तम।",
  "bullets": [
    "100% natural alluvial clay",
    "Hand-thrown on traditional potter wheel",
    "Naturally cools water without electricity"
  ],
  "hindiBullets": [
    "100% प्राकृतिक जलोढ़ मिट्टी",
    "पारंपरिक चाक पर हस्तनिर्मित",
    "प्राकृतिक रूप से पानी ठंडा रखता है"
  ],
  "specifics": {
    "Material": "Terracotta Clay",
    "Capacity": "2 Litres"
  },
  "keywords": [
    "terracotta", "water pitcher", "clay pot", "handmade", "matka"
  ]
}
```
Let me know if you need any adjustments!"""
    parsed = _extract_json(raw_sample)
    assert parsed is not None, "JSON extraction failed"
    assert parsed["title"] == "Handmade Terracotta Water Pitcher"
    assert len(parsed["bullets"]) == 3
    print("✔ JSON extraction with markdown fences test passed")

    # Test normalization & validation
    norm = _normalize_result(parsed)
    errors = _validate_result(norm)
    assert len(errors) == 0, f"Validation failed: {errors}"
    print("✔ Schema validation test passed")

def test_hindi_fallback():
    mock_bad_hindi = {
        "title": "Brass Bell",
        "hindiTitle": "Brass Bell in English",
        "description": "Handcrafted brass bell with resonant tone.",
        "hindiDescription": "English description without Devanagari script.",
        "bullets": ["Handmade brass", "Clear sound", "Temple puja"],
        "hindiBullets": ["Handmade brass", "Clear sound", "Temple puja"],
        "specifics": {"Metal": "Brass"},
        "keywords": ["brass", "bell", "temple"]
    }
    # Initial validation should fail due to missing Devanagari
    errs = _validate_result(mock_bad_hindi)
    assert len(errs) > 0, "Expected validation errors for non-Devanagari Hindi"

    # After fallback, it should pass
    fixed = _fill_hindi_fallback(mock_bad_hindi)
    errs_after = _validate_result(fixed)
    assert len(errs_after) == 0, f"Fallback did not resolve Devanagari errors: {errs_after}"
    assert "हस्तनिर्मित" in fixed["hindiDescription"]
    print("✔ Hindi Devanagari validation and fallback test passed")

def test_cli_graceful_offline_behavior():
    with tempfile.TemporaryDirectory() as tmp:
        in_file = Path(tmp) / "input.json"
        out_file = Path(tmp) / "output.json"
        in_file.write_text(json.dumps({
            "englishTranslations": ["Clay pot", "Kiln fired", "For home decor"],
            "category": "Pottery & Terracotta"
        }), encoding="utf-8")

        # Run script with non-existent ollama port to verify graceful exit (code 1, error JSON)
        env = {**os.environ, "OLLAMA_BASE_URL": "http://127.0.0.1:59999"}
        res = subprocess.run(
            [sys.executable, str(REPO_ROOT / "scripts" / "generate_processor.py"), str(in_file), str(out_file)],
            capture_output=True,
            text=True,
            env=env
        )
        assert res.returncode == 1, f"Expected returncode 1, got {res.returncode}"
        assert out_file.exists(), "Output JSON file was not written"
        out_data = json.loads(out_file.read_text(encoding="utf-8"))
        assert out_data["success"] is False, "Expected success=False"
        assert "Ollama connection failed" in out_data["error"]
        print("✔ CLI graceful offline error handling test passed")

if __name__ == "__main__":
    test_fact_extraction()
    test_prompt_builder()
    test_json_extraction()
    test_hindi_fallback()
    test_cli_graceful_offline_behavior()
    print("\n🎉 ALL PYTHON BB3 TESTS PASSED!")
