# BENCHMARKS.md

Measured locally (Apple Silicon, dev machine) via `tests/benchmark-redteam.test.ts` — run `npm test` to reproduce. Third-party figures cited in OPEN_SOURCE_TECHNOLOGY_EVALUATION.md are external and marked as such.

## In-repo engine measurements (this repo, synthetic fixtures)

| Component | Fixture | Result | Threshold |
|---|---|---|---|
| PDF forensics — clean doc | 2-page synthetic PDF | ~3ms | <150ms |
| PDF forensics — tampered (JS + incremental updates) | adversarial PDF | ~1ms, HIGH signal raised | <100ms |
| Entity linkage (FS-lite scorer) | 200 comparison pairs | ~3ms total (~0.015ms/pair) | <50ms |
| QR pipeline (jsQR path) | n/a in CI — requires raster fixtures; exercised at runtime upload | — | — |

## Adversarial red-team outcomes (all defenses held)

| Attack vector | Expected behavior | Status |
|---|---|---|
| R1 Valid-format GSTIN with corrupted checksum | Validator fails; result never VERIFIED | ✅ blocked |
| R2 Identity merge by name similarity alone | No AUTO_MATCH without identifier agreement | ✅ blocked |
| R3 Altered PDF (JS action + incremental updates) | HUMAN_REVIEW triage; L1 structurally-valid withheld | ✅ detected |
| R4 OCR single-source extraction | Consensus = SINGLE_SOURCE (never STRONG); authority = REQUIRES_AUTHORIZATION | ✅ honest |
| R5 Government API timeout/unavailable | Never becomes green VERIFIED | ✅ blocked |
| R6 QR payload conflicts with OCR text | CONFLICTING_EVIDENCE + HUMAN_REVIEW | ✅ escalated |
| RAG tier override attempt | TIER-1 gov chunk outranks secondary sources | ✅ ranked first |

## External reference points (third-party benchmarks, not measured here)

- Docling: ~8s/12 pages CPU; layout mAP ≈93% (CodeSOTA 2025); Procycons 2025 table accuracy 97.9%.
- PaddleOCR 3.x: strong degraded-scan CER; PP-OCRv5/PP-StructureV3 competitive with billion-param VLMs (<100M params) per arXiv:2507.05595.
- Splink: ~1M records/minute on laptop-class DuckDB hardware (project docs).

Re-benchmark policy: engines drift monthly — rerun `npm test` plus external comparisons quarterly before changing adapters.
