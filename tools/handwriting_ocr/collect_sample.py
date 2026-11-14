"""Import consented handwriting line images into a local, gitignored OCR dataset."""
from __future__ import annotations

import argparse
import json
import shutil
import unicodedata
from pathlib import Path


def add_sample(manifest: Path, image: Path, text: str, writer: str, split: str, sample_id: str) -> dict:
    if not image.is_file() or image.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        raise ValueError("A readable PNG/JPEG image is required")
    if not text.strip() or not writer.strip() or not sample_id.strip():
        raise ValueError("Non-empty text, writer and id are required")
    if split not in ("train", "val", "test"):
        raise ValueError("Split must be train, val or test")
    if any(char in sample_id for char in "/\\") or sample_id in (".", ".."):
        raise ValueError("Invalid sample id")
    manifest.parent.mkdir(parents=True, exist_ok=True)
    existing = []
    if manifest.exists():
        for line in manifest.read_text(encoding="utf-8-sig").splitlines():
            if line.strip():
                existing.append(json.loads(line))
    if any(row["id"] == sample_id for row in existing):
        raise ValueError("Duplicate sample id")
    if any(row.get("writer") == writer and row["split"] != split for row in existing):
        raise ValueError("Writer already belongs to a different split; avoid data leakage")
    destination = manifest.parent / "images" / (sample_id + image.suffix.lower())
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise ValueError("Destination image already exists")
    row = {"id": sample_id, "image": destination.relative_to(manifest.parent).as_posix(),
           "text": unicodedata.normalize("NFC", text.strip()),
           "split": split, "writer": writer}
    shutil.copyfile(image, destination)
    try:
        with manifest.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return row


def main() -> None:
    parser = argparse.ArgumentParser(description="Add one labeled handwriting line to the local OCR dataset")
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--text", required=True, help="Exact transcription, including Turkish characters")
    parser.add_argument("--writer", required=True, help="Anonymous writer identifier")
    parser.add_argument("--split", choices=["train", "val", "test"], default="test")
    parser.add_argument("--id", required=True, dest="sample_id")
    parser.add_argument("--manifest", type=Path, default=Path("tools/handwriting_ocr/data/samples.jsonl"))
    args = parser.parse_args()
    print(json.dumps(add_sample(args.manifest, args.image, args.text, args.writer, args.split, args.sample_id), ensure_ascii=False))


if __name__ == "__main__":
    main()
