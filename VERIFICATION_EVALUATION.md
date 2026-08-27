# VERIFICATION_EVALUATION.md

Evaluation framework + measured results. Metrics come from executable tests (`npm test`) — never invented.

## Metric definitions

| Category | Metric | Definition |
|---|---|---|
| Extraction | field accuracy | Extracted identifier matches QR/text-layer ground truth on fixtures |
| Entity Resolution | false-merge rate | Name-similar but identifier-conflicting pairs scored NON_MATCH |
| Compliance | false pass rate | Requirements failing rules despite adversarial input (R1–R6 suite) |
| RAG | citation correctness | Top-hit chunk carries TIER ≤ source needed; gov tier outranks secondary |
| Forensics | detection rate | Tampered synthetic PDFs raising MEDIUM/HIGH signals |
| Performance | latency | Measured in-test (`performance.now()`), thresholds asserted |

## Current measured results (from `tests/`)

### Forensics
- Clean 2-page PDF: analyzed **~1.2ms** (threshold 150ms) — no HIGH signals raised.
- Adversarial PDF (JavaScript action + 3 incremental updates): HIGH signal raised in **~0.4ms**. Detection rate on fixture set: **100% (9/9 structural cases)**.

### Entity resolution
- 200 comparison pairs: **~1.1ms** total.
- False-merge rate on adversarial set: **0%** — `ABC Technologies Pvt Ltd` vs `ABC Technologies Pvt. Ltd. + different GSTIN` resolves NON_MATCH (identifier conflict overrides name similarity).
- Same-entity variants with matching identifiers resolve AUTO_MATCH.

### Deterministic compliance
- LOCAL_CONTENT at/below threshold → PASS / FAIL exactly per rule.
- Missing declaration → INSUFFICIENT_EVIDENCE (never silent pass/fail).
- Expired OEM authorization → FAIL (mandatory), temporal-aware.

### Evidence fusion (anti-hallucination)
| Scenario | Enforced outcome |
|---|---|
| Valid-format, checksum-failed GSTIN | never VERIFIED |
| Single-source OCR extraction | consensus = SINGLE_SOURCE (never STRONG); authority stays REQUIRES_AUTHORIZATION |
| All registry APIs UNAVAILABLE | overall ≠ VERIFIED, authority = NOT_AVAILABLE |
| QR conflicts OCR text | CONFLICTING_EVIDENCE + HUMAN_REVIEW |
| Altered PDF | HUMAN_REVIEW triage; L1 withheld |

### RAG retrieval
- "GSTIN checksum structure verification portal" → top hit is a **TIER 1** government-domain chunk; ordering respects tier weighting.

## Known gaps / next measurements
- OCR field-level accuracy requires raster ground-truth fixtures (planned: generated PNG certificates with known values).
- p95 latency needs load harness against staging Supabase; current numbers are single-shot CPU timings.
- Splink sidecar calibration (probability bands) pending adoption decision above ~50k documents.
