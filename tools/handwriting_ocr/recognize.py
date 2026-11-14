"""Standalone Windows OCR experiment; not connected to the Notex drawing pipeline.

Usage: python tools/handwriting_ocr/recognize.py path/to/handwriting.png
Prints a single JSON object to stdout. Diagnostics go to stderr.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path



def serve() -> int:
    """Keep PaddleOCR models loaded and accept newline-delimited base64 PNG requests."""
    import base64
    import tempfile
    import os
    try:
        from paddleocr import PaddleOCR
        # Prefer the small PP-OCRv6 models for interactive Windows CPU use.
        # Fall back to the previous default if this PaddleOCR installation does
        # not provide the mobile model pair.
        common = dict(
            lang="tr",
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
            cpu_threads=4,
        )
        model_name = "PP-OCRv6_mobile"
        try:
            engine = PaddleOCR(
                **common,
                text_detection_model_name="PP-OCRv6_mobile_det",
                text_recognition_model_name="PP-OCRv6_mobile_rec",
                text_det_limit_side_len=640,
            )
        except Exception as exc:
            print("Mobile OCR models unavailable, using default: " + str(exc), file=sys.stderr, flush=True)
            engine = PaddleOCR(**common)
            model_name = "default"
        print(json.dumps({"ready": True, "model": model_name}), flush=True)
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc)}, ensure_ascii=False), flush=True)
        return 1
    for raw in sys.stdin:
        try:
            request = json.loads(raw)
            data = base64.b64decode(request["pngBase64"], validate=True)
            if len(data) > 6_000_000 or not data.startswith(bytes([137, 80, 78, 71, 13, 10, 26, 10])):
                raise ValueError("Invalid PNG")
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp.write(data)
                name = tmp.name
            try:
                results = engine.predict(name)
            finally:
                os.unlink(name)
            lines = []
            for result in results:
                payload = getattr(result, "json", {})
                if callable(payload):
                    payload = payload()
                if isinstance(payload, str):
                    payload = json.loads(payload)
                payload = payload.get("res", payload)
                for index, value in enumerate(payload.get("rec_texts", [])):
                    scores = payload.get("rec_scores", [])
                    boxes = payload.get("rec_boxes", [])
                    box = boxes[index] if index < len(boxes) else None
                    lines.append({"text": str(value),
                                  "score": float(scores[index]) if index < len(scores) else None,
                                  "box": box.tolist() if hasattr(box, "tolist") else box})
            print(json.dumps({"ok": True, "lines": lines}, ensure_ascii=False), flush=True)
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), flush=True)
    return 0

def main() -> int:
    if "--serve" in sys.argv:
        return serve()
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
            enable_mkldnn=False,  # Avoid Windows CPU oneDNN/PIR attribute conversion failure.
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
