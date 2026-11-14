# Notex Ink Engine — Phase 3: model feasibility (Windows first)

## Status
**Blocked on a verified Turkish online-ink recognizer.** No handwriting model
has been installed, downloaded, bundled, or enabled. The existing legacy
PaddleOCR remains disabled. Do not present `unavailableInkRecognizer` as
a functioning OCR model.

## Architecture decision
Phase 2 produces ordered vector strokes with x/y/pressure. The original
StrokeElement schema does **not** contain per-point timestamps. Any Windows
API that needs timestamps must use a documented, explicitly approximate
conversion; do not claim that original timestamps exist.

The new `features/canvas/engine/inkRecognizer.ts` defines the stable
`InkRecognizer` interface, `tr-TR` input, candidates and explicit
unavailable/unrecognized results. It does not modify note storage, UI,
autosave, history, or drawing. A later implementation may use a verified
Windows handwriting recognizer or a verified ONNX model, but must not
silently fall back to the old OCR worker.

## Candidate review (2026-11-14)
| Candidate | Turkish | Stroke input | Windows | License / deployment | Decision |
| --- | --- | --- | --- | --- | --- |
| Microsoft Windows InkRecognizer | tr-TR listed | Yes | Native Windows | OS-provided, requires installed recognizer | Preferred feasibility spike; not ONNX; verify on target machine |
| Google ML Kit Digital Ink | tr-TR listed | Yes | Android/iOS only | Google SDK and downloadable language models | Future Android, not Windows |
| Thulium HTR | Turkish claimed | No, raster images | ONNX export claimed | Apache-2.0 claimed; artifacts need validation | Not suitable for stroke-first engine without architectural change |
| TrOCR handwritten | English-focused | No, raster images | ONNX conversion possible | Model/license and weights must be reviewed separately | Reject as Turkish-first default |
| YagmurTaze OCR-ICR-Turkish | Turkish | No, raster images | Keras, no verified ONNX release | Dataset small, verify rights | Research-only |

Sources:
- https://learn.microsoft.com/en-us/windows/apps/develop/input/convert-ink-to-text
- https://github.com/MicrosoftDocs/winrt-api/blob/docs/windows.ui.input.inking/inkrecognizer_name.md
- https://developers.google.com/ml-kit/vision/digital-ink-recognition
- https://developers.google.com/ml-kit/vision/digital-ink-recognition/base-models
- https://github.com/thulium-htr/Thulium
- https://github.com/akincal/OCR
- https://github.com/YagmurTaze/OCR-ICR-Turkish

## Gate before enabling any recognizer
1. Verify Turkish model availability and distribution/license terms.
2. Verify vector stroke format and conversion from existing points.
3. Measure Turkish character/word error rate on real handwriting.
4. Measure cold start, warm inference, RAM and CPU on Windows.
5. Ensure errors preserve original strokes and do not change SQLite data.
6. Require explicit approval before proceeding to Phase 4.

No measured performance, model size, or recognition accuracy is claimed.
