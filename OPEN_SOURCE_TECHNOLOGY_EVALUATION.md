# OPEN_SOURCE_TECHNOLOGY_EVALUATION.md

Evaluated: 2026-08 · Method: live repository/package research + published benchmarks + in-repo synthetic benchmarks (`tests/benchmark.test.ts`). Selection criterion: production maturity × license safety × integration cost vs. measurable gain — **not** GitHub stars.

## Decision Summary

| Candidate | Verdict | Integration path |
|---|---|---|
| Splink | **ADOPT (phased)** | Sidecar service via DuckDB backend; TS-side Fellegi–Sunter-lite implemented now (`engine/entityLinkage.ts`) with identical evidence semantics |
| Docling | **ADOPT (adapter ready)** | `adapters/docling.ts` CLI/service adapter; auto-detected when binary present |
| PaddleOCR | **ADAPTER READY** | `adapters/paddleOcr.ts` service adapter; secondary parser in ensemble when configured |
| MinerU / PDF-Extract-Kit | REJECT | AGPL-3.0 contamination risk for this distribution |
| Marker 2 / Surya / Chandra | REJECT (now) | Model weights under OpenRAIL-M revenue clauses — legal review required before adoption |
| dedupe (python) | REJECT (now) | Active-learning workflow doesn't fit serverless route handlers; Splink covers need |
| pdf.js / PyMuPDF | REJECT PyMuPDF (AGPL); pdf.js unnecessary | Node zlib-based analyzer already shipped covers forensic needs |
| jsQR + jpeg-js + pngjs | **SHIPPED (previous iteration)** | Pure-JS QR pipeline — Apache-2.0/BSD/MIT |
| Qdrant/pgvector | DEFER | KB is small & curated; BM25-lite hybrid meets accuracy needs. pgvector natural upgrade inside existing Postgres |

---

## Detailed Evaluations

### 1. Splink — probabilistic record linkage
```text
Project            Splink
Repository         github.com/moj-analytical-services/splink
License            MIT
Last activity      Active (v4.0.16, Mar 2026; v5 dev line)
Maintenance        Excellent — UK MoJ backed, 10.8k commits
Security           No known advisories; pure-Python + SQL backends
Documentation      Excellent (mkdocs, interactive diagnostics)
Maturity           Production at national scale (MoJ, ABS census spine, EMA)
Performance        ~1M records/laptop-minute on DuckDB; Spark/Athena for 100M+
CPU/GPU            CPU only
Language           Python (SQL execution)
Integration diff   Medium — sidecar process or scheduled job; no WASM build
Privacy            Fully local; data never leaves deployment
Community          Large, gov/academia
Limitations        Structured columns needed (fits us); not a realtime API
```
**Why relevant:** bidder identity across GST/PAN/Udyam/MCA must resolve probabilistically with *explainable* match weights, exactly Fellegi–Sunter.
**Current alternative in project:** `engine/entity.ts` Dice-bigram similarity + identifier override — deterministic but ad-hoc weights.
**Benchmark result:** see `BENCHMARKS.md` §entity — our FS-lite achieves identical verdicts on the adversarial fixture set; Splink adoption adds calibrated probabilities + clustering at scale.
**Recommendation:** adopt via DuckDB sidecar when corpus >~50k docs; until then the in-repo FS-lite scorer (same comparison-vector semantics, conservative thresholds, human-review band) is active. Fuzzy similarity alone NEVER merges identities (identifier agreement required).

### 2. Docling — layout-aware document parsing
```text
Project            Docling (IBM Research / LF AI & Data)
Repository         github.com/docling-project/docling
License            MIT (code); Apache-2.0 model weights
Activity/Maint.    Very active; Linux Foundation governance
Security           Local execution, air-gapped capable
Docs/Maturity      Strong; production-grade, LlamaIndex/Haystack integrations
Performance        ~8s/12pp CPU in third-party runs; ~1.3 p/s sustained CPU
CPU/GPU            CPU sufficient; GPU optional
Language           Python CLI/library
Integration diff   Low-medium — CLI/HTTP sidecar; typed JSON output maps cleanly to our ExtractedField contract
Privacy            100% local — sensitive certificates never leave infra
Limitations        Table internals partially lossy; handwriting weak
```
**Why relevant:** replaces heuristic PDF text handling with reading-order-aware structure (tables in turnover proofs, multi-column certificates).
**Current alternative:** Gemini-vision extraction (cloud, only when configured) + raw-zlib text-layer sniffing (local, shallow).
**Benchmark result:** `BENCHMARKS.md` §parsing — on synthetic GST/Udyam fixtures our local extractor returns correct identifiers via text layer in <40ms/doc; Docling's gain is *layout tables* which our fixtures don't stress yet.
**Recommendation:** ADOPT behind `DocumentParser` adapter — ensemble primary when installed; confidence-gated fallback chain already enforced by the fusion engine. Zero hard dependency today.

### 3. PaddleOCR — OCR engine
```text
Project            PaddleOCR 3.x (PP-OCRv5 / PP-StructureV3)
Repository         github.com/PaddlePaddle/PaddleOCR
License            Apache-2.0
Activity/Maint.    Very active (70k★, 2025 technical report)
Docs               Good; English weaker than Chinese
Maturity           Production; <100M-param models rival VLM accuracy
Perf/Cost          ~2–4 p/s CPU scan CER strong on degraded scans; GPU optional
Integration diff   Medium — Python runtime + Paddle framework
Privacy            Local
Limitations        Framework lock-in; post-processing verbosity
```
**Why relevant:** scanned/faxed government certificates are common; current cloud-vision OCR is config-gated.
**Recommendation:** ADAPTER-READY secondary OCR in the smart-ensemble path (`if primaryConfidence < 0.75 → secondary → consensus/manual`). Not bundled now (framework weight); adapter probes a configurable endpoint.

### 4–7. Forensic references (PDFRecon / PDF-Forensic / questio)
No single maintained library met the bar (activity/license). **Techniques extracted instead of code:** revision/incremental-update enumeration, metadata-evolution deltas, font-set discontinuity, hidden-text overlay detection, action/script inventory, explicit "heuristic score ≠ legal verdict" framing. All implemented natively in `verify/pdfForensics.ts` (+ incremental updates, JS/Launch/OpenAction, embedded files, scan-only detection, mod-date deltas) with officer-review language preserved.

### 8. Vector store / reranker
Qdrant excellent (Apache-2.0) but redundant at current KB size (~dozens of curated chunks). Chosen: hybrid BM25-lite + phrase boost + **source-tier weighting** (TIER 1 gov domains outrank everything; low tiers cannot override). Upgrade path documented: pgvector inside existing Supabase Postgres — no new infrastructure.

### 9. Rejected-by-design checklist
AGPL family (MinerU, PyMuPDF, PDF-Extract-Kit) — distribution contamination. OpenRAIL-M weight clauses (Marker/Surya/Chandra) — unresolved legal conditions. Cloud-dependent parsers (Zerox) — privacy mode violated.

## Minimum necessary set adopted
Ship now: native forensics + QR + signature + validators + FS-lite linkage + tiered RAG (all in-repo, zero new runtime deps).
Adapters staged: Docling (parser), PaddleOCR (secondary OCR), Splink sidecar (linkage), pgvector (store) — each activates on configuration probe, degrading safely to in-repo implementations otherwise.
