# Notex — Windows handwriting OCR experiment (PaddleOCR)

This is an **isolated prototype**, not a Notex feature yet. It does not modify notes, SQLite, Skia, or drawing events.

## Goal

Measure whether local PaddleOCR can recognize handwritten Turkish and English well enough for automatic handwriting-to-selected-font rendering. **OCR is not handwriting beautification by itself.** Rendering, stroke grouping, timing, undo, and source preservation will be implemented only after accuracy and latency are measured.

## Windows setup (PowerShell)

Use a separate Python virtual environment; do not install Python packages into the Expo project.

```powershell
py -3.11 -m venv .venv-ocr
.\.venv-ocr\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install paddlepaddle
python -m pip install "paddleocr>=3,<4"
python tools/handwriting_ocr/recognize.py "C:\\path\\to\\sample.png"
```

PaddlePaddle/PaddleOCR installation and supported Python versions can change; consult the official Windows CPU installation instructions if pip cannot find a compatible wheel. This prototype targets PaddleOCR **3.x** and has not yet been validated on the user's PC.

The first invocation may **download model weights**. Therefore the first run needs internet; subsequent runs can operate offline if the model is cached. For a distributable offline app we must bundle compatible weights and verify their licenses and download-free startup.

## Test protocol

1. Capture real handwritten PNGs from Notex at a consistent resolution (later phase; manual PNGs are sufficient now).
2. Test Turkish diacritics: `Şişli, Iğdır, Çorlu, öğüt`.
3. Test English: `I am learning English`.
4. Record recognition errors, per-image latency, RAM consumption and model size.
5. Do not integrate into live drawing until accuracy and CPU latency are acceptable.

The `--lang tr` setting requests Turkish recognition, but **does not guarantee accurate Turkish handwriting**. If the model lacks suitable handwriting training, we must evaluate alternatives instead of claiming success.

## Planned integration boundary

- Tauri Windows background process / worker performs inference, never the drawing/render thread.
- The drawing layer submits completed strokes or line snapshots asynchronously, with request IDs and cancellation of stale results.
- Original strokes remain saved; recognized text is a separate reversible presentation.
- The chosen handwriting font is applied only **after** recognition succeeds.
- No automatic changes to existing `PageContent.beautifications` or backup schema in this prototype.

## Legacy code policy

- `examples/recognition-server.ts` is an old **paid API** example and is not part of this experiment.
- `lib/ink/naturalText.ts`, `lib/ink/handwritingFonts.ts`, and the legacy beautification renderer in `DrawingCanvas.tsx` are still referenced by existing saved-note compatibility paths. **Do not delete them yet.**
- Keep `recognitionSourceStrokes`, `recognitionManuallyEdited`, and `beautifications` in serialized data until a backwards-compatible migration/renderer is ready.

This prototype intentionally adds no Node, Rust, or React dependencies.
