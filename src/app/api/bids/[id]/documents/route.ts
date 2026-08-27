import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { getBidForUser } from "@/lib/bidAccess";
import { processBidDocument } from "@/lib/documentai";
import { DOCUMENT_TYPES } from "@/lib/constants";

const patchSchema = z.union([
  z.object({ action: z.literal("classify"), documentId: z.string(), docType: z.string() }),
  z.object({ action: z.literal("reprocess"), documentId: z.string() }),
  z.object({ action: z.literal("delete"), documentId: z.string() }),
]);

/** Upload bid documents (multipart) or manage them (classify / reprocess / delete). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const { bid, isOfficer } = await getBidForUser(id, session);
    if (!isOfficer && bid.status !== "DRAFT") return fail(409, "Bid already submitted — contact the buyer for changes");

    const form = await req.formData();
    const declaredType = String(form.get("docType") ?? "UNKNOWN");
    if (!(DOCUMENT_TYPES as readonly string[]).includes(declaredType)) return fail(400, "Unknown document type");
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return fail(400, "No files uploaded");

    const results: { documentId: string; fileName: string; status: string; docType: string; duplicateOf?: string; aiSimulated: boolean }[] = [];
    for (const file of files) {
      if (file.size > maxUploadBytes()) return fail(413, `${file.name} exceeds the ${process.env.MAX_UPLOAD_MB || 25} MB limit`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const scan = scanFile(file.name, file.type, buffer);
      if (!scan.ok) {
        await prisma.auditLog.create({
          data: {
            actorId: session.userId, actorEmail: session.email, actorRole: session.role,
            action: "DOCUMENT_QUARANTINED", entityType: "BidDocument", entityId: id,
            afterJson: JSON.stringify({ fileName: file.name, reason: scan.reason }),
          },
        });
        return fail(415, `${file.name}: ${scan.reason}`);
      }
      const saved = await storage.save(buffer, file.name);
      const doc = await prisma.bidDocument.create({
        data: {
          submissionId: id,
          organizationId: bid.organizationId,
          docType: declaredType,
          docTypeSource: declaredType === "UNKNOWN" ? "AI" : "USER",
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: saved.size,
          storagePath: saved.storagePath,
          sha256: saved.sha256,
          status: "UPLOADED",
          uploadedById: session.userId,
        },
      });
      await audit({
        actor: session,
        action: "DOCUMENT_UPLOADED",
        entityType: "BidDocument",
        entityId: doc.id,
        after: { fileName: file.name, docType: declaredType, sha256: saved.sha256.slice(0, 16) },
      });

      // asynchronous-style immediate processing for the demo (background job in production scale-out)
      let status = "UPLOADED";
      let finalType = declaredType;
      let duplicateOf: string | undefined;
      let aiSimulated = true;
      try {
        const outcome = await processBidDocument(doc.id, session.userId);
        status = "PROCESSED";
        finalType = outcome.docType;
        duplicateOf = outcome.duplicateOf;
        aiSimulated = outcome.aiMeta.simulated;
      } catch {
        status = "FAILED";
      }
      results.push({ documentId: doc.id, fileName: file.name, status, docType: finalType, duplicateOf, aiSimulated });
    }

    return ok({ documents: results });
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const { bid, isOfficer } = await getBidForUser(id, session);
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Invalid action");

    const doc = bid.documents.find((d) => d.id === parsed.data.documentId);
    if (!doc) return fail(404, "Document not found");

    if (parsed.data.action === "classify") {
      if (!(DOCUMENT_TYPES as readonly string[]).includes(parsed.data.docType)) return fail(400, "Unknown document type");
      await prisma.bidDocument.update({
        where: { id: doc.id },
        data: { docType: parsed.data.docType, docTypeSource: "MANUAL" },
      });
      await audit({ actor: session, action: "DOCUMENT_RECLASSIFIED", entityType: "BidDocument", entityId: doc.id, before: { docType: doc.docType }, after: { docType: parsed.data.docType } });
      // re-extract with the corrected type
      await prisma.bidDocument.update({ where: { id: doc.id }, data: { status: "UPLOADED" } });
      await processBidDocument(doc.id, session.userId).catch(() => undefined);
      return ok({ reclassified: true });
    }

    if (parsed.data.action === "reprocess") {
      await prisma.bidDocument.update({ where: { id: doc.id }, data: { status: "UPLOADED", processingError: null } });
      const outcome = await processBidDocument(doc.id, session.userId);
      return ok({ docType: outcome.docType, fields: outcome.fields, simulated: outcome.aiMeta.simulated });
    }

    // delete (draft only)
    if (!isOfficer && bid.status !== "DRAFT") return fail(409, "Cannot delete documents after submission");
    await prisma.extractedField.deleteMany({ where: { documentId: doc.id } });
    await prisma.bidDocument.delete({ where: { id: doc.id } });
    await storage.delete(doc.storagePath);
    await audit({ actor: session, action: "DOCUMENT_DELETED", entityType: "BidDocument", entityId: doc.id, before: { fileName: doc.fileName } });
    return ok({ deleted: true });
  });
}
