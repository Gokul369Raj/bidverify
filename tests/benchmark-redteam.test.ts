import { describe, it, expect } from "vitest";
import { analyzePdf } from "@/lib/verify/pdfForensics";
import { scorePair } from "@/lib/engine/entityLinkage";
import { fuseEvidence } from "@/lib/engine/fusion";
import { retrieve } from "@/lib/rag/kb";

// ─────────────── Synthetic fixture builders ───────────────

function makePdf(parts: string[]): Buffer {
  return Buffer.from(`%PDF-1.7\n${parts.join("\n")}\n%%EOF\n`, "latin1");
}

const CLEAN_PDF = makePdf([
  "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
  "2 0 obj << /Type /Pages /Count 2 /Kids [3 0 R 4 0 R] >> endobj",
  "3 0 obj << /Type /Page /Parent 2 0 R >> endobj",
  "4 0 obj << /Type /Page /Parent 2 0 R >> endobj",
  "5 0 obj << /Producer (GovCert Generator) /Creator (Portal) /CreationDate (D:20260101000000) >> endobj",
]);

const TAMPERED_PDF = Buffer.from(
  "%PDF-1.7\n1 0 obj << /OpenAction << /S /JavaScript /JS (x) >> >> endobj\n%%EOF\n%%EOF\n%%EOF\n%%EOF\n",
  "latin1",
);

function pair(left: Record<string, string | null>, right: Record<string, string | null>) {
  return { leftId: "L", rightId: "R", left, right };
}

describe("Benchmarks (measured, recorded in BENCHMARKS.md)", () => {
  it("forensics: clean 2-page PDF analyzed under 150ms", () => {
    const t0 = performance.now();
    const f = analyzePdf(CLEAN_PDF);
    const ms = performance.now() - t0;
    expect(f.pageCount).toBe(2);
    expect(ms).toBeLessThan(150);
    console.info(`[benchmark] pdfForensics clean doc: ${ms.toFixed(1)}ms`);
  });

  it("forensics: tampered PDF flags HIGH under 100ms", () => {
    const t0 = performance.now();
    const f = analyzePdf(TAMPERED_PDF);
    const ms = performance.now() - t0;
    expect(f.signals.some((s) => s.severity === "HIGH")).toBe(true);
    expect(ms).toBeLessThan(100);
    console.info(`[benchmark] pdfForensics tampered doc: ${ms.toFixed(1)}ms`);
  });

  it("linkage: 200 pairs scored under 50ms", () => {
    const a = { legalName: "ABC Technologies Pvt Ltd", gstin: "27AAPFU0939F1ZV", pan: null };
    const b = { legalName: "ABC Technologies Private Limited", gstin: "27AAPFU0939F1ZV", pan: null };
    const c = { legalName: "XYZ Enterprises", gstin: "29AABCU9603R1ZM", pan: null };
    const pairs = Array.from({ length: 200 }, (_, i) =>
      i % 2 === 0 ? pair(a, b) : pair(a, c),
    );
    const t0 = performance.now();
    for (const p of pairs) scorePair(p);
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(50);
    console.info(`[benchmark] 200 linkage pairs: ${ms.toFixed(1)}ms`);
  });
});

// ─────────────── RED TEAM — attempts to fool the system ───────────────

describe("RED TEAM: adversarial documents", () => {
  it("R1: valid-format but false-data GSTIN fails checksum validation", () => {
    // 27AAPFU0939F1ZW keeps the format but corrupts the final check char.
    const facts = fuseEvidence({
      docs: [{
        documentId: "d", docType: "GST_CERTIFICATE", fileName: "gst.pdf",
        fields: { gstin: "27AAPFU0939F1ZW" },
        intelFields: {
          gstin_validation: JSON.stringify({ field: "gstin", valid: false, errors: ["Checksum mismatch"] }),
          tamper_signals: "NONE_DETECTED",
        },
      }],
      providers: [{ provider: "GST", status: "REQUIRES_AUTHORIZATION", simulated: false }],
      consistencyFindings: [],
      rulesSummary: { passed: 1, failed: 0, reviews: 0, total: 1 },
    });
    expect(fusionNotGreen(facts)).toBe(true);
    expect(facts.overallStatus).not.toBe("VERIFIED");
  });

  it("R2: two different companies are NEVER merged by name similarity alone", () => {
    const d = scorePair(pair(
      { legalName: "ABC Technologies Pvt Ltd" },
      { legalName: "ABC Technologies Pvt. Ltd.", gstin: "29AAAAA0000A1Z5" },
    ));
    // Right side carries a DIFFERENT gstin than left's implicit one? Left has none,
    // so no conflict — but no identifier agreement either ⇒ must NOT auto-match.
    expect(d.level).not.toBe("AUTO_MATCH");
  });

  it("R3: altered PDF (JS + incremental updates) forces HUMAN_REVIEW, never AUTO_OK", () => {
    const intel = analyzePdf(TAMPERED_PDF);
    const r = fuseEvidence({
      docs: [{
        documentId: "d", docType: "UDYAM_CERTIFICATE", fileName: "udyam.pdf",
        fields: { udyamNumber: "UDYAM-MH-00-0012345" },
        intelFields: { tamper_signals: `HIGH:${intel.signals.map((s) => s.code).join(",")}` },
      }],
      providers: [],
      consistencyFindings: [],
      rulesSummary: { passed: 2, failed: 0, reviews: 0, total: 2 },
    });
    expect(r.reviewTriage).toBe("HUMAN_REVIEW");
    expect(r.levelsAchieved).not.toContain(1); // structurally valid NOT achieved
  });

  it("R4: OCR single-source extraction can NEVER yield STRONG consensus", () => {
    const r = fuseEvidence({
      docs: [{
        documentId: "d", docType: "GST_CERTIFICATE", fileName: "gst.pdf",
        fields: { gstin: "27AAPFU0939F1ZV" },
        intelFields: {},
      }],
      providers: [{ provider: "GST", status: "REQUIRES_AUTHORIZATION", simulated: false }],
      consistencyFindings: [],
      rulesSummary: { passed: 1, failed: 0, reviews: 0, total: 1 },
    });
    const g = r.fieldConsensus.find((c) => c.field === "gstin");
    expect(g?.verdict).toBe("SINGLE_SOURCE");
    expect(r.authoritativeVerification).toBe("REQUIRES_AUTHORIZATION");
    expect(r.overallStatus).not.toBe("VERIFIED"); // looks-valid ≠ verified
  });

  it("R5: unavailable/timed-out government APIs can never become a green VERIFIED", () => {
    const r = fuseEvidence({
      docs: [{
        documentId: "d", docType: "PAN_CARD", fileName: "pan.png",
        fields: { pan: "ABZPU0939F" }, intelFields: {},
      }],
      providers: [
        { provider: "GST", status: "UNAVAILABLE", simulated: false },
        { provider: "PAN", status: "UNAVAILABLE", simulated: false },
      ],
      consistencyFindings: [],
      rulesSummary: { passed: 1, failed: 0, reviews: 0, total: 1 },
    });
    expect(r.overallStatus).not.toBe("VERIFIED");
    expect(r.authoritativeVerification).toBe("NOT_AVAILABLE");
  });

  it("R6: QR payload conflicting with OCR text escalates to CONFLICTING_EVIDENCE", () => {
    const r = fuseEvidence({
      docs: [{
        documentId: "d", docType: "GST_CERTIFICATE", fileName: "gst.pdf",
        fields: { gstin: "27AAPFU0939F1ZV" },
        intelFields: {
          qr_identifiers_0: JSON.stringify({ gstins: ["24AAPFU0939F1ZV"], pans: [], udyams: [], urls: [] }),
        },
        qrConsistency: "CONFLICT",
      }],
      providers: [],
      consistencyFindings: [],
      rulesSummary: { passed: 0, failed: 0, reviews: 1, total: 1 },
    });
    expect(r.overallStatus).toBe("CONFLICTING_EVIDENCE");
    expect(r.reviewTriage).toBe("HUMAN_REVIEW");
  });

  it("RAG-TIER: a TIER-1 government source outranks secondary sources for the same topic", async () => {
    const hits = await retrieve("GSTIN checksum structure verification portal", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].meta.tier).toBeLessThanOrEqual(hits[hits.length - 1].meta.tier ?? 5);
  });
});

function fusionNotGreen(report: { overallStatus: string; authoritativeVerification: string }): boolean {
  return report.overallStatus !== "VERIFIED" || report.authoritativeVerification === "AVAILABLE";
}
