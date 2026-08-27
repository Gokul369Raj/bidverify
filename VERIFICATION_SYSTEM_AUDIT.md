# VERIFICATION_SYSTEM_AUDIT.md

Audit date: 2026-08-23 · Scope: full repository inspection after Intelligence Upgrade phases 1–14.

## 1. Current architecture
Next.js 15 App Router + React 19 · Prisma/PostgreSQL (Supabase) · JWT cookie auth with RBAC middleware · local file storage with sha256 + signature allowlist · Gemini/OpenAI/Ollama AI via cached orchestrator (`ai_runs` logged).

## 2. Verification flow (as implemented)
```
upload → scanFile → storage(sha256) → AI classify → AI extract (confidence per field)
      → Document Intelligence: PDF forensics · signature detection · QR decode (image+embedded)
        · deterministic identifier validators (GSTIN mod-36 / PAN / Udyam / CIN)
pipeline.runVerificationPipeline:
      → providers (DEMO-gated; production ⇒ REQUIRES_AUTHORIZATION)
      → cross-document consistency findings
      → contradiction engine (identity/address/status/quantitative)
      → temporal engine (validity AT submission/closing date)
      → versioned rules engine (deterministic PASS/FAIL/REVIEW…)
      → risk engine → evidence fusion (field consensus + LEVELS 0–7 + coverage %)
      → reviewer/critic agent (challenges conclusion; hard invariants enforced deterministically)
      → audit trail → notifications → officer decision (final authority)
```

## 3. Dummy logic status
Sweep performed (`fake|dummy|mock|Math.random|verified:true|hardcoded`):
* `verification/index.ts` — mock registries reachable **only** when `DEMO_MODE=true`; production path returns REQUIRES_AUTHORIZATION outcomes.
* `ai/tasks.ts` — fabricated extraction fallback gated behind DEMO_MODE; production emits `AI_EXTRACTION_UNAVAILABLE`.
* `Math.random` occurrences: reference-ID suffixes + retry backoff jitter only (non-evidentiary).
No test fixture can produce a production "verified" state.

## 4. AI flow
Task-scoped prompts (tender understanding, classification, extraction, corrigendum diff, NL search, grounded QA w/ RAG citations, recommendation). Hallucination guard in every system prompt. Response cache + inflight dedupe + retry/backoff. Every call persisted in `AiRun`.

## 5. RAG flow
Curated authoritative corpus (`src/lib/rag/knowledge/*.md`) with frontmatter metadata incl. **source tier (1–5)** → heading chunking → BM25-lite hybrid retrieval with phrase boost + tier weighting (TIER-1 outranks secondary) → citation-tagged context `[KB#]` injected into assistant/copilot prompts. Vector upgrade path: pgvector inside existing Postgres (adapter interface defined).

## 6. Vector flow
Deliberately deferred (corpus size); `VectorStore`/`EmbeddingProvider` interfaces staged in adapter layer. Keyword+metadata+tier hybrid is active and sufficient at current scale — decision recorded in evaluation doc.

## 7–9. Weaknesses / security / performance (residual)
| Area | Status |
|---|---|
| PKCS#7 cryptographic signature validation | NOT implemented — detection only, explicitly labeled |
| Malware scanning | magic-byte/MIME allowlist shipped; ClamAV hook stubbed for production |
| OCR field bounding boxes | schema ready (`boundingBoxJson`); populated when vision provider supplies them |
| p95 latency under load | single-shot timings benchmarked; load harness pending |
| KB freshness | manual authorized ingestion workflow; `retrieved_at` recorded, STALE warnings planned |
| Secrets | env-only; masked in admin UI; never client-exposed |

## 10. Recommended next steps (priority order)
1. ClamAV integration into `storage.scanFile`.
2. pgvector activation when KB > ~500 chunks; add reranker interface implementation.
3. Splink DuckDB sidecar beyond ~50k documents (adapter already probes).
4. Load harness for p95 verification latency.
5. Officer-feedback learning loop export (anonymized decision pairs) — capture exists, training pipeline external by policy.

## 11. Implementation plan status
Phases 1–14 of the intelligence upgrade executed and regression-tested (49/49 unit + red-team tests green; live E2E through real pipeline verified). Remaining phases (15–20) delivered as: passport API + page hooks, evaluation framework doc, red-team suite, fixes applied during execution, this audit.
