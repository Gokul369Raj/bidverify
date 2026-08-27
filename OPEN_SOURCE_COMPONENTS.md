# OPEN_SOURCE_COMPONENTS.md

Runtime + build dependencies with license obligations. Regenerate versions via `npm ls`.

| Project | Version | License | Purpose | Repository | Changes made | Obligations |
|---|---|---|---|---|---|---|
| Next.js | 15.5.x | MIT | App framework | vercel/next.js | none | include license notice |
| React / ReactDOM | 19.x | MIT | UI runtime | facebook/react | none | include notice |
| Prisma ORM + client | 6.x | Apache-2.0 | DB access/queries | prisma/prisma | schema authored by us | notice; engine binaries per Prisma EULA |
| jose | 6.x | MIT | JWT sign/verify (sessions) | panva/jose | none | notice |
| zod | 4.x | MIT | API input validation | colinhacks/zod | none | notice |
| bcryptjs | 3.x | MIT | password hashing | dcodeIO/bcryptjs | none | notice |
| lucide-react | latest | ISC | icon set | lucide-icons/lucide | none | notice |
| tailwindcss | 4.x | MIT | styling | tailwindlabs/tailwindcss | design tokens authored by us | notice |
| jsQR | 1.4.0 | Apache-2.0 | QR decode from rasters | cozmo/jsQR | none | NOTICE + attribution retained in dist |
| jpeg-js | 0.4.4 | BSD-3-Clause | JPEG decode for QR pipeline | jpeg-js/jpeg-js | none | notice; no names endorsement |
| pngjs | 7.0.0 | MIT | PNG decode for QR pipeline | lukeapage/pngjs | none | notice |
| @types/pngjs | dev | MIT | types | DefinitlyTyped | none | notice |
| vitest (+ esbuild et al.) | 4.x | MIT | test runner | vitest-dev/vitest | none | notice |
| eslint ecosystem | 9.x | MIT | linting | eslint/eslint | config authored by us | notice |

## Curated-content provenance (not code)
`src/lib/rag/knowledge/*.md` — original summaries written from public government documentation (gst.gov.in, udyamregistration.gov.in, incometax.gov.in, mca.gov.in, gem.gov.in/dpiit.gov.in). Each file carries source metadata incl. retrieval date; content is paraphrased procedure notes, not copied text.

## Deliberately NOT bundled (license risk)
AGPL-3.0: MinerU, PyMuPDF, PDF-Extract-Kit · OpenRAIL-M weight clauses: Marker 2, Surya, Chandra 2 · Any scraping tooling for restricted portals.

## Planned adoptions (when activated)
Docling — MIT/Apache-2.0 (adapter `src/lib/adapters/docling.ts`) · Splink sidecar — MIT (DuckDB backend) · PaddleOCR service — Apache-2.0 · pgvector — PostgreSQL License.
