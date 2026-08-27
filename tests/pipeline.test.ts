import { describe, expect, it, vi } from "vitest";
import { runVerificationPipeline } from "@/lib/verify/pipeline";

vi.mock("@/lib/verify/ocr", () => ({
  ocrImage: async (buffer: Buffer) => ({
    text: buffer.toString("utf8").includes("PAN_IMAGE")
      ? "INCOME TAX DEPARTMENT GOVT OF INDIA Permanent Account Number HYYPR4192H Name GOKUL RAJ Date of Birth 15/03/2006"
      : "",
    confidence: 92,
    words: 0,
  }),
  ocrPdfImages: async () => ({ text: "", confidence: 0, pageCount: 0, imagesOcrd: 0 }),
  renderAndOcrPdf: async () => ({ text: "", confidence: 0, pageCount: 0 }),
}));

function makePdf(parts: string[]): Buffer {
  return Buffer.from(`%PDF-1.7\n${parts.join("\n")}\n%%EOF\n`, "latin1");
}

describe("verification pipeline scoring", () => {
  it("requires the password before verifying encrypted signed Income Tax PAN PDFs", async () => {
    const buf = makePdf([
      "1 0 obj << /Type /Catalog /Pages 2 0 R /AcroForm 4 0 R >> endobj",
      "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 5 0 R >> >> >> endobj",
      "4 0 obj << /Fields [6 0 R] /SigFlags 3 >> endobj",
      "5 0 obj << /Subtype /Image /Width 600 /Height 800 >> stream\nimage-bytes\nendstream endobj",
      "6 0 obj << /Type /Annot /FT /Sig /ByteRange [0 100 200 300] /SubFilter /adbe.pkcs7.detached /SignerName (DS INCOME TAX DEPARTMENT PAN) >> endobj",
      "trailer << /Root 1 0 R /Encrypt 7 0 R >>",
    ]);

    const result = await runVerificationPipeline({
      buffer: buf,
      fileName: "pan.pdf",
      declaredDocType: "PAN_CARD",
      organizationId: "org-1",
    });

    expect(result.passwordRequired).toBe(true);
    expect(result.decision).toBe("PASSWORD_REQUIRED");
    expect(result.overallScore).toBe(0);
    expect(result.reasonCodes).toContain("PASSWORD_REQUIRED");
  });

  it("scores an image upload only when OCR establishes the selected document identity", async () => {
    const panImage = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("PAN_IMAGE"),
      Buffer.alloc(512, 0),
    ]);

    const result = await runVerificationPipeline({
      buffer: panImage,
      fileName: "pan.png",
      declaredDocType: "PAN_CARD",
      organizationId: "org-1",
    });

    expect(result.decision).toBe("ACCEPTED");
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.textExtractionMode).toBe("OCR_ONLY");
    expect(result.reasonCodes).not.toContain("RAW_IMAGE_AS_DOCUMENT");
  });

  it("keeps random image uploads at zero when OCR does not match the selected type", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(512, 0),
    ]);

    const result = await runVerificationPipeline({
      buffer: png,
      fileName: "pan.png",
      declaredDocType: "PAN_CARD",
      organizationId: "org-1",
    });

    expect(result.decision).toBe("REJECTED");
    expect(result.overallScore).toBe(0);
    expect(result.reasonCodes).toContain("CORE_DOCUMENT_EVIDENCE_MISSING");
  });
});
