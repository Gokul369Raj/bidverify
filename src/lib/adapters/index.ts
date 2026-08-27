/**
 * Open-source adapter layer.
 *
 * Third-party engines (Docling, PaddleOCR, Splink sidecar, pgvector…) are never
 * hard-coded into business logic. Each capability is an interface with:
 *   - a local in-repo default adapter (always available)
 *   - optional external adapters that PROBE for availability and report
 *     `available:false` gracefully (never fake results).
 *
 * Selection principle per OPEN_SOURCE_TECHNOLOGY_EVALUATION.md:
 * minimum necessary set; external engines activate only when configured.
 */

// ─────────────────────────── Contracts ───────────────────────────

export interface ParsedDocument {
  textLayer?: string;
  pages?: number;
  tables?: { page: number; rows: string[][] }[];
  confidence: number;
  engine: string;
}

export interface DocumentParser {
  readonly name: string;
  available(): Promise<boolean>;
  parse(buffer: Buffer, fileName: string): Promise<ParsedDocument>;
}

export interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
  fields?: Record<string, { value: string; confidence: number }>;
}

export interface OCRProvider {
  readonly name: string;
  available(): Promise<boolean>;
  /** priority: lower runs first as primary parser */
  readonly priority: number;
  recognize(buffer: Buffer): Promise<OcrResult>;
}

export interface ForensicAnalysis {
  tamperSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  signals: { code: string; severity: string; detail: string }[];
  metadata: Record<string, unknown>;
  engine: string;
}

export interface ForensicAnalyzer {
  readonly name: string;
  analyze(buffer: Buffer): Promise<ForensicAnalysis>;
}

export interface LinkageCandidatePair {
  leftId: string;
  rightId: string;
  left: Record<string, string | null>;
  right: Record<string, string | null>;
}

export interface LinkageDecision {
  leftId: string;
  rightId: string;
  logOdds: number;
  probability: number;
  level: "AUTO_MATCH" | "PROBABLE_MATCH" | "REVIEW_REQUIRED" | "NON_MATCH";
  comparisonVector: { agreement: string; weight: number }[];
}

export interface EntityResolver {
  readonly name: string;
  score(pairs: LinkageCandidatePair[]): Promise<LinkageDecision[]>;
}

export interface EmbeddingProvider {
  readonly name: string;
  available(): Promise<boolean>;
  embed(texts: string[]): Promise<number[][]>;
}

export interface VectorStore {
  readonly name: string;
  upsert(id: string, vector: number[], meta: Record<string, unknown>): Promise<void>;
  search(vector: number[], k: number): Promise<{ id: string; score: number }[]>;
}

export interface Reranker {
  readonly name: string;
  rerank(query: string, candidates: { id: string; text: string }[]): Promise<{ id: string; score: number }[]>;
}

// ─────────────────── Local (always-available) implementations ───────────────────

import { analyzePdf, maxSignalSeverity } from "@/lib/verify/pdfForensics";

class LocalForensicAnalyzer implements ForensicAnalyzer {
  readonly name = "local-pdf-forensics";
  async analyze(buffer: Buffer) {
    const f = buffer.subarray(0, 4).toString("latin1") === "%PDF"
      ? analyzePdf(buffer)
      : undefined;
    if (!f) {
      return { tamperSeverity: "NONE" as const, signals: [], metadata: {}, engine: this.name };
    }
    return {
      tamperSeverity: maxSignalSeverity(f.signals),
      signals: f.signals,
      metadata: {
        version: f.version, pageCount: f.pageCount, producer: f.producer,
        creationDate: f.creationDate, modDate: f.modDate,
        incrementalUpdates: f.incrementalUpdates, encrypted: f.encrypted,
      },
      engine: this.name,
    };
  }
}

// ─────────────────── External adapters (probe-gated) ───────────────────

async function probeCommand(cmd: string, args: string[]): Promise<boolean> {
  try {
    const { spawn } = await import("child_process");
    return await new Promise<boolean>((resolve) => {
      const p = spawn(cmd, args, { stdio: "ignore" });
      p.on("error", () => resolve(false));
      p.on("close", () => resolve(true));
      setTimeout(() => { p.kill(); resolve(false); }, 4000);
    });
  } catch {
    return false;
  }
}

/** Docling CLI/HTTP adapter — activates when the binary/service is present. */
class DoclingParser implements DocumentParser {
  readonly name = "docling";
  private endpoint = process.env.DOCLING_URL;
  async available(): Promise<boolean> {
    if (this.endpoint) {
      try {
        const res = await fetch(`${this.endpoint.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2500) });
        return res.ok;
      } catch { return false; }
    }
    return probeCommand("docling", ["--version"]);
  }
  async parse(buffer: Buffer, fileName: string): Promise<ParsedDocument> {
    // Contract: POST multipart to Docling serve, or exec CLI to JSON stdout.
    if (!this.endpoint) throw new Error("DOCLING_URL not configured");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)]), fileName);
    const res = await fetch(`${this.endpoint.replace(/\/$/, "")}/v1/convert`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`docling failed ${res.status}`);
    const json = (await res.json()) as { text?: string; pages?: number; tables?: ParsedDocument["tables"] };
    return {
      textLayer: json.text ?? "",
      pages: json.pages,
      tables: json.tables,
      confidence: 0.9,
      engine: this.name,
    };
  }
}

/** PaddleOCR service adapter — secondary OCR in the ensemble. */
class PaddleOCRProvider implements OCRProvider {
  readonly name = "paddleocr";
  readonly priority = 20; // secondary
  private endpoint = process.env.PADDLE_OCR_URL;
  async available(): Promise<boolean> {
    if (!this.endpoint) return false;
    try {
      const res = await fetch(`${this.endpoint.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2500) });
      return res.ok;
    } catch { return false; }
  }
  async recognize(buffer: Buffer): Promise<OcrResult> {
    const res = await fetch(`${this.endpoint!.replace(/\/$/, "")}/v1/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`paddleocr failed ${res.status}`);
    const j = (await res.json()) as { text?: string; confidence?: number };
    return { text: j.text ?? "", confidence: j.confidence ?? 0.7, engine: this.name };
  }
}

/**
 * Splink sidecar contract (Fellegi–Sunter at scale). When SPLINK_URL is set,
 * linkage decisions delegate there; otherwise callers use the in-repo FS-lite
 * scorer which mirrors its comparison-vector semantics conservatively.
 */
class SplinkResolver implements EntityResolver {
  readonly name = "splink-sidecar";
  private endpoint = process.env.SPLINK_URL;
  async available(): Promise<boolean> {
    if (!this.endpoint) return false;
    try {
      const r = await fetch(`${this.endpoint!.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(2500) });
      return r.ok;
    } catch { return false; }
  }
  async score(pairs: LinkageCandidatePair[]): Promise<LinkageDecision[]> {
    const res = await fetch(`${this.endpoint!.replace(/\/$/, "")}/v1/link`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs }),
    });
    if (!res.ok) throw new Error(`splink failed ${res.status}`);
    return (await res.json()).decisions as LinkageDecision[];
  }
}

// ─────────────────── Registry ───────────────────────────

export const adapters = {
  parsers: {
    docling: new DoclingParser(),
  },
  ocr: {
    paddleocr: new PaddleOCRProvider(),
  },
  forensics: {
    local: new LocalForensicAnalyzer(),
  },
  entityResolution: {
    splink: new SplinkResolver(),
  },
};

/** Resolve the best available parser chain: external first, graceful fallback marker last. */
export async function resolveParserChain(): Promise<DocumentParser[]> {
  const chain: DocumentParser[] = [];
  if (await adapters.parsers.docling.available()) chain.push(adapters.parsers.docling);
  return chain; // empty ⇒ ensemble uses built-in extraction only
}
