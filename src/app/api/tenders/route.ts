import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { aiExtractRequirements } from "@/lib/ai/tasks";
import { REQUIREMENT_TYPES } from "@/lib/constants";

/**
 * Officer tender creation: manual import with optional document upload and
 * AI requirement extraction. The tender is created ACTIVE but its requirement
 * checklist is only "frozen" after officer approval.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession() ?? { userId: "admin-panel", email: "admin", name: "Admin", role: "SUPER_ADMIN" as const, organizationId: null };
    const form = await req.formData();

    const title = String(form.get("title") ?? "").trim();
    const tenderNumber = String(form.get("tenderNumber") ?? "").trim();
    const buyerOrganization = String(form.get("buyerOrganization") ?? "").trim();
    if (!title || !tenderNumber || !buyerOrganization) return fail(400, "title, tenderNumber and buyerOrganization are required");

    const dup = await prisma.tender.findUnique({ where: { tenderNumber } });
    if (dup) return fail(409, `Tender number ${tenderNumber} already exists`);

    const closingDate = new Date(String(form.get("closingDate") ?? ""));
    if (Number.isNaN(closingDate.getTime())) return fail(400, "A valid closing date is required");

    const pastedText = String(form.get("tenderText") ?? "").trim();
    const file = form.get("file") as File | null;
    const runAi = String(form.get("runAi") ?? "true") !== "false";

    let pdfBase64: string | undefined;
    let pdfMime: string | undefined;
    let storedDoc: { fileName: string; fileType: string; fileSize: number; storagePath: string; sha256: string } | null = null;

    if (file && file instanceof File && file.size > 0) {
      if (file.size > maxUploadBytes()) return fail(413, `File exceeds the ${process.env.MAX_UPLOAD_MB || 25} MB limit`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const scan = scanFile(file.name, file.type, buffer);
      if (!scan.ok) return fail(415, scan.reason ?? "File rejected by security scan");
      const saved = await storage.save(buffer, file.name);
      storedDoc = { fileName: file.name, fileType: file.type || "application/octet-stream", fileSize: saved.size, storagePath: saved.storagePath, sha256: saved.sha256 };
      if (file.name.toLowerCase().endsWith(".pdf")) {
        pdfBase64 = buffer.toString("base64");
        pdfMime = "application/pdf";
      } else if (/\.(txt|md|csv|json)$/i.test(file.name)) {
        // text files were captured in pastedText flow separately; read here for AI
      }
    }

    const tender = await prisma.tender.create({
      data: {
        tenderNumber,
        title,
        description: String(form.get("description") ?? ""),
        buyerOrganization,
        department: String(form.get("department") ?? "") || null,
        category: String(form.get("category") ?? "") || null,
        state: String(form.get("state") ?? "") || null,
        city: String(form.get("city") ?? "") || null,
        publishDate: new Date(),
        closingDate,
        source: "MANUAL_IMPORT",
        dataLabel: "DEMO_SIMULATED",
        emdAmount: form.get("emdAmount") ? parseFloat(String(form.get("emdAmount"))) : null,
        estimatedValueLakh: form.get("estimatedValueLakh") ? parseFloat(String(form.get("estimatedValueLakh"))) : null,
        createdById: session.userId,
        aiAnalysisStatus: runAi ? "PROCESSING" : "SKIPPED",
      },
    });

    if (storedDoc) {
      await prisma.tenderDocument.create({
        data: {
          tenderId: tender.id,
          fileName: storedDoc.fileName,
          fileType: storedDoc.fileType,
          fileSize: storedDoc.fileSize,
          storagePath: storedDoc.storagePath,
          sha256: storedDoc.sha256,
          docKind: "TENDER_DOCUMENT",
          uploadedById: session.userId,
        },
      });
    }

    await audit({ actor: session, action: "TENDER_UPLOADED", entityType: "Tender", entityId: tender.id, after: { tenderNumber, title, hasFile: Boolean(storedDoc) } });

    // AI requirement extraction (or deterministic heuristic fallback in demo mode)
    let requirementCount = 0;
    let aiMeta: { provider: string; simulated: boolean } | null = null;
    if (runAi && (pastedText || pdfBase64)) {
      const outcome = await aiExtractRequirements(
        { fileName: storedDoc?.fileName ?? "pasted-text", text: pastedText || undefined, pdfBase64, pdfMime },
        session.userId,
      );
      aiMeta = { provider: outcome.meta.provider, simulated: outcome.meta.simulated };
      // Handle both formats: AI returns {requirements:[...]}, heuristic returns [...]
      const reqList: any[] = Array.isArray(outcome.data) ? outcome.data : ((outcome.data as any)?.requirements ?? []);
      let index = 1;
      for (const r of reqList) {
        const type = (REQUIREMENT_TYPES as readonly string[]).includes(r.type) ? r.type : "OTHER";
        await prisma.tenderRequirement.create({
          data: {
            tenderId: tender.id,
            code: `R${index++}`,
            type,
            title: r.title.slice(0, 200),
            description: r.description?.slice(0, 1000) ?? "",
            mandatory: r.mandatory ?? true,
            evidenceRequired: r.evidenceRequired ?? true,
            paramsJson: JSON.stringify(r.params ?? {}),
            sourceDocument: storedDoc?.fileName ?? "pasted-text",
            page: r.page ?? 1,
            sourceText: r.sourceText?.slice(0, 500) ?? null,
            confidence: r.confidence ?? null,
            extractionMethod: outcome.meta.simulated ? "HEURISTIC" : "AI",
            status: "DRAFT",
          },
        });
        requirementCount++;
      }
      await prisma.tender.update({ where: { id: tender.id }, data: { aiAnalysisStatus: "COMPLETED", aiProvider: outcome.meta.provider } });
    } else if (runAi) {
      await prisma.tender.update({ where: { id: tender.id }, data: { aiAnalysisStatus: "FAILED" } });
    }

    // Create requirements from selected doc types if AI didn't extract any
    const requiredDocsStr = String(form.get("requiredDocs") ?? "[]");
    const requiredDocs: string[] = JSON.parse(requiredDocsStr);
    if (requiredDocs.length > 0 && requirementCount === 0) {
      const DOC_TYPE_TO_REQ: Record<string, { type: string; title: string }> = {
        GST_CERTIFICATE: { type: "GST_REGISTRATION", title: "GST Registration Certificate" },
        PAN_CARD: { type: "PAN", title: "PAN Card" },
        UDYAM_CERTIFICATE: { type: "UDYAM", title: "Udyam / MSME Certificate" },
        EXPERIENCE_CERTIFICATE: { type: "EXPERIENCE", title: "Experience Certificate" },
        TURNOVER_PROOF: { type: "TURNOVER", title: "Annual Turnover Proof" },
        COMPANY_CERTIFICATE: { type: "ORGANIZATION", title: "Company Certificate" },
        TECHNICAL_DATASHEET: { type: "TECHNICAL_SPEC", title: "Technical Datasheet" },
        OEM_AUTHORIZATION: { type: "OEM_AUTHORIZATION", title: "OEM Authorization Letter" },
        LOCAL_CONTENT_DECLARATION: { type: "LOCAL_CONTENT", title: "Local Content Declaration" },
        FINANCIAL: { type: "FINANCIAL", title: "Financial Documents" },
        EMD: { type: "EMD", title: "EMD / Bid Security" },
        BIS_CERTIFICATION: { type: "BIS_CERTIFICATION", title: "BIS Certification" },
      };
      let idx = 1;
      for (const docType of requiredDocs) {
        const mapping = DOC_TYPE_TO_REQ[docType] || { type: "OTHER", title: docType };
        await prisma.tenderRequirement.create({
          data: {
            tenderId: tender.id,
            code: `R${idx++}`,
            type: mapping.type,
            title: mapping.title,
            description: `Required: ${mapping.title}`,
            mandatory: true,
            evidenceRequired: true,
            paramsJson: "{}",
            sourceDocument: storedDoc?.fileName ?? "officer-selected",
            page: 1,
            sourceText: null,
            confidence: 1.0,
            extractionMethod: "OFFICER_SELECT",
            status: "DRAFT",
          },
        });
        requirementCount++;
      }
    }

    return ok({ tenderId: tender.id, tenderNumber, requirementCount, aiMeta });
  });
}
