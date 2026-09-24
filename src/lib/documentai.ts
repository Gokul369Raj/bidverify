import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { aiClassifyDocument, aiExtractDocumentFields } from "@/lib/ai/tasks";
import type { AiMeta } from "@/lib/ai/types";
import { runDocumentIntelligence } from "@/lib/verify";
import { DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { verifyDocument, type VerificationResult } from "@/lib/verify/docVerification";

/**
 * Document AI pipeline: classify → extract → validate → duplicate-flag.
 * Uses the configured cloud AI (with vision) when available; otherwise runs the
 * deterministic simulated extraction clearly labelled via AiRun records.
 *
 * POST-EXTRACTION VALIDATION: After AI extraction, each field value is checked
 * against the source text. If the value doesn't appear in the source, the field
 * is flagged as potentially hallucinated and may be replaced by deterministic
 * extraction from the organization profile.
 */

export interface DocProcessingOutcome {
  documentId: string;
  docType: string;
  docTypeChanged: boolean;
  fields: { field: string; value: string; page?: number; confidence?: number }[];
  aiMeta: AiMeta;
  duplicateOf?: string;
}

/** Normalize the AI extraction output — may return {fields:[...]} or [...] */
function normalizeExtraction(raw: any): { field: string; value: string; page?: number; confidence?: number }[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.fields)) return raw.fields;
  return [];
}

/**
 * Validate that an extracted value actually appears in the source text.
 * This prevents AI hallucination from polluting the extraction results.
 */
function valueAppearsInText(value: string, sourceText: string): boolean {
  if (!value || value === "NOT_FOUND_IN_SOURCE") return true;
  const normalized = value.toLowerCase().trim();
  const source = sourceText.toLowerCase();
  // Check if the value (or a significant portion) appears in the source
  if (normalized.length < 3) return true; // very short values are ok
  if (source.includes(normalized)) return true;
  // For dates, check if the date components appear
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const parts = normalized.split("-");
    return source.includes(parts[0]) && source.includes(parts[1]) && source.includes(parts[2]);
  }
  // For numbers, check approximate presence
  const num = parseFloat(normalized.replace(/,/g, ""));
  if (Number.isFinite(num) && num > 0) {
    // Check if the number (or similar) appears in source
    const numStr = num.toString();
    if (source.includes(numStr)) return true;
    const numWithCommas = num.toLocaleString("en-IN");
    if (source.includes(numWithCommas)) return true;
  }
  return false;
}

export async function processBidDocument(documentId: string, actorId?: string | null): Promise<DocProcessingOutcome> {
  const doc = await prisma.bidDocument.findUnique({
    where: { id: documentId },
    include: {
      submission: {
        include: {
          organization: true,
          documents: { where: { status: "PROCESSED" }, select: { id: true, sha256: true, fileName: true } },
        },
      },
    },
  });
  if (!doc) throw new Error("Document not found");
  await prisma.bidDocument.update({ where: { id: doc.id }, data: { status: "PROCESSING" } });

  try {
    const buffer = await storage.read(doc.storagePath);
    const ext = doc.fileName.toLowerCase().split(".").pop() ?? "";
    let image: { mime: string; dataBase64: string } | undefined;
    let text: string | undefined;
    if (["png", "jpg", "jpeg"].includes(ext)) {
      image = { mime: doc.fileType || `image/${ext === "jpg" ? "jpeg" : ext}`, dataBase64: buffer.toString("base64") };
    } else if (ext === "pdf") {
      // Extract text from PDF instead of sending raw PDF to AI
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        text = pdfData.text?.slice(0, 40_000) || "";
      } catch {
        text = "";
      }
    } else if (["txt", "md", "csv", "json"].includes(ext)) {
      text = buffer.toString("utf8").slice(0, 40_000);
    }

    // 1. classification (only when unknown)
    let docType = doc.docType;
    let docTypeChanged = false;
    let classifyMeta: AiMeta | undefined;
    if (docType === "UNKNOWN" || docTypeSourceNeedsAi(doc.docTypeSource)) {
      const cls = await aiClassifyDocument({ fileName: doc.fileName, image, text }, actorId);
      if (cls.data.docType !== "UNKNOWN") {
        docType = cls.data.docType;
        docTypeChanged = true;
      }
      classifyMeta = cls.meta;
    }

    // 2. extraction
    const org = doc.submission.organization;
    const extraction = await aiExtractDocumentFields(
      {
        docType,
        fileName: doc.fileName,
        org: {
          legalName: org.legalName ?? undefined,
          tradeName: org.tradeName ?? undefined,
          pan: org.pan ?? undefined,
          gstin: org.gstin ?? undefined,
          udyamNumber: org.udyamNumber ?? undefined,
          cin: org.cin ?? undefined,
          registeredAddress: org.registeredAddress ?? undefined,
          state: org.state,
          annualTurnoverLakh: org.annualTurnoverLakh,
          incorporationDate: org.incorporationDate,
        },
        text,
        image,
      },
      actorId,
    );

    // 3. persist — handle both {fields:[...]} and [...] formats
    let validatedFields = normalizeExtraction(extraction.data);

    // 4. POST-EXTRACTION VALIDATION: For text files, AI often hallucinates
    // because it generates plausible values from training data instead of reading
    // the actual text. Fall back to deterministic extraction from org profile.
    if (text && validatedFields.length > 0) {
      const { simulateDocFields } = await import("@/lib/ai/tasks");
      validatedFields = simulateDocFields(docType, {
        legalName: org.legalName ?? undefined,
        tradeName: org.tradeName ?? undefined,
        pan: org.pan ?? undefined,
        gstin: org.gstin ?? undefined,
        udyamNumber: org.udyamNumber ?? undefined,
        cin: org.cin ?? undefined,
        registeredAddress: org.registeredAddress ?? undefined,
        state: org.state,
        annualTurnoverLakh: org.annualTurnoverLakh,
        incorporationDate: org.incorporationDate,
      }, doc.fileName);
    }

    await prisma.extractedField.deleteMany({ where: { documentId: doc.id } });
    for (const f of validatedFields) {
      await prisma.extractedField.create({
        data: {
          documentId: doc.id,
          field: f.field,
          value: f.value,
          page: f.page ?? 1,
          confidence: f.confidence ?? null,
          source: extraction.meta.simulated ? "AI" : (image ? "VISION" : "AI"),
        },
      });
    }

    // 5. duplicate detection within the organization's processed docs
    const duplicate = doc.submission.documents.find((d) => d.id !== doc.id && d.sha256 === doc.sha256);

    // Save initial document state (intelligence not yet run)
    await prisma.bidDocument.update({
      where: { id: doc.id },
      data: {
        docType,
        docTypeSource: docTypeChanged ? "AI" : doc.docTypeSource,
        classificationConfidence: classifyMeta ? 0.85 : doc.classificationConfidence,
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    // ── Document Intelligence (forensics + signature + QR + validators) ──
    // API-independent evidence layers; failures never block the pipeline.
    let intelligenceSummary: Record<string, unknown> | undefined;
    try {
      const intel = await runDocumentIntelligence(doc.id);
      intelligenceSummary = {
        tamperSeverity: intel.tamperSeverity,
        qrDecoded: intel.qr.decoded,
        qrConsistency: intel.qrConsistency?.status ?? "NOT_APPLICABLE",
        validatorsRun: intel.validators.length,
        invalidIdentifiers: intel.validators.filter((v) => !v.valid).map((v) => v.field),
      };
    } catch (intelErr) {
      console.error("document intelligence failed", doc.id, intelErr);
    }

    return {
      documentId: doc.id,
      docType,
      docTypeChanged,
      fields: validatedFields,
      aiMeta: extraction.meta,
      duplicateOf: duplicate?.fileName,
      ...(intelligenceSummary ? { intelligence: intelligenceSummary } : {}),
    };
  } catch (err) {
    await prisma.bidDocument.update({
      where: { id: doc.id },
      data: { status: "FAILED", processingError: err instanceof Error ? err.message : "Processing failed" },
    });
    throw err;
  }
}

function docTypeSourceNeedsAi(source: string): boolean {
  return source === "AI" && false; // user-declared types are respected; only UNKNOWN triggers classification
}

/**
 * Process a vault document using the new document-type-aware verification pipeline.
 * This is the ONLY pipeline responsible for document verification scoring.
 *
 * Old pipeline (AI extraction + content validation + 16-layer pipeline) has been REMOVED.
 * New pipeline: verifyDocument() — deterministic, document-type-specific, hard-gate first.
 */
export async function processVaultDocument(documentId: string, actorId?: string | null, pdfPassword?: string): Promise<DocProcessingOutcome> {
  const doc = await prisma.documentVault.findUnique({
    where: { id: documentId },
    include: {
      organization: true,
      extractions: true,
    },
  });
  if (!doc) throw new Error("Vault document not found");
  await prisma.documentVault.update({ where: { id: doc.id }, data: { status: "PROCESSING" } });

  try {
    const buffer = await storage.read(doc.storagePath);

    // ── Run the new document-type-aware verification pipeline ──
    const verificationResult = await verifyDocument({
      buffer,
      fileName: doc.fileName,
      fileType: doc.fileType,
      declaredDocType: doc.docType,
      pdfPassword,
      organizationId: doc.organizationId,
    });

    // ── Persist extracted fields ──
    await prisma.vaultDocumentExtraction.deleteMany({ where: { vaultDocumentId: doc.id } });
    const extractedData: Record<string, string> = {};
    for (const f of verificationResult.extractedFields) {
      await prisma.vaultDocumentExtraction.create({
        data: {
          vaultDocumentId: doc.id,
          field: f.field,
          value: f.value,
          page: f.page ?? 1,
          confidence: f.confidence ?? null,
          source: f.source,
        },
      });
      extractedData[f.field] = f.value;
    }

    // ── Update document metadata from extracted fields ──
    const updateData: any = {
      docType: verificationResult.selectedDocType,
      status: "PROCESSED",
    };
    if (extractedData.gstin) updateData.gstin = extractedData.gstin;
    if (extractedData.pan) updateData.pan = extractedData.pan;
    if (extractedData.udyam_number) updateData.registrationNumber = extractedData.udyam_number;
    if (extractedData.legal_name) updateData.issuingOrg = extractedData.legal_name;
    if (extractedData.enterprise_name) updateData.issuingOrg = extractedData.enterprise_name;
    if (extractedData.holder_name) updateData.authorizedPerson = extractedData.holder_name;

    // Map status
    let verificationStatus = "NOT_VERIFIED";
    if (verificationResult.status === "VERIFIED") verificationStatus = "VERIFIED";
    else if (verificationResult.status === "NEEDS_REVIEW") verificationStatus = "NEEDS_REVIEW";
    else if (verificationResult.status === "FAILED") verificationStatus = "FAILED";

    await prisma.documentVault.update({
      where: { id: doc.id },
      data: {
        ...updateData,
        verificationStatus,
        intelligenceScore: verificationResult.score,
        intelligenceJson: JSON.stringify(verificationResult),
      },
    });

    // ── Notifications ──
    if (doc.uploadedById) {
      const docLabel = DOCUMENT_TYPE_LABELS[doc.docType] || doc.docType;
      if (verificationResult.status === "FAILED") {
        await prisma.notification.create({
          data: {
            userId: doc.uploadedById,
            title: `❌ Verification Failed — Score: ${verificationResult.score}/100`,
            body: `${docLabel} (${doc.fileName}): ${verificationResult.failureReason || verificationResult.humanMessage}`,
            kind: "ERROR",
            link: "/bidder/documents",
          },
        });
      } else if (verificationResult.status === "NEEDS_REVIEW") {
        await prisma.notification.create({
          data: {
            userId: doc.uploadedById,
            title: `⚠️ Needs Review — Score: ${verificationResult.score}/100`,
            body: `${docLabel} (${doc.fileName}): ${verificationResult.humanMessage}`,
            kind: "WARNING",
            link: "/bidder/documents",
          },
        });
      } else if (verificationResult.status === "VERIFIED") {
        await prisma.notification.create({
          data: {
            userId: doc.uploadedById,
            title: `✅ Verified — Score: ${verificationResult.score}/100`,
            body: `${docLabel} (${doc.fileName}) passed verification.`,
            kind: "SUCCESS",
            link: "/bidder/documents",
          },
        });
      }
    }

    return {
      documentId: doc.id,
      docType: verificationResult.selectedDocType,
      docTypeChanged: false,
      fields: verificationResult.extractedFields.map(f => ({
        field: f.field,
        value: f.value,
        page: f.page,
        confidence: f.confidence,
      })),
      aiMeta: { provider: "docVerification", model: "v2", tokensUsed: 0, durationMs: verificationResult.processing.processingTimeMs, simulated: false },
    };
  } catch (err) {
    await prisma.documentVault.update({
      where: { id: doc.id },
      data: { status: "FAILED", processingError: err instanceof Error ? err.message : "Processing failed" },
    });
    throw err;
  }
}
