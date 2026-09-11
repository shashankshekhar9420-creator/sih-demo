#!/usr/bin/env python3
"""
Image Processing Black Box — GPU path for BB1.

Activated when IMAGE_PROCESSOR=python and this script exists.
Uses REMBG (U2-Net, ONNX) for background removal, then white
replacement, CLAHE + brightness/contrast, and a subtle contact
shadow. Falls back to sharp on any error (caller handles fallback).

On a RTX 3050 6GB: ~1-3s/image via ONNX Runtime CUDA.
Without CUDA, REMBG runs CPU — still correct, slower.

Usage: python scripts/image_processor.py <input_path> <output_path>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

try:
    import cv2  # type: ignore
except Exception:
    cv2 = None  # type: ignore[assignment]

try:
    from rembg import remove  # type: ignore
except Exception:
    remove = None  # type: ignore[assignment]


def _process_with_rembg(img_rgba: Image.Image) -> Image.Image:
    if remove is None:
        return img_rgba
    try:
        # Use GPU if onnxruntime-gpu is installed; rembg picks provider automatically.
        # alpha_matting smooths edges for handicrafts.
        out = remove(img_rgba, alpha_matting=True)  # type: ignore[arg-type]
        if isinstance(out, Image.Image):
            return out
        return Image.fromarray(out)
    except Exception:
        return img_rgba


def process_image(input_path: str, output_path: str) -> dict:  # noqa: C901
    try:
        img = Image.open(input_path).convert("RGBA")
        w, h = img.size

        # 1) Background removal
        img_no_bg = _process_with_rembg(img)

        # 2) White backdrop
        white = Image.new("RGBA", img_no_bg.size, (255, 255, 255, 255))
        comp = Image.alpha_composite(white, img_no_bg).convert("RGB")

        # 3) Lighting correction (OpenCV if available)
        if cv2 is not None:
            cv = cv2.cvtColor(np.array(comp), cv2.COLOR_RGB2BGR)
            try:
                lab = cv2.cvtColor(cv, cv2.COLOR_BGR2LAB)
                channels = list(cv2.split(lab))
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                channels[0] = clahe.apply(channels[0])
                lab = cv2.merge(channels)  # type: ignore[arg-type]
                cv = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            except Exception:
                pass
            # Brightness/contrast lift
            try:
                cv = cv2.convertScaleAbs(cv, alpha=1.15, beta=11)
            except Exception:
                pass
            comp = Image.fromarray(cv2.cvtColor(cv, cv2.COLOR_BGR2RGB))

        # 4) Subtle contact shadow
        try:
            shadow = Image.new("RGBA", comp.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(shadow)
            sh = max(4, int(h * 0.08))
            y0 = h - sh
            for i in range(sh):
                alpha = int(15 * (1 - (i / sh)))
                draw.line([(0, y0 + i), (w, y0 + i)], fill=(0, 0, 0, alpha))
            shadow = shadow.filter(ImageFilter.GaussianBlur(radius=3))
            # Blend shadow onto RGB result via alpha composite
            base_rgba = comp.convert("RGBA")
            base_rgba = Image.alpha_composite(base_rgba, shadow)
            comp = base_rgba.convert("RGB")
        except Exception:
            pass

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        comp.save(output_path, quality=92)
        return {
            "success": True,
            "input_path": input_path,
            "output_path": output_path,
            "original_size": [w, h],
            "method": "rembg" if remove is not None else "pillow-fallback",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: image_processor.py <input> <output>"}))
        sys.exit(2)
    result = process_image(sys.argv[1], sys.argv[2])
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)
