# VERIFICATION_AUDIT.md — BidVerify AI (Absar)

Last audited: 2026-08-23 · Auditor: Engineering session (automated repo inspection)

## 1. Current Architecture

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, React 19, Tailwind 4 |
| Backend | Next.js Route Handlers (`src/app/api/**`) |
| DB | PostgreSQL (Supabase) via Prisma ORM (`prisma/schema.prisma`) |
| Auth | JWT (jose) httpOnly cookie + middleware + per-route role checks |
| Files | Local storage adapter `src/lib/storage.ts` (hashed paths, sha256) |
| AI | Gemini (primary) / OpenAI / Ollama via `src/lib/ai/orchestrator.ts`; every call logged in `AiRun` |
| Rules | Versioned `ComplianceRule` rows evaluated deterministically in `src/lib/engine/rules.ts` |
| Risk | Deterministic additive model `src/lib/engine/analysis.ts` |

### Document pipeline today
```
upload → scanFile (magic-byte/MIME allowlist) → storage.save (sha256)
      → processBidDocument: AI classify → AI extract fields → ExtractedField rows
pipeline.runVerificationPipeline:
      → verification providers (mock registries) → anomalies → rules engine
      → risk + score → AI recommendation → notifications → audit
```

## 2. Dummy / Mock Verification Locations (to gate or replace)

| # | Location | What is faked | Action |
|---|---|---|---|
| M1 | `src/lib/ai/tasks.ts` → `simulateDocFields()` | Fabricates certificate field values from org profile | Gate behind `DEMO_MODE=true` only; otherwise return extraction-failure evidence |
| M2 | `src/lib/verification/index.ts` → `lookupMock("GST"/"PAN"/…)` | Fake government registries seeded by `prisma/seed.ts` (`MockRegistry`) | Gate behind `DEMO_MODE=true`; production path returns `UNAVAILABLE`/`REQUIRES_AUTHORIZATION` honestly |
| M3 | `prisma/seed.ts` mock registries incl. deliberate mismatch fixture | Synthetic backend records | Retained **only** as test fixtures consumed exclusively in demo mode |
| M4 | `refId()` prefix `SIM-` | Reference IDs imply simulation | Keep prefix only on genuinely simulated results |
| M5 | Landing/dashboard “Demo” badges | Honest labels for seeded tenders | Kept (truthful labeling, not fake success) |

Searches performed: `Math.random`, `simulated`, `mock`, `dummy`, `verified: true` — all occurrences accounted for above or benign (retry jitter, PRNG seeding inside gated demo code).

## 3. Existing Real Capabilities (keep & build on)

* File-signature validation, MIME allowlist, size caps (`storage.scanFile`)
* SHA-256 duplicate detection (same hash ⇒ DUPLICATE_DOCUMENT anomaly)
* Deterministic rules engine with weights/versioning/override trail
* Entity resolution: name normalization + Sørensen–Dice bigrams + identifier-conflict override (`engine/entity.ts`)
* Expired-certificate detection, turnover conflict detection
* Append-only style AuditLog with before/after JSON
* Officer decision + override persistence (ComplianceResult.override*)

## 4. Missing Capabilities (implemented in this change)

1. **Document forensics** — PDF structural analysis (encryption, incremental updates, embedded JS/Launch/OpenAction, attached files, image-vs-text composition, producer metadata).
2. **Digital signature detection** — `/Sig`, `/ByteRange`, SubFilter identification (detection ≠ cryptographic validation; reported honestly).
3. **QR/barcode decoding** — pure-JS decode of QR codes found in uploaded PNG/JPG and in DCTDecode/FlateDecode images embedded in PDFs; payload parsed and cross-checked against visible extracted fields (e.g., Udyam dynamic QR, GST QR where present).
4. **Cryptographic identifier validation** — GSTIN mod-36 checksum + state code + PAN-in-GSTIN linkage; PAN structure/entity-type; Udyam/CIN/EPF structure validators.
5. **Cross-document consistency engine** — PAN↔GSTIN-PAN-segment, legal-name variants across documents, state-code coherence, producing severity-rated findings.
6. **Evidence-first status model** — `VERIFIED / PARTIALLY_VERIFIED / MISMATCH / NOT_FOUND / UNAVAILABLE / REQUIRES_AUTHORIZATION / MANUAL_REVIEW / EXPIRED / NOT_APPLICABLE`, each with checks performed, limitations, authority (MODEL vs SOURCE), never conflating model confidence with verification authority.
7. **API-less mode** — full scoring possible from documentary+forensic+consistency evidence with explicit “official real-time verification unavailable” disclosure.
8. **RAG layer** — curated authoritative knowledge base (`src/lib/rag/knowledge/**`) with source metadata, chunking, hybrid BM25-style keyword retrieval (+ optional Gemini embeddings when configured), used by assistant/copilot with citations; LLM blocked from policy answers without retrieved context.
9. **Provider adapter contract** — uniform states incl. `REQUIRES_AUTHORIZATION`, `SOURCE_OUTDATED`; unknown/unavailable never converted to pass/fail.

## 5. Risks Identified Pre-Change

* Demo registry results previously flowed into compliance score indistinguishably from real verification (severity: HIGH) — now hard-gated and labeled.
* OCR output was implicitly trusted (no confidence-aware downstream use) — now surfaced with per-field confidence and validator cross-checks.
* No prompt-injection boundary language on document-content AI calls — hardened system prompts added.

## 6. Implementation Plan (executed)

1. Install pure-JS deps: `jsqr`, `jpeg-js`, `pngjs` (no native builds).
2. `src/lib/verify/identifiers.ts` — checksum-grade validators (+ vitest suite).
3. `src/lib/verify/pdfForensics.ts` — structural analyzer (+ vitest suite with synthetic PDFs).
4. `src/lib/verify/signatures.ts` — signature detection with explicit authority limits.
5. `src/lib/verify/qr.ts` — decode from raster images and PDF-embedded images; payload parsers (Udyam/GST patterns); consistency verdicts.
6. `src/lib/verify/index.ts` — orchestrates 3–5 over stored bytes; persists results as `ExtractedField` rows with `source = FORENSICS | QR | SIGNATURE | VALIDATOR` (zero-migration persistence).
7. `src/lib/engine/consistency.ts` — cross-document findings feeding anomalies/rules.
8. Provider honesty refactor + `DEMO_MODE` gating in `verification/*` and `ai/tasks.ts`.
9. Anomaly/rule integration: `QR_MISMATCH`, `TAMPER_SIGNALS_{LOW,MEDIUM,HIGH}`, `IDENTIFIER_INVALID` feed risk; tamper-HIGH forces MANUAL_REVIEW language.
10. RAG: `src/lib/rag/{kb.ts, knowledge/*.md}` + retriever wired into assistant/copilot prompts with citation list.
11. UI: officer verification detail gains “Document Intelligence” evidence panel (QR payload, tamper signals, signature status, validator results).
12. Vitest suites for identifiers, forensics, entity matching, consistency, rules-expiry; full suite green.

## 7. Known Limitations (post-change)

* Cryptographic PKCS#7 signature *validation* not implemented (detection only) — requires node-forge/openssl-class work later.
* QR decode depends on extractable raster images; vector-only or heavily compressed scans may yield NO_QR_FOUND (reported, never guessed).
* Official portal live checks remain authorization-gated; adapters expose exact integration points (see README section “Future integration points”).
* RAG corpus is curated-offline; automated re-crawl intentionally NOT implemented (legal/robots constraints) — manual authorized ingestion workflow documented instead.
