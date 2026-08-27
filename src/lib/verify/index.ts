import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { analyzePdf, maxSignalSeverity, type PdfForensics } from "./pdfForensics";
import { detectPdfSignature, type SignatureInfo } from "./signatures";
import { scanForQrCodes, compareQrWithFields, type QrFinding, type QrConsistencyVerdict } from "./qr";
import { validateExtractedIdentifiers, type IdentifierValidation } from "./identifiers";

export * from "./pdfForensics";
export * from "./signatures";
export * from "./qr";
export * from "./identifiers";

/**
 * Document Intelligence orchestrator.
 *
 * Runs the API-INDEPENDENT evidence layers over one stored document:
 *   forensics → signature detection → QR decode → identifier validation
 * and persists every artifact as ExtractedField rows with dedicated sources
 * (FORENSICS | SIGNATURE | QR | VALIDATOR) so downstream rules/anomalies/UI can
 * consume them without schema changes.
 *
 * AUTHORITY: all outputs here are DOCUMENTARY evidence. They never constitute
 * official government verification on their own.
 */

export interface DocumentIntelligenceResult {
  documentId: string;
  docType: string;
  fileName: string;
  sha256: string;
  forensics?: PdfForensics;
  signature?: SignatureInfo;
  qr: { attempts: number; decoded: number; findings: QrFinding[] };
  qrConsistency?: QrConsistencyVerdict;
  validators: IdentifierValidation[];
  tamperSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  limitations: string[];
}

const INTEL_SOURCES = ["FORENSICS", "SIGNATURE", "QR", "VALIDATOR"];

function isJsonSafe(v: unknown): string {
  return JSON.stringify(v);
}

export async function runDocumentIntelligence(documentId: string): Promise<DocumentIntelligenceResult> {
  const doc = await prisma.bidDocument.findUnique({
    where: { id: documentId },
    include: { fields: true },
  });
  if (!doc) throw new Error("Document not found");

  const buffer = await storage.read(doc.storagePath);

  // ── Parallel independent analysis ──
  const ext = doc.fileName.toLowerCase().split(".").pop() ?? "";
  const looksPdf = ext === "pdf" || buffer.subarray(0, 4).toString("latin1") === "%PDF";
  const looksRaster = ["png", "jpg", "jpeg"].includes(ext);

  const forensics = looksPdf ? analyzePdf(buffer) : undefined;
  const signature = looksPdf ? await detectPdfSignature(buffer) : undefined;
  const qrFindings = looksPdf || looksRaster ? scanForQrCodes(doc.fileName, buffer) : [];

  // OCR-extracted field bag (excluding previous intelligence rows)
  const fields: Record<string, string> = {};
  for (const f of doc.fields) {
    if (!INTEL_SOURCES.includes(f.source) && f.value !== "NOT_FOUND_IN_SOURCE") fields[f.field] = f.value;
  }

  const validators = validateExtractedIdentifiers(fields);
  const qrConsistency = (looksPdf || looksRaster)
    ? compareQrWithFields(qrFindings, fields)
    : undefined;

  const forensicSignals = forensics?.signals ?? [];
  if (qrConsistency?.status === "CONFLICT") {
    forensicSignals.push({
      code: "QR_FIELD_CONFLICT",
      severity: "HIGH",
      detail: "Decoded QR payload conflicts with visible document fields — potential alteration or wrong-document upload. Officer review required.",
    });
  }
  const tamperSeverity = maxSignalSeverity(forensicSignals);

  // ── Persist artifacts (replace prior intelligence rows) ──
  await prisma.extractedField.deleteMany({ where: { documentId: doc.id, source: { in: INTEL_SOURCES } } });

  const rows: { field: string; value: string; source: string; confidence?: number }[] = [];
  if (forensics) {
    rows.push({ field: "forensics_report", value: isJsonSafe({ ...forensics, signals: forensicSignals }), source: "FORENSICS", confidence: 1 });
    rows.push({ field: "tamper_signals", value: tamperSeverity === "NONE" ? "NONE_DETECTED" : `${tamperSeverity}:${forensicSignals.map((s) => s.code).join(",")}`, source: "FORENSICS", confidence: 0.9 });
  }
  if (signature) rows.push({ field: "signature_status", value: isJsonSafe(signature), source: "SIGNATURE", confidence: 1 });
  for (const [i, q] of qrFindings.entries()) {
    if (q.found && q.payload) {
      rows.push({ field: `qr_payload_${i}`, value: q.payload.slice(0, 2000), source: "QR", confidence: 0.99 });
      if (q.identifiers) rows.push({ field: `qr_identifiers_${i}`, value: isJsonSafe(q.identifiers), source: "QR", confidence: 1 });
    }
  }
  if (qrFindings.length > 0 || qrConsistency) {
    rows.push({ field: "qr_consistency", value: isJsonSafe(qrConsistency ?? { status: "INCONCLUSIVE", details: [] }), source: "QR", confidence: 0.95 });
  }
  for (const v of validators) {
    rows.push({ field: `${v.field}_validation`, value: isJsonSafe(v), source: "VALIDATOR", confidence: v.confidence });
  }

  for (const r of rows) {
    await prisma.extractedField.create({
      data: {
        documentId: doc.id,
        field: r.field,
        value: r.value,
        page: null,
        confidence: r.confidence ?? null,
        source: r.source,
      },
    });
  }

  const limitations: string[] = [];
  if (signature?.limitation) limitations.push(signature.limitation);
  limitations.push("Forensic signals indicate structural characteristics only; they are not proof of alteration or authenticity.");
  if (qrConsistency?.status === "INCONCLUSIVE") limitations.push("No QR corroboration available for this document.");

  return {
    documentId: doc.id,
    docType: doc.docType,
    fileName: doc.fileName,
    sha256: doc.sha256,
    forensics,
    signature,
    qr: { attempts: qrFindings.length, decoded: qrFindings.filter((f) => f.found).length, findings: qrFindings },
    qrConsistency,
    validators,
    tamperSeverity,
    limitations,
  };
}

/** Read previously persisted intelligence for a document (no re-analysis). */
export function parseIntelligence(fields: { field: string; value: string; source: string }[]) {
  const get = <T>(name: string): T | undefined => {
    const row = fields.find((f) => f.field === name && f.source !== "AI");
    if (!row) return undefined;
    try { return JSON.parse(row.value) as T; } catch { return undefined; }
  };
  const tamperRow = fields.find((f) => f.field === "tamper_signals");
  return {
    forensics: get<ReturnType<typeof analyzePdf>>("forensics_report"),
    signature: get<SignatureInfo>("signature_status"),
    qrConsistency: get<QrConsistencyVerdict>("qr_consistency"),
    tamperSignals: tamperRow?.value ?? "NONE_DETECTED",
  };
}
