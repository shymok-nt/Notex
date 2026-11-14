# Optional TrOCR handwriting experiment (Windows)

PaddleOCR remains the default. This is a comparison experiment, not a guaranteed Turkish handwriting improvement. Microsoft's `microsoft/trocr-small-handwritten` is trained on IAM English handwriting and expects a **single text line**. It does not return word boxes: the experimental integration uses the full input crop as one line and therefore cannot accurately preserve individual word spacing. Keep PaddleOCR for normal use until accuracy and layout are evaluated.

## Setup

From the project root, activate the existing Windows OCR virtual environment and install optional dependencies:

```powershell
.\.venv-ocr\Scripts\python.exe -m pip install "transformers>=4.40,<5" torch pillow sentencepiece
```

To opt in, add this to the project's local `.env` file:

```env
EXPO_PUBLIC_NOTEX_OCR_ENGINE=trocr
```

Restart the development server and Tauri app. The first TrOCR request downloads model weights and can take substantially longer; subsequent runs use the local Hugging Face cache. CPU inference can be slower than PaddleOCR. TrOCR loads lazily when first requested. If it fails to load, the frontend retries the existing PaddleOCR engine.

To revert, remove the environment variable or set `EXPO_PUBLIC_NOTEX_OCR_ENGINE=paddle` and restart. Existing page content and stroke data are unchanged by selecting the OCR engine.

## Evaluation

Compare the same single-line samples in Turkish and English, including dotted/dotless i and Turkish diacritics. Compare recognized text, model name and `inferenceMs` in the Notex OCR logs. The TrOCR response uses a placeholder confidence score of 1.0 because this experiment does not calculate calibrated token confidence. Do not treat it as an accuracy measure.
