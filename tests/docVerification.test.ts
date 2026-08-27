/**
 * DOCUMENT VERIFICATION PIPELINE TESTS
 *
 * Tests the new document-type-aware verification pipeline.
 * Critical acceptance: wrong document → score = 0, correct document → score > 0.
 */

import { describe, it, expect, afterAll } from "vitest";
import zlib from "zlib";
import {
  verifyDocument,
  getDocTypeRule,
  getSupportedDocTypes,
  type DocVerificationInput,
} from "@/lib/verify/docVerification";

// Suppress tesseract.js unhandled worker errors on minimal test images
const _origListeners = process.listeners("uncaughtException") as ((err: Error) => void)[];
process.removeAllListeners("uncaughtException");
process.on("uncaughtException", (err) => {
  if (err?.message?.includes("Error attempting to read image")) return;
  for (const listener of _origListeners) listener(err);
});
afterAll(() => {
  process.removeAllListeners("uncaughtException");
  for (const listener of _origListeners) process.on("uncaughtException", listener);
});

// ─────────────── Test Helpers ───────────────

/** Create a deflated PDF stream content */
function deflateStream(text: string): Buffer {
  // PDF BT/ET text block
  const content = `BT /F1 12 Tf 100 700 Td (${text}) Tj ET`;
  return zlib.deflateSync(Buffer.from(content, "latin1"));
}

/** Create a minimal valid PDF buffer with text content */
function makePdfWithText(text: string): Buffer {
  const streamData = deflateStream(text);
  const header = `%PDF-1.4\n`;
  const offsets: number[] = [];
  let pos = header.length;

  offsets.push(pos);
  const o1 = `1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n`;
  pos += o1.length;

  offsets.push(pos);
  const o2 = `2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n`;
  pos += o2.length;

  offsets.push(pos);
  const o3 = `3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n`;
  pos += o3.length;

  offsets.push(pos);
  const o4 = `4 0 obj\n<</Length ${streamData.length}>>\nstream\n`;
  pos += o4.length;
  pos += streamData.length;
  const o4end = `\nendstream\nendobj\n`;
  pos += o4end.length;

  offsets.push(pos);
  const o5 = `5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n`;
  pos += o5.length;

  const xrefPos = pos;
  let xref = `xref\n0 6\n`;
  xref += `0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.concat([
    Buffer.from(header, "latin1"),
    Buffer.from(o1, "latin1"),
    Buffer.from(o2, "latin1"),
    Buffer.from(o3, "latin1"),
    Buffer.from(o4, "latin1"),
    streamData,
    Buffer.from(o4end, "latin1"),
    Buffer.from(o5, "latin1"),
    Buffer.from(xref, "latin1"),
    Buffer.from(trailer, "latin1"),
  ]);
}

/** Create a minimal PNG buffer (1x1 pixel) */
function makePngBuffer(): Buffer {
  // Minimal valid PNG
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/** Create a buffer that's too small */
function makeTinyBuffer(): Buffer {
  return Buffer.from("AB");
}

/** Create a buffer with random bytes (not a valid file) */
function makeRandomBuffer(): Buffer {
  const buf = Buffer.alloc(200);
  for (let i = 0; i < 200; i++) buf[i] = Math.floor(Math.random() * 256);
  return buf;
}

// ─────────────── Test Suite ───────────────

describe("DocVerification — Document Type Rules Engine", () => {
  it("returns rules for all supported document types", () => {
    const types = getSupportedDocTypes();
    expect(types).toContain("PAN_CARD");
    expect(types).toContain("GST_CERTIFICATE");
    expect(types).toContain("UDYAM_CERTIFICATE");
    expect(types.length).toBeGreaterThanOrEqual(8);
  });

  it("returns correct rule for PAN_CARD", () => {
    const rule = getDocTypeRule("PAN_CARD");
    expect(rule).toBeDefined();
    expect(rule!.docType).toBe("PAN_CARD");
    expect(rule!.requiredIdentifier.name).toBe("pan");
    expect(rule!.requiredIdentifier.pattern).toBeDefined();
  });

  it("returns undefined for unknown doc type", () => {
    expect(getDocTypeRule("UNKNOWN")).toBeUndefined();
    expect(getDocTypeRule("FAKE_TYPE")).toBeUndefined();
  });
});

describe("DocVerification — File Intake & Validation", () => {
  it("rejects files that are too small", async () => {
    const result = await verifyDocument({
      buffer: makeTinyBuffer(),
      fileName: "tiny.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.failureReason).toContain("too small");
  });

  it("rejects unsupported file formats", async () => {
    const result = await verifyDocument({
      buffer: makeRandomBuffer(),
      fileName: "random.exe",
      fileType: "application/exe",
      declaredDocType: "PAN_CARD",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.failureReason).toContain("not a recognized");
  });

  it("accepts valid PDF files", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test content"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    // Should not fail due to file format
    expect(result.processing.isPdf).toBe(true);
  });

  it("accepts valid PNG files", async () => {
    const result = await verifyDocument({
      buffer: makePngBuffer(),
      fileName: "test.png",
      fileType: "image/png",
      declaredDocType: "PAN_CARD",
    });
    expect(result.processing.isImage).toBe(true);
  });
});

describe("DocVerification — Hard Gate (CRITICAL)", () => {
  // ═══════════════════════════════════════════════════════════
  // CRITICAL ACCEPTANCE TEST: Wrong document → score = 0
  // ═══════════════════════════════════════════════════════════

  it("CRITICAL: PAN selected + unrelated PDF → score = 0", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("This is a random document with no PAN information whatsoever. It contains general text about business operations and has nothing to do with income tax."),
      fileName: "random.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.selectedDocType).toBe("PAN_CARD");
    expect(result.failureReason).toBeTruthy();
    expect(result.failureReason).toContain("PAN");
  });

  it("CRITICAL: GST selected + PAN image → score = 0", async () => {
    // PAN text in an image, but user selected GST
    const result = await verifyDocument({
      buffer: makePdfWithText("Permanent Account Number ABCPD1234F Income Tax Department Government of India"),
      fileName: "pan_card.pdf",
      fileType: "application/pdf",
      declaredDocType: "GST_CERTIFICATE",
    });
    // Should fail because GSTIN not found
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });

  it("CRITICAL: Random image → GST selected → score = 0", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Just a random image with some text about India Government Certificate Registration but no GSTIN"),
      fileName: "random.pdf",
      fileType: "application/pdf",
      declaredDocType: "GST_CERTIFICATE",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });

  it("never outputs 50, 60, 70, 80 for wrong documents", async () => {
    const wrongDocs = [
      { buffer: makePdfWithText("Some random text about business"), docType: "PAN_CARD" },
      { buffer: makePdfWithText("Random content here"), docType: "GST_CERTIFICATE" },
      { buffer: makePdfWithText("Nothing relevant"), docType: "UDYAM_CERTIFICATE" },
    ];

    for (const { buffer, docType } of wrongDocs) {
      const result = await verifyDocument({
        buffer,
        fileName: "wrong.pdf",
        fileType: "application/pdf",
        declaredDocType: docType,
      });
      expect(result.score).not.toBe(50);
      expect(result.score).not.toBe(60);
      expect(result.score).not.toBe(70);
      expect(result.score).not.toBe(80);
      expect(result.score).toBe(0);
    }
  });
});

describe("DocVerification — PAN Verification", () => {
  it("PAN PDF with valid PAN number → passes gate", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Permanent Account Number Card\nIncome Tax Department\nGovernment of India\nPAN: ABCPD1234F\nName: JOHN DOE\nDate of Birth: 01/01/1990"),
      fileName: "pan_card.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    // Should pass the hard gate (PAN found)
    expect(result.evidence.requiredIdentifier.status).toBe("PASS");
    expect(result.evidence.requiredIdentifier.detail).toContain("ABCPD1234F");
    expect(result.extractedFields.some(f => f.field === "pan" && f.value === "ABCPD1234F")).toBe(true);
  });

  it("PAN PDF without PAN number → fails gate, score = 0", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Some document that talks about Income Tax but has no actual PAN number visible anywhere"),
      fileName: "no_pan.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
    expect(result.evidence.requiredIdentifier.status).toBe("FAIL");
  });

  it("PAN validation rejects invalid entity type", async () => {
    // PAN format: AAAAA9999A where 4th char must be P/C/H/F/A/T/B/L/J/G
    const result = await verifyDocument({
      buffer: makePdfWithText("Permanent Account Number ABCDX1234F Income Tax Department"),
      fileName: "bad_pan.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    // X is not a valid entity type code
    expect(result.evidence.requiredIdentifier.status).toBe("FAIL");
  });
});

describe("DocVerification — GST Verification", () => {
  it("GST PDF with valid GSTIN → passes gate", async () => {
    // GSTIN: 2-digit state code + 5-char PAN + 1 char + Z + 1 char
    const result = await verifyDocument({
      buffer: makePdfWithText("Goods and Services Tax Registration Certificate\nForm GST REG-06\nGSTIN: 27AAPFU0939F1ZV\nLegal Name: ABC INDUSTRIES\nTrade Name: ABC CORP\nRegistration Date: 01/04/2020"),
      fileName: "gst_cert.pdf",
      fileType: "application/pdf",
      declaredDocType: "GST_CERTIFICATE",
    });
    expect(result.evidence.requiredIdentifier.status).toBe("PASS");
    expect(result.evidence.requiredIdentifier.detail).toContain("27AAPFU0939F1ZV");
  });

  it("GST selected + no GSTIN → score = 0", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("This document talks about goods and services tax but does not contain any GSTIN number at all"),
      fileName: "no_gstin.pdf",
      fileType: "application/pdf",
      declaredDocType: "GST_CERTIFICATE",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });
});

describe("DocVerification — Udyam Verification", () => {
  it("Udyam PDF with valid number → passes gate", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Udyam Registration Certificate\nMinistry of Micro, Small and Medium Enterprises\nUdyam Registration Number: Udyam-MH-01-0000001\nEnterprise Name: ABC Enterprises\nType of Enterprise: Small"),
      fileName: "udyam.pdf",
      fileType: "application/pdf",
      declaredDocType: "UDYAM_CERTIFICATE",
    });
    expect(result.evidence.requiredIdentifier.status).toBe("PASS");
  });

  it("Udyam selected + no Udyam number → score = 0", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Some document about MSME micro small medium enterprise but no registration number"),
      fileName: "no_udyam.pdf",
      fileType: "application/pdf",
      declaredDocType: "UDYAM_CERTIFICATE",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });
});

describe("DocVerification — Forbidden Keywords", () => {
  it("PAN selected + GST content → fails due to forbidden keywords", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Goods and Services Tax Registration Certificate GSTIN: 27AAPFU0939F1ZV GST Registration"),
      fileName: "gst_cert.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });
});

describe("DocVerification — Scoring", () => {
  it("correct document with all evidence → high score", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Permanent Account Number Card\nIncome Tax Department\nGovernment of India\nPAN: ABCPD1234F\nName: JOHN DOE\nFather: Jane Doe\nDate of Birth: 01/01/1990\nDepartment of Income Tax"),
      fileName: "full_pan.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.evidence.docTypeMatch.status).toBe("PASS");
    expect(result.evidence.requiredIdentifier.status).toBe("PASS");
  });

  it("score is always between 0 and 100", async () => {
    const inputs: DocVerificationInput[] = [
      { buffer: makePdfWithText("test"), fileName: "a.pdf", fileType: "application/pdf", declaredDocType: "PAN_CARD" },
      { buffer: makePdfWithText("Permanent Account Number ABCPD1234F Income Tax"), fileName: "b.pdf", fileType: "application/pdf", declaredDocType: "PAN_CARD" },
      { buffer: makePngBuffer(), fileName: "c.png", fileType: "image/png", declaredDocType: "PAN_CARD" },
    ];
    for (const input of inputs) {
      const result = await verifyDocument(input);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("evidence scores never exceed their max", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Permanent Account Number ABCPD1234F Income Tax Department Government of India"),
      fileName: "pan.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    for (const [, ev] of Object.entries(result.evidence)) {
      expect(ev.score).toBeGreaterThanOrEqual(0);
      expect(ev.score).toBeLessThanOrEqual(ev.maxScore);
    }
  });
});

describe("DocVerification — Processing Metadata", () => {
  it("records text extraction mode", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test text content here"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.processing.textExtractionMode).toBeTruthy();
    expect(["NATIVE", "OCR", "NATIVE_AND_OCR", "NONE"]).toContain(result.processing.textExtractionMode);
  });

  it("records processing time", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.processing.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("records file metadata", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test"),
      fileName: "document.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.processing.fileName).toBe("document.pdf");
    expect(result.processing.isPdf).toBe(true);
    expect(result.processing.isImage).toBe(false);
  });
});

describe("DocVerification — Audit Trail", () => {
  it("generates audit entries for each step", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    expect(result.audit.length).toBeGreaterThan(0);
    expect(result.audit[0].step).toBe("FILE_INTAKE");
  });

  it("audit entries have timestamps", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("test"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    for (const entry of result.audit) {
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.step).toBeTruthy();
      expect(entry.detail).toBeTruthy();
    }
  });
});

describe("DocVerification — Password-Protected PDF", () => {
  it("encrypted PDF without password → PASSWORD_REQUIRED or FAILED", async () => {
    // Create a PDF that looks encrypted
    const encryptedPdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n4 0 obj<</Encrypt<</Filter/Standard/V 2/R 2/Length 128/O ()/U ()/P -4>>>endobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer<</Size 5/Root 1 0 R/Encrypt 4 0 R>>\nstartxref\n309\n%%EOF", "latin1");

    const result = await verifyDocument({
      buffer: encryptedPdf,
      fileName: "encrypted.pdf",
      fileType: "application/pdf",
      declaredDocType: "PAN_CARD",
    });
    // With auto-decrypt, empty password may succeed on test PDFs.
    // In either case, the PDF has no valid PAN content, so score must be 0.
    expect(result.processing.wasEncrypted).toBe(true);
    expect(result.score).toBe(0);
  });
});

describe("DocVerification — Unknown Document Type", () => {
  it("unsupported doc type → FAILED", async () => {
    const result = await verifyDocument({
      buffer: makePdfWithText("Some content"),
      fileName: "test.pdf",
      fileType: "application/pdf",
      declaredDocType: "NONEXISTENT_TYPE",
    });
    expect(result.status).toBe("FAILED");
    expect(result.score).toBe(0);
  });
});
