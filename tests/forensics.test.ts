import { describe, it, expect } from "vitest";
import { analyzePdf, maxSignalSeverity } from "@/lib/verify/pdfForensics";
import { detectPdfSignature } from "@/lib/verify/signatures";
import { compareQrWithFields, type QrFinding } from "@/lib/verify/qr";

function makePdf(parts: string[]): Buffer {
  const body = parts.join("\n");
  return Buffer.from(`%PDF-1.7\n${body}\n%%EOF\n`, "latin1");
}

describe("PDF forensics", () => {
  it("flags JavaScript and launch actions as HIGH", () => {
    const buf = makePdf([
      "1 0 obj << /Type /Catalog /OpenAction << /S /JavaScript /JS (app.launchURL\\('http://evil'\\);) >> >> endobj",
      "trailer << /Root 1 0 R >>",
      "startxref",
      "0",
      "%%EOF",
    ]);
    const f = analyzePdf(buf);
    expect(f.isPdf).toBe(true);
    expect(f.javascript).toBe(true);
    expect(f.signals.some((s) => s.code === "PDF_JAVASCRIPT" && s.severity === "HIGH")).toBe(true);
  });

  it("detects incremental updates via multiple %%EOF markers", () => {
    const buf = Buffer.from(
      "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n%%EOF\n%%EOF\n",
      "latin1",
    );
    const f = analyzePdf(buf);
    expect(f.incrementalUpdates).toBe(2);
    expect(f.signals.some((s) => s.code === "PDF_INCREMENTAL_UPDATES" && s.severity === "MEDIUM")).toBe(true);
  });

  it("reports scan-like documents (images, no text layer) as LOW", () => {
    const buf = Buffer.from(
      "%PDF-1.4\n5 0 obj << /Subtype /Image /Width 100 /Height 100 >> endobj\n%%EOF\n",
      "latin1",
    );
    const f = analyzePdf(buf);
    expect(f.imageCount).toBeGreaterThan(0);
    expect(f.textLayerDetected).toBe(false);
    expect(maxSignalSeverity(f.signals)).toBe("LOW");
  });

  it("returns isPdf=false for non-PDF input", () => {
    const f = analyzePdf(Buffer.from("GIF89a whatever"));
    expect(f.isPdf).toBe(false);
    expect(f.signals).toHaveLength(0);
  });
});

describe("Signature detection", () => {
  it("distinguishes detection from validation", async () => {
    const buf = makePdf([
      "1 0 obj << /ByteRange [0 840 960 320] /SubFilter /adbe.pkcs7.detached /SignerName (Test Signer) /M (D:20260101000000) >> endobj",
    ]);
    const sig = await detectPdfSignature(buf);
    expect(sig.status).toBe("SIGNATURE_INFO_PARTIAL");
    expect(sig.signerName).toBe("Test Signer");
    expect(sig.limitation).toMatch(/NOT performed/i);
    // The system must never claim cryptographic verification:
    expect(sig.status).not.toBe("VERIFIED");
  });

  it("returns NO_SIGNATURE_FOUND for unsigned PDFs", async () => {
    const buf = makePdf(["1 0 obj << /Type /Catalog >> endobj"]);
    expect((await detectPdfSignature(buf)).status).toBe("NO_SIGNATURE_FOUND");
  });
});

describe("QR consistency verdicts", () => {
  const qrHit = (gstins: string[], pans: string[] = []): QrFinding => ({
    found: true,
    source: "IMAGE",
    imageIndex: 0,
    payload: gstins.join(",") + pans.join(","),
    identifiers: { gstins, pans, udyams: [], urls: [] },
  });

  it("CONSISTENT when QR GSTIN matches visible", () => {
    const v = compareQrWithFields([qrHit(["27AAPFU0939F1ZV"])], { gstin: "27AAPFU0939F1ZV" });
    expect(v.status).toBe("CONSISTENT");
  });

  it("CONFLICT when QR GSTIN differs from visible", () => {
    const v = compareQrWithFields([qrHit(["24AAPFU0939F1ZV"])], { gstin: "27AAPFU0939F1ZV" });
    expect(v.status).toBe("CONFLICT");
    expect(v.details.join(" ")).toMatch(/≠/);
  });

  it("INCONCLUSIVE with no comparable identifiers", () => {
    const v = compareQrWithFields([{ found: false, source: "IMAGE", imageIndex: 0 }], {});
    expect(v.status).toBe("INCONCLUSIVE");
  });
});
