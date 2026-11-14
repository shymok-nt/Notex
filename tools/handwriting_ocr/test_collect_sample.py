import tempfile
import unittest
from pathlib import Path
from collect_sample import add_sample


class CollectSampleTests(unittest.TestCase):
    def test_add_and_prevent_writer_leakage(self):
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            image = root / "input.png"
            image.write_bytes(b"fake image for metadata test")
            manifest = root / "data" / "samples.jsonl"
            row = add_sample(manifest, image, "  Şişli Iğdır  ", "writer01", "test", "line001")
            self.assertEqual(row["text"], "Şişli Iğdır")
            self.assertTrue((manifest.parent / row["image"]).exists())
            with self.assertRaises(ValueError):
                add_sample(manifest, image, "Merhaba", "writer01", "train", "line002")
            with self.assertRaises(ValueError):
                add_sample(manifest, image, "Merhaba", "writer01", "test", "line001")


if __name__ == "__main__":
    unittest.main()
