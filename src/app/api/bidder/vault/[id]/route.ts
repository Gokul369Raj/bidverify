import { prisma } from "@/lib/db";
import { requireBidder, requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { processVaultDocument } from "@/lib/documentai";
import { DOCUMENT_TYPES } from "@/lib/constants";

/** GET — Get a single vault document with full details */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const doc = await prisma.documentVault.findUnique({
      where: { id },
      include: {
        extractions: { select: { field: true, value: true, confidence: true, source: true } },
        organization: { select: { id: true, legalName: true } },
        uploadedBy: { select: { name: true, email: true } },
        applications: { select: { applicationId: true, requirementCode: true, matchType: true } },
      },
    });
    if (!doc) return fail(404, "Document not found");
    
    // Access control: bidders can only see their own org's docs
    if (session.role === "BIDDER" && session.organizationId !== doc.organizationId) {
      return fail(403, "Access denied");
    }

    // Audit log view
    await audit({ actor: session, action: "VAULT_DOCUMENT_VIEWED", entityType: "DocumentVault", entityId: id });

    return ok({ document: doc });
  });
}

/** POST — Upload a replacement version of an existing vault document */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");
    const { id } = await ctx.params;

    const existing = await prisma.documentVault.findUnique({ where: { id } });
    if (!existing) return fail(404, "Document not found");
    if (existing.organizationId !== session.organizationId) return fail(403, "Access denied");

    const form = await req.formData();
    const file = form.getAll("files").find((f): f is File => f instanceof File && f.size > 0);
    const pdfPassword = String(form.get("pdfPassword") ?? "").trim() || undefined;
    if (!file) return fail(400, "No file uploaded");

    if (file.size > maxUploadBytes()) return fail(413, "File exceeds size limit");
    const buffer = Buffer.from(await file.arrayBuffer());
    const scan = scanFile(file.name, file.type, buffer);
    if (!scan.ok) return fail(415, `${file.name}: ${scan.reason}`);

    const saved = await storage.save(buffer, file.name);
    const newVersion = (existing.version || 1) + 1;

    // Mark old version as inactive and create new version
    const newDoc = await prisma.documentVault.create({
      data: {
        organizationId: session.organizationId,
        uploadedById: session.userId,
        docType: existing.docType,
        documentCategory: existing.documentCategory,
        fileName: file.name,
        originalFileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: saved.size,
        storagePath: saved.storagePath,
        sha256: saved.sha256,
        version: newVersion,
        previousVersionId: existing.id,
        status: "UPLOADED",
        isActive: true,
      },
    });

    // Mark old version inactive
    await prisma.documentVault.update({ where: { id: existing.id }, data: { isActive: false } });

    await audit({
      actor: session, action: "VAULT_DOCUMENT_REPLACED", entityType: "DocumentVault", entityId: newDoc.id,
      before: { version: existing.version, fileName: existing.fileName },
      after: { version: newVersion, fileName: file.name },
    });

    // Process new version
    let status = "PROCESSED";
    try {
      await processVaultDocument(newDoc.id, session.userId, pdfPassword);
    } catch { status = "FAILED"; }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.userId,
        title: `Document Updated — ${existing.docType.replace(/_/g, " ")}`,
        body: `Version ${newVersion} uploaded. Previous version (v${existing.version}) archived.`,
        kind: "SUCCESS",
        link: "/bidder/documents",
      },
    });

    return ok({ documentId: newDoc.id, version: newVersion, status });
  });
}

/** DELETE — Soft-delete a vault document (mark inactive) and remove from any applications */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const doc = await prisma.documentVault.findUnique({ where: { id } });
    if (!doc) return fail(404, "Document not found");
    if (doc.organizationId !== session.organizationId) return fail(403, "Access denied");

    // Remove from any applications first
    await prisma.applicationDocument.deleteMany({ where: { vaultDocumentId: id } });

    // Mark vault doc inactive
    await prisma.documentVault.update({ where: { id }, data: { isActive: false } });
    await audit({ actor: session, action: "VAULT_DOCUMENT_DELETED", entityType: "DocumentVault", entityId: id });

    return ok({ deleted: true });
  });
}
