"""Standalone Windows OCR experiment; not connected to the Notex drawing pipeline.

Usage: python tools/handwriting_ocr/recognize.py path/to/handwriting.png
Prints a single JSON object to stdout. Diagnostics go to stderr.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline-capable PaddleOCR handwriting experiment")
    parser.add_argument("image", type=Path, help="PNG/JPEG image containing handwriting")
    parser.add_argument("--lang", default="tr", help="PaddleOCR recognition language (default: tr)")
    args = parser.parse_args()
    if not args.image.is_file():
        print(json.dumps({"ok": False, "error": "Image file not found"}, ensure_ascii=False))
        return 2
    try:
        from paddleocr import PaddleOCR
    except ImportError:
        print(json.dumps({"ok": False, "error": "PaddleOCR is not installed; see tools/handwriting_ocr/README.md"}))
        return 3
    try:
        # PaddleOCR 3.x API. First use may download model weights; later runs can be offline.
        engine = PaddleOCR(
            lang=args.lang,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )
        results = engine.predict(str(args.image))
        lines = []
        for result in results:
            data = getattr(result, "json", None)
            if callable(data):
                data = data()
            if isinstance(data, str):
                data = json.loads(data)
            if not isinstance(data, dict):
                raise TypeError("Unexpected PaddleOCR result format")
            payload = data.get("res", data)
            texts = payload.get("rec_texts", [])
            scores = payload.get("rec_scores", [])
            boxes = payload.get("rec_boxes", [])
            for index, value in enumerate(texts):
                lines.append({
                    "text": str(value),
                    "score": float(scores[index]) if index < len(scores) else None,
                    "box": boxes[index].tolist() if index < len(boxes) and hasattr(boxes[index], "tolist") else (boxes[index] if index < len(boxes) else None),
                })
        print(json.dumps({"ok": True, "lines": lines}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
