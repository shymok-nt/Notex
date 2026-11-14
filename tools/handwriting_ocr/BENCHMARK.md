# Turkish handwriting benchmark — phase 1

The dataset and evaluation harness are ready; **no real handwritten samples are bundled**. Do not claim accuracy until representative images have been collected and evaluated.

## Dataset structure

Create `tools/handwriting_ocr/data/` locally. Store a single handwritten **line** per PNG/JPEG, preferably cropped from Notex's OCR diagnostics. Images are private; do not commit them without permission.

Create `tools/handwriting_ocr/data/samples.jsonl` with one JSON object per line:

```jsonl
{"id":"writer01-line001","image":"images/line001.png","text":"Benim adım Onur","split":"test","writer":"writer01"}
{"id":"writer02-line001","image":"images/line002.png","text":"Şişli, Iğdır, Çorlu","split":"test","writer":"writer02"}
```

Each image path is relative to the manifest. Ground-truth text must be transcribed **exactly**; do not silently replace Turkish letters or punctuation. Use NFC Unicode. Capture a variety of writers, writing speeds, pen sizes, capitalization, punctuation, digits, names and sentences containing `ç ğ ı İ ö ş ü`.

For a useful first benchmark, collect at least 50 independently transcribed lines from several writers; expand to hundreds before model selection. Split **by writer**, not randomly by line, so the same person's handwriting never appears in both training and test sets. Keep the test split untouched during tuning. Do not train on test data.

## Add a real sample without editing JSON by hand

Export/crop a single line from the local OCR diagnostic PNG, or use a consented handwriting image. Then run:

```powershell
.\.venv-ocr\Scripts\python.exe tools/handwriting_ocr/collect_sample.py --image "C:\\Temp\\line001.png" --text "Benim adım Onur" --writer writer01 --split test --id writer01-line001
```

The collector copies the image into the gitignored `data/images/` directory, appends the correct JSONL label, refuses duplicate IDs, and prevents a writer from appearing in different dataset splits. **It cannot collect images automatically or verify your transcription.** Gather samples with permission, and do not use real personal notes or identifying text.

Run the collection and scoring unit tests:

```powershell
.\.venv-ocr\Scripts\python.exe -m unittest discover -s tools/handwriting_ocr -p "test_*.py"
```

## Run (Windows)

```powershell
git pull --ff-only origin main
.\.venv-ocr\Scripts\python.exe tools/handwriting_ocr/benchmark.py --manifest tools/handwriting_ocr/data/samples.jsonl --engine paddle --output paddle-results.json
.\.venv-ocr\Scripts\python.exe tools/handwriting_ocr/benchmark.py --manifest tools/handwriting_ocr/data/samples.jsonl --engine trocr --output trocr-results.json
```

Both commands select the `test` split by default. TrOCR may download weights on first run and is English-oriented; expect Turkish errors. Benchmarking can be slow on CPU.

If predictions were collected separately, save a JSONL file with `{"id":"writer01-line001","actual":"Benim adim Onur","inferenceMs":1020}` and run:

```powershell
python tools/handwriting_ocr/benchmark.py --manifest tools/handwriting_ocr/data/samples.jsonl --predictions predictions.jsonl --output results.json
```

Reports include per-line expected/actual text, character error rate (CER), word error rate (WER), and median inference time. **Lower CER/WER is better**. TrOCR's reported score 1.0 is a placeholder and must not be interpreted as confidence.

## Privacy and limitations

Handwriting may contain private information. Use consented, non-sensitive samples; keep the dataset on your machine. `data/` is gitignored. No app notes, databases or strokes are modified. The benchmark runs separately from the drawing app. It does not yet train or fine-tune a Turkish model.

Next phase: benchmark Turkish-capable handwriting checkpoints on the same fixed test split; choose based on CER/WER and CPU latency before adding language correction or changing the app's default engine.
