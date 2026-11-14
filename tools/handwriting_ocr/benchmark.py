"""Offline OCR benchmark: JSONL manifest -> per-sample results and CER/WER summary.

No external packages required. Never sends handwriting to a server.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import unicodedata
from pathlib import Path


def distance(a: list[str], b: list[str]) -> int:
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y)))
        previous = current
    return previous[-1]


def normalize(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).split())


def score(rows: list[dict]) -> dict:
    chars = words = char_errors = word_errors = 0
    times: list[float] = []
    for row in rows:
        expected = normalize(row["expected"])
        actual = normalize(row["actual"])
        chars += len(expected)
        words += len(expected.split())
        char_errors += distance(list(expected), list(actual))
        word_errors += distance(expected.split(), actual.split())
        if isinstance(row.get("inferenceMs"), (int, float)):
            times.append(row["inferenceMs"])
    return {
        "samples": len(rows),
        "cer": round(char_errors / max(chars, 1), 4),
        "wer": round(word_errors / max(words, 1), 4),
        "medianInferenceMs": round(statistics.median(times)) if times else None,
    }


def load_manifest(path: Path) -> list[dict]:
    samples = []
    ids = set()
    for line_number, line in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = json.loads(line)
        if not all(isinstance(item.get(k), str) and item[k].strip() for k in ("id", "image", "text", "split")):
            raise ValueError(f"Line {line_number}: id, image, text, split required")
        if item["split"] not in ("train", "val", "test"):
            raise ValueError(f"Line {line_number}: invalid split")
        if item["id"] in ids:
            raise ValueError(f"Line {line_number}: duplicate id")
        ids.add(item["id"])
        image = (path.parent / item["image"]).resolve()
        if not image.is_relative_to(path.parent.resolve()) or not image.is_file():
            raise ValueError(f"Line {line_number}: missing/unsafe image path")
        if image.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            raise ValueError(f"Line {line_number}: unsupported image type")
        samples.append({**item, "_image": image})
    if not samples:
        raise ValueError("No samples in manifest")
    return samples


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--predictions", type=Path, help="JSONL with id, actual, optional inferenceMs; no OCR installation needed")
    parser.add_argument("--engine", choices=["paddle", "trocr"], help="Run the selected local OCR model")
    parser.add_argument("--split", choices=["train", "val", "test"], default="test")
    parser.add_argument("--output", type=Path, default=Path("ocr-benchmark-results.json"))
    args = parser.parse_args()
    if bool(args.predictions) == bool(args.engine):
        parser.error("Specify exactly one of --predictions or --engine")
    samples = [s for s in load_manifest(args.manifest) if s["split"] == args.split]
    if not samples:
        parser.error(f"No samples in split {args.split}")
    predictions = {}
    if args.predictions:
        for line in args.predictions.read_text(encoding="utf-8-sig").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row["id"] in predictions:
                raise ValueError(f"Duplicate prediction id: {row['id']}")
            predictions[row["id"]] = row
    else:
        # Import lazily; scoring an existing prediction file requires no ML packages.
        import importlib.util
        module_path = Path(__file__).with_name("recognize.py")
        spec = importlib.util.spec_from_file_location("notex_recognize", module_path)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)
        if args.engine == "trocr":
            def infer(path: Path) -> dict:
                return module.recognize_trocr(path.read_bytes())
        else:
            from paddleocr import PaddleOCR
            engine = PaddleOCR(lang="tr", use_doc_orientation_classify=False,
                               use_doc_unwarping=False, use_textline_orientation=False,
                               enable_mkldnn=False)
            def infer(path: Path) -> dict:
                started = time.perf_counter()
                result = engine.predict(str(path))
                texts = []
                for entry in result:
                    payload = entry.json
                    if callable(payload):
                        payload = payload()
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    payload = payload.get("res", payload)
                    texts.extend(payload.get("rec_texts", []))
                return {"lines": [{"text": str(t)} for t in texts],
                        "inferenceMs": round((time.perf_counter() - started) * 1000)}
    rows = []
    for sample in samples:
        if args.predictions:
            if sample["id"] not in predictions:
                raise ValueError(f"Missing prediction for {sample['id']}")
            pred = predictions[sample["id"]]
            actual = pred["actual"]
            ms = pred.get("inferenceMs")
        else:
            result = infer(sample["_image"])
            actual = " ".join(line["text"] for line in result.get("lines", []))
            ms = result.get("inferenceMs")
        if not isinstance(actual, str):
            raise ValueError(f"Non-text prediction for {sample['id']}")
        rows.append({"id": sample["id"], "expected": sample["text"],
                     "actual": actual, "inferenceMs": ms})
    report = {"engine": args.engine or "external", "split": args.split,
              "summary": score(rows), "samples": rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    print(f"Report: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
