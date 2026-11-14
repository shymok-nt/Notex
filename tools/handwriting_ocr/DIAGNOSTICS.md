# Notex OCR accuracy diagnosis — phase 1

## Enable diagnostics

In your local `.env`, add:

```env
EXPO_PUBLIC_NOTEX_OCR_DIAGNOSTICS=true
```

Restart `npm run tauri:dev` (and the Expo dev server if it is already running). Open the WebView developer console. For each OCR attempt, expand `[Notex OCR diagnostic]`. The log contains the **exact PNG input** as a data URL, the OCR engine, raw recognized text, boxes, reported confidence and inference time.

**Privacy:** handwriting data is only printed locally to the developer console when diagnostics are enabled; do not share the data URL publicly. Disable diagnostics after troubleshooting. No new database or backup fields are added.

## Evaluation

1. Write one complete line, pause for one second, and inspect the exact raster. Confirm the text isn't cut off or split mid-word.
2. Repeat the same text with `EXPO_PUBLIC_NOTEX_OCR_ENGINE=paddle` and then `trocr`, restarting between tests.
3. Record expected text, actual text, model, `inferenceMs` and whether the line was clipped. Use at least 10 different Turkish sentences with dotted/dotless i, ğ, ş, ç, ö, ü.
4. Compare character error rate (CER) and word error rate (WER) rather than selecting a model based on one sentence.
5. TrOCR Small is trained primarily for English single-line handwriting. Its placeholder confidence score of 1.0 is **not** a calibrated quality estimate. Do not compare it numerically to PaddleOCR confidence.

## Next phase

Use the evidence to fix crop/grouping first if words are clipped, then benchmark a Turkish-capable handwriting model on representative samples. Add optional user confirmation/correction for low-confidence text without modifying original strokes. Avoid silently replacing proper names or inventing Turkish diacritics.
