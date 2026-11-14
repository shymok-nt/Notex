"""Run: python -m unittest discover -s tools/handwriting_ocr -p test_benchmark.py"""
import tempfile
import unittest
from pathlib import Path

from benchmark import distance, normalize, score, load_manifest


class BenchmarkTests(unittest.TestCase):
    def test_turkish_diacritics_are_not_stripped(self):
        self.assertEqual(normalize("  Şişli   Iğdır  "), "Şişli Iğdır")
        self.assertEqual(distance(list("adım"), list("adim")), 1)

    def test_cer_and_wer(self):
        result = score([{"expected": "Benim adım Onur", "actual": "Benim adim Onur"}])
        self.assertEqual(result["cer"], 0.0667)
        self.assertEqual(result["wer"], 0.3333)

    def test_manifest_rejects_missing_images(self):
        with tempfile.TemporaryDirectory() as folder:
            manifest = Path(folder) / "samples.jsonl"
            manifest.write_text('{"id":"a","image":"missing.png","text":"Merhaba","split":"test"}', encoding="utf-8")
            with self.assertRaises(ValueError):
                load_manifest(manifest)


if __name__ == "__main__":
    unittest.main()
