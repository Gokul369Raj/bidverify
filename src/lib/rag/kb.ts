import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * Lightweight RAG knowledge base over curated authoritative documents.
 *
 * Design constraints honored here:
 *  - Every chunk retains source metadata (official_domain, title, retrieved_at).
 *  - Retrieval = hybrid keyword scoring (BM25-lite) with exact-phrase boost.
 *    Vector embeddings are an OPTIONAL enhancement (wired where a provider is
 *    configured); statutory decisions never rely on similarity alone.
 *  - The corpus is curated offline. No automated crawling: re-ingestion is a
 *    manual, authorized workflow that preserves prior versions for audit.
 */

export interface KbChunk {
  id: string;
  text: string;
  tokens: string[];
  meta: {
    source: string;
    official_domain: string;
    document_title: string;
    effective_date?: string;
    jurisdiction?: string;
    retrieved_at?: string;
    section: string;
    /** 1 = primary gov source … 5 = secondary. Higher tiers outrank lower. */
    tier: number;
  };
}

export interface RetrievedChunk extends KbChunk {
  score: number;
}

const KB_DIR = path.join(process.cwd(), "src", "lib", "rag", "knowledge");
const STOPWORDS = new Set(["the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "is", "are", "be", "with", "as", "by", "that", "this", "it", "from", "must", "may"]);

let cache: { chunks: KbChunk[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.\-/]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const meta: Record<string, string> = {};
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
      if (kv) meta[kv[1]] = kv[2].replace(/^"|"$/g, "");
    }
  }
  return { meta, body: raw.slice(m ? m[0].length : 0) };
}

async function loadCorpus(): Promise<KbChunk[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.chunks;
  let files: string[] = [];
  try {
    files = (await fs.readdir(KB_DIR)).filter((f) => f.endsWith(".md"));
  } catch {
    cache = { chunks: [], loadedAt: Date.now() };
    return [];
  }
  const chunks: KbChunk[] = [];
  for (const f of files.sort()) {
    const raw = await fs.readFile(path.join(KB_DIR, f), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    // chunk by ## sections; preamble becomes its own chunk
    const parts = body.split(/\n(?=## )/g);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length < 60) continue;
      const heading = /^##\s+(.+)$/m.exec(trimmed)?.[1] ?? "Overview";
      chunks.push({
        id: crypto.createHash("sha1").update(f + heading).digest("hex").slice(0, 12),
        text: trimmed,
        tokens: tokenize(trimmed),
        meta: {
          source: meta.source ?? f,
          official_domain: meta.official_domain ?? "",
          document_title: meta.document_title ?? f,
          effective_date: meta.effective_date || undefined,
          jurisdiction: meta.jurisdiction || undefined,
          retrieved_at: meta.retrieved_at || undefined,
          section: heading,
          tier: parseInt(meta.tier ?? "4", 10) || 4,
        },
      });
    }
  }
  cache = { chunks, loadedAt: Date.now() };
  return chunks;
}

/** BM25-lite hybrid retrieval with phrase boost and domain filter. */
export async function retrieve(query: string, k = 4, opts?: { officialDomainContains?: string }): Promise<RetrievedChunk[]> {
  const chunks = await loadCorpus();
  if (!chunks.length) return [];

  const qTokens = tokenize(query);
  const N = chunks.length;
  const df = new Map<string, number>();
  for (const c of chunks) {
    const seen = new Set(c.tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const avgLen = chunks.reduce((a, c) => a + c.tokens.length, 0) / N;
  const k1 = 1.4;
  const b = 0.72;
  const qLower = query.toLowerCase();

  const scored: RetrievedChunk[] = chunks
    .filter((c) => !opts?.officialDomainContains || c.meta.official_domain.includes(opts.officialDomainContains))
    .map((c) => {
      let score = 0;
      const tfMap = new Map<string, number>();
      for (const t of c.tokens) tfMap.set(t, (tfMap.get(t) ?? 0) + 1);
      for (const t of new Set(qTokens)) {
        const f = tfMap.get(t) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (c.tokens.length / avgLen))));
      }
      if (qLower.length > 12 && c.text.toLowerCase().includes(qLower.slice(0, 40))) score += 3; // phrase boost
      // Source-tier weighting (TIER 1 strongest). Applied multiplicatively so a
      // secondary source cannot override an authoritative one at equal relevance.
      const tierBoost = { 1: 1.6, 2: 1.35, 3: 1.15, 4: 1.0, 5: 0.8 } as Record<number, number>;
      score *= tierBoost[c.meta.tier] ?? 1;
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b2) => b2.score - a.score);

  return scored.slice(0, k);
}

/** Format retrieved chunks as a bounded, citation-tagged context block. */
export function formatKbContext(retrieved: RetrievedChunk[], maxChars = 3600): string {
  let out = "";
  for (const [i, r] of retrieved.entries()) {
    const header = `[KB${i + 1}] ${r.meta.document_title} — ${r.meta.section} (source: ${r.meta.official_domain || r.meta.source}${r.meta.retrieved_at ? `, retrieved ${r.meta.retrieved_at}` : ""})`;
    const block = `${header}\n${r.text.replace(/\s+\n/g, "\n").slice(0, 900)}\n\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out.trim();
}
