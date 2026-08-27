import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { processVaultDocument } from "@/lib/documentai";

/** POST — Attach a vault document OR upload a new document to an application requirement */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({ where: { id }, include: { tender: true } });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");
    if (app.status !== "DRAFT" && app.status !== "IN_PROGRESS") return fail(409, "Application is no longer editable");

    const contentType = req.headers.get("content-type") || "";

    // Mode 1: JSON — Attach existing vault document
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.vaultDocumentId && body.requirementCode) {
        const vaultDoc = await prisma.documentVault.findUnique({ where: { id: body.vaultDocumentId } });
        if (!vaultDoc) return fail(404, "Vault document not found");
        if (vaultDoc.organizationId !== session.organizationId) return fail(403, "Access denied");
        if (!vaultDoc.isActive) return fail(400, "This document version is archived");
        if (["FAILED", "INVALID", "UPLOADED"].includes(vaultDoc.status)) return fail(400, "Document must be processed before attaching");

        await prisma.applicationDocument.deleteMany({
          where: { applicationId: id, requirementCode: body.requirementCode },
        });

        const attached = await prisma.applicationDocument.create({
          data: {
            applicationId: id,
            vaultDocumentId: vaultDoc.id,
            requirementCode: body.requirementCode,
            matchType: body.matchType || "MANUAL",
            matchConfidence: 1.0,
            matchReason: body.reason || "Manually attached by bidder",
            docTypeSnapshot: vaultDoc.docType,
            fileNameSnapshot: vaultDoc.fileName,
            sha256Snapshot: vaultDoc.sha256,
            versionSnapshot: vaultDoc.version,
            status: "ATTACHED",
          },
        });

        await audit({ actor: session, action: "APPLICATION_DOCUMENT_ATTACHED", entityType: "ApplicationDocument", entityId: attached.id, after: { requirementCode: body.requirementCode, vaultDocId: vaultDoc.id } });
        return ok({ attached: true, documentId: attached.id });
      }
      return fail(400, "JSON body must include vaultDocumentId and requirementCode");
    }

    // Mode 2: Multipart — Upload a new document directly
    const form = await req.formData();
    const file = form.getAll("files").find((f): f is File => f instanceof File && f.size > 0);
    const reqCode = form.get("requirementCode") as string;
    const saveToVault = form.get("saveToVault") === "true";

    if (!file || !reqCode) return fail(400, "File and requirement code required");
    if (file.size > maxUploadBytes()) return fail(413, "File exceeds size limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const scan = scanFile(file.name, file.type, buffer);
    if (!scan.ok) return fail(415, `${file.name}: ${scan.reason}`);

    let vaultDocId: string | null = null;

    // Optionally save to vault first
    if (saveToVault) {
      const saved = await storage.save(buffer, file.name);
      const vaultDoc = await prisma.documentVault.create({
        data: {
          organizationId: session.organizationId,
          uploadedById: session.userId,
          docType: "UNKNOWN",
          documentCategory: "OTHER",
          fileName: file.name,
          originalFileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: saved.size,
          storagePath: saved.storagePath,
          sha256: saved.sha256,
          status: "UPLOADED",
        },
      });
      vaultDocId = vaultDoc.id;
      processVaultDocument(vaultDoc.id, session.userId).catch(console.error);

      await prisma.notification.create({
        data: {
          userId: session.userId,
          title: `Document Uploaded — ${file.name}`,
          body: `Document saved to your vault and attached to tender application.`,
          kind: "SUCCESS",
          link: "/bidder/documents",
        },
      });
    }

    // Attach to application
    const saved = await storage.save(buffer, file.name);
    const attached = await prisma.applicationDocument.create({
      data: {
        applicationId: id,
        vaultDocumentId: vaultDocId,
        requirementCode: reqCode,
        matchType: "UPLOADED",
        matchConfidence: 1.0,
        matchReason: "Manually uploaded by bidder for this requirement",
        uploadedFileName: file.name,
        uploadedFileType: file.type,
        uploadedFileSize: file.size,
        uploadedStoragePath: saved.storagePath,
        uploadedSha256: saved.sha256,
        docTypeSnapshot: "UNKNOWN",
        fileNameSnapshot: file.name,
        sha256Snapshot: saved.sha256,
        status: "ATTACHED",
      },
    });

    await audit({ actor: session, action: "APPLICATION_DOCUMENT_UPLOADED", entityType: "ApplicationDocument", entityId: attached.id, after: { fileName: file.name, requirementCode: reqCode } });

    return ok({ attached: true, documentId: attached.id, vaultDocumentId: vaultDocId });
  });
}

/** DELETE — Detach a document from an application requirement */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");
    if (app.status !== "DRAFT" && app.status !== "IN_PROGRESS") return fail(409, "Application is no longer editable");

    const { documentId } = await req.json();
    if (!documentId) return fail(400, "documentId is required");

    const doc = await prisma.applicationDocument.findUnique({ where: { id: documentId } });
    if (!doc || doc.applicationId !== id) return fail(404, "Document not found");

    await prisma.applicationDocument.delete({ where: { id: documentId } });
    await audit({ actor: session, action: "APPLICATION_DOCUMENT_DETACHED", entityType: "ApplicationDocument", entityId: documentId });

    return ok({ detached: true });
  });
}
