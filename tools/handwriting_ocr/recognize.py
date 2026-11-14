"""Standalone Windows OCR experiment; not connected to the Notex drawing pipeline.

Usage: python tools/handwriting_ocr/recognize.py path/to/handwriting.png
Prints a single JSON object to stdout. Diagnostics go to stderr.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def extract_lines(results):
    """Normalize PaddleOCR 3.x results without changing text or boxes."""
    lines = []
    for result in results:
        payload = getattr(result, "json", {})
        if callable(payload):
            payload = payload()
        if isinstance(payload, str):
            payload = json.loads(payload)
        if not isinstance(payload, dict):
            continue
        payload = payload.get("res", payload)
        scores = payload.get("rec_scores", [])
        boxes = payload.get("rec_boxes", [])
        for index, value in enumerate(payload.get("rec_texts", [])):
            box = boxes[index] if index < len(boxes) else None
            lines.append({
                "text": str(value),
                "score": float(scores[index]) if index < len(scores) else None,
                "box": box.tolist() if hasattr(box, "tolist") else box,
            })
    return lines


def needs_second_pass(lines):
    """Only retry uncertain recognition; do not add latency to clear results."""
    return not lines or any(
        not line["text"].strip()
        or line["score"] is None
        or line["score"] < 0.80
        for line in lines
    )


def quality(lines):
    """Conservative image-variant ranking, not a calibrated accuracy estimate."""
    if not lines or any(not line["text"].strip() for line in lines):
        return -1.0
    scores = [line["score"] for line in lines]
    if any(score is None for score in scores):
        return -1.0
    return min(scores)


def enhance_image(source, target):
    """Preserve geometry/box coordinates while enhancing faint ink locally."""
    from PIL import Image, ImageOps, ImageFilter
    with Image.open(source) as image:
        gray = ImageOps.grayscale(image)
        enhanced = ImageOps.autocontrast(gray, cutoff=0.5)
        enhanced = enhanced.filter(ImageFilter.UnsharpMask(radius=1.0, percent=110, threshold=3))
        enhanced.save(target, format="PNG")


def serve() -> int:
    """Keep PaddleOCR models loaded and accept newline-delimited base64 PNG requests."""
    import base64
    import tempfile
    import os
    import time
    try:
        from paddleocr import PaddleOCR
        # Prefer the lightweight PP-OCRv5 mobile detector and recognizer on CPU.\n        # Explicit model names determine the recognition vocabulary; lang is ignored.
        # Unsupported model versions fall back to the installed default.
        common = dict(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
            cpu_threads=4,
        )
        model_name = "PP-OCRv5_mobile_det+rec"
        fallback_reason = None
        try:
            engine = PaddleOCR(
                **common,
                text_detection_model_name="PP-OCRv5_mobile_det",
                text_recognition_model_name="PP-OCRv5_mobile_rec",
                text_det_limit_side_len=1280,
                text_det_limit_type="max",
            )
        except Exception as exc:
            print("Mobile OCR models unavailable, using default: " + str(exc), file=sys.stderr, flush=True)
            engine = PaddleOCR(**common, lang="tr")
            model_name = "default"
            fallback_reason = str(exc)
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
                inference_started = time.perf_counter()
                lines = extract_lines(engine.predict(name))
                recognition_pass = "original"
                # A second local image variant can recover small diacritics
                # without inventing Turkish spellings. Keep pixel dimensions
                # identical so existing canvas alignment remains unchanged.
                if needs_second_pass(lines):
                    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as alt:
                        enhanced_name = alt.name
                    try:
                        enhance_image(name, enhanced_name)
                        alternative = extract_lines(engine.predict(enhanced_name))
                        if quality(alternative) > quality(lines) + 0.04:
                            lines = alternative
                            recognition_pass = "enhanced"
                    except Exception as retry_error:
                        print("OCR enhancement skipped: " + str(retry_error), file=sys.stderr, flush=True)
                    finally:
                        os.unlink(enhanced_name)
                inference_ms = round((time.perf_counter() - inference_started) * 1000)
            finally:
                os.unlink(name)
            print(json.dumps({"ok": True, "lines": lines, "inferenceMs": inference_ms, "model": model_name, "fallbackReason": fallback_reason, "recognitionPass": recognition_pass}, ensure_ascii=False), flush=True)
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
