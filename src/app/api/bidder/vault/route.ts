import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { processVaultDocument } from "@/lib/documentai";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/constants";

/** GET — List all vault documents for the current bidder's organization */
export async function GET() {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");

    const documents = await prisma.documentVault.findMany({
      where: { organizationId: session.organizationId, isActive: true },
      include: {
        extractions: { select: { field: true, value: true, confidence: true, source: true } },
        _count: { select: { versions: true, applications: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    // Check expiry status
    const now = new Date();
    const enriched = documents.map((doc) => {
      let expiryStatus = "NONE";
      if (doc.expiryDate) {
        const daysUntil = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / 86400000);
        if (daysUntil < 0) expiryStatus = "EXPIRED";
        else if (daysUntil <= 7) expiryStatus = "EXPIRING_7D";
        else if (daysUntil <= 30) expiryStatus = "EXPIRING_30D";
        else expiryStatus = "VALID";
      }
      return {
        ...doc,
        expiryStatus,
        versionCount: doc._count.versions + 1,
        usedInApplications: doc._count.applications,
        intelligenceScore: doc.intelligenceScore ?? null,
        intelligenceData: doc.intelligenceJson ? JSON.parse(doc.intelligenceJson) : null,
      };
    });

    // Stats
    const stats = {
      total: enriched.length,
      verified: enriched.filter((d) => d.verificationStatus === "VERIFIED").length,
      needsAttention: enriched.filter((d) =>
        d.status === "NEEDS_REVIEW" || d.expiryStatus === "EXPIRING_30D" || d.expiryStatus === "EXPIRING_7D"
      ).length,
      expired: enriched.filter((d) => d.expiryStatus === "EXPIRED").length,
      byCategory: enriched.reduce((acc: Record<string, number>, d) => {
        acc[d.documentCategory] = (acc[d.documentCategory] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return ok({ documents: enriched, stats });
  });
}

/** POST — Upload a new document to the vault */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");

    const form = await req.formData();
    const declaredType = String(form.get("docType") ?? "UNKNOWN");
    const category = String(form.get("category") ?? "OTHER");
    const pdfPassword = String(form.get("pdfPassword") ?? "").trim() || undefined;
    if (!(DOCUMENT_TYPES as readonly string[]).includes(declaredType)) return fail(400, "Unknown document type");
    
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return fail(400, "No files uploaded");

    const results: any[] = [];
    for (const file of files) {
      if (file.size > maxUploadBytes()) return fail(413, `${file.name} exceeds the ${process.env.MAX_UPLOAD_MB || 25} MB limit`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const scan = scanFile(file.name, file.type, buffer);
      if (!scan.ok) {
        await prisma.auditLog.create({
          data: {
            actorId: session.userId, actorEmail: session.email, actorRole: session.role,
            action: "DOCUMENT_QUARANTINED", entityType: "DocumentVault",
            afterJson: JSON.stringify({ fileName: file.name, reason: scan.reason }),
          },
        });
        return fail(415, `${file.name}: ${scan.reason}`);
      }

      const saved = await storage.save(buffer, file.name);
      
      // Check for duplicate in vault
      const existingDoc = await prisma.documentVault.findFirst({
        where: { organizationId: session.organizationId, sha256: saved.sha256, isActive: true },
      });

      const vaultDoc = await prisma.documentVault.create({
        data: {
          organizationId: session.organizationId,
          uploadedById: session.userId,
          docType: declaredType,
          documentCategory: category,
          fileName: file.name,
          originalFileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: saved.size,
          storagePath: saved.storagePath,
          sha256: saved.sha256,
          status: "UPLOADED",
        },
      });

      await audit({
        actor: session, action: "VAULT_DOCUMENT_UPLOADED", entityType: "DocumentVault", entityId: vaultDoc.id,
        after: { fileName: file.name, docType: declaredType, category, sha256: saved.sha256.slice(0, 16) },
      });

      // Process document (classify + extract + verify)
      let status = "PROCESSED";
      let extractedFields: any[] = [];
      try {
        const outcome = await processVaultDocument(vaultDoc.id, session.userId, pdfPassword);
        status = "PROCESSED";
        extractedFields = outcome.fields;
      } catch (err) {
        status = "FAILED";
        console.error("Vault doc processing failed:", err);
      }

      results.push({
        documentId: vaultDoc.id,
        fileName: file.name,
        status,
        docType: declaredType,
        duplicateOf: existingDoc?.fileName,
        extractedFields,
      });
    }

    return ok({ documents: results });
  });
}
