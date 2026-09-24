import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage } from "@/lib/storage";

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireOfficer();
    const form = await req.formData();

    const file = form.get("file") as File | null;
    if (!file || file.size === 0) return fail(400, "PDF file is required");

    const title = String(form.get("title") ?? "").trim();
    const tenderNumber = String(form.get("tenderNumber") ?? "").trim();
    const buyerOrganization = String(form.get("buyerOrganization") ?? "").trim();
    const closingDate = new Date(String(form.get("closingDate") ?? ""));
    const requiredDocsStr = String(form.get("requiredDocs") ?? "[]");
    const requiredDocs: string[] = JSON.parse(requiredDocsStr);

    if (!title || !tenderNumber || !buyerOrganization) return fail(400, "title, tenderNumber and buyerOrganization are required");
    if (Number.isNaN(closingDate.getTime())) return fail(400, "A valid closing date is required");

    const dup = await prisma.tender.findUnique({ where: { tenderNumber } });
    if (dup) return fail(409, `Tender number ${tenderNumber} already exists`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await storage.save(buffer, file.name);

    const tender = await prisma.tender.create({
      data: {
        tenderNumber,
        title,
        description: String(form.get("description") ?? ""),
        buyerOrganization,
        category: String(form.get("category") ?? "") || null,
        state: String(form.get("state") ?? "") || null,
        city: String(form.get("city") ?? "") || null,
        publishDate: new Date(),
        closingDate,
        source: "MANUAL_IMPORT",
        dataLabel: "DEMO_SIMULATED",
        estimatedValueLakh: form.get("estimatedValueLakh") ? parseFloat(String(form.get("estimatedValueLakh"))) : null,
        createdById: session.userId,
        aiAnalysisStatus: "COMPLETED",
        aiProvider: "OFFICER_OCR",
      },
    });

    await prisma.tenderDocument.create({
      data: {
        tenderId: tender.id,
        fileName: file.name,
        fileType: file.type || "application/pdf",
        fileSize: saved.size,
        storagePath: saved.storagePath,
        sha256: saved.sha256,
        docKind: "TENDER_DOCUMENT",
        uploadedById: session.userId,
      },
    });

    let index = 1;
    for (const docType of requiredDocs) {
      const DOC_TO_TYPE: Record<string, string> = {
        GST_CERTIFICATE: "GST_REGISTRATION",
        PAN_CARD: "PAN",
        UDYAM_CERTIFICATE: "UDYAM",
        EXPERIENCE_CERTIFICATE: "EXPERIENCE",
        TURNOVER_PROOF: "TURNOVER",
        COMPANY_CERTIFICATE: "ORGANIZATION",
        TECHNICAL_DATASHEET: "TECHNICAL_SPEC",
        OEM_AUTHORIZATION: "OEM_AUTHORIZATION",
        LOCAL_CONTENT_DECLARATION: "LOCAL_CONTENT",
        FINANCIAL: "FINANCIAL",
        EMD: "EMD",
        BIS_CERTIFICATION: "BIS_CERTIFICATION",
      };
      const DOC_TO_TITLE: Record<string, string> = {
        GST_CERTIFICATE: "GST Registration Certificate",
        PAN_CARD: "PAN Card",
        UDYAM_CERTIFICATE: "Udyam / MSME Registration",
        EXPERIENCE_CERTIFICATE: "Experience Certificate",
        TURNOVER_PROOF: "Annual Turnover Proof",
        COMPANY_CERTIFICATE: "Company Incorporation Certificate",
        TECHNICAL_DATASHEET: "Technical Datasheet",
        OEM_AUTHORIZATION: "OEM Authorization Letter",
        LOCAL_CONTENT_DECLARATION: "Local Content Declaration",
        FINANCIAL: "Financial Documents",
        EMD: "EMD / Bid Security",
        BIS_CERTIFICATION: "BIS Certification",
      };
      const typeKey = DOC_TO_TYPE[docType] || "OTHER";
      const title = DOC_TO_TITLE[docType] || docType;

      await prisma.tenderRequirement.create({
        data: {
          tenderId: tender.id,
          code: `R${index++}`,
          type: typeKey,
          title: title,
          description: `Required: ${title}`,
          mandatory: true,
          evidenceRequired: true,
          paramsJson: "{}",
          sourceDocument: file.name,
          page: 1,
          sourceText: null,
          confidence: 1.0,
          extractionMethod: "OFFICER_SELECT",
          status: "DRAFT",
        },
      });
    }

    let ocrText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      ocrText = pdfData.text || "";
    } catch { /* no text */ }

    await audit({
      actor: session,
      action: "TENDER_UPLOADED",
      entityType: "Tender",
      entityId: tender.id,
      after: { tenderNumber, title, requirementCount: requiredDocs.length, hasOCR: ocrText.length > 0 },
    });

    return ok({
      tenderId: tender.id,
      tenderNumber,
      requirementCount: requiredDocs.length,
      ocrPreview: ocrText.slice(0, 500) || null,
    });
  });
}
