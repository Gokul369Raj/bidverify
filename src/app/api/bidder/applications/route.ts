import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** POST — Prepare (or fetch) an application for a tender. Runs auto-matching. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");

    const { tenderId } = await req.json();
    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: {
        requirementConfigs: { where: { status: "ACTIVE" } },
        requirements: { where: { status: { in: ["APPROVED", "DRAFT"] } } },
      },
    });
    if (!tender || tender.status !== "ACTIVE") return fail(404, "Tender not available");

    // Check for existing application
    const existing = await prisma.application.findFirst({
      where: { tenderId, organizationId: session.organizationId },
    });
    if (existing && existing.status !== "DRAFT") {
      return ok({ applicationId: existing.id, status: existing.status, existing: true });
    }

    // Get organization profile for auto-fill
    const org = await prisma.organization.findUnique({ where: { id: session.organizationId } });
    if (!org) return fail(400, "Organization not found");

    // Auto-fill profile snapshot
    const profileSnapshot = {
      legalName: org.legalName, tradeName: org.tradeName, pan: org.pan, gstin: org.gstin,
      udyamNumber: org.udyamNumber, cin: org.cin, registeredAddress: org.registeredAddress,
      state: org.state, city: org.city, pincode: org.pincode, phone: org.phone,
      organizationType: org.organizationType, businessCategory: org.businessCategory,
      annualTurnoverLakh: org.annualTurnoverLakh, incorporationDate: org.incorporationDate,
      isMsme: org.isMsme, isStartup: org.isStartup, isOem: org.isOem,
    };

    // Snapshot current tender requirements
    const reqConfigs = tender.requirementConfigs.length > 0
      ? tender.requirementConfigs
      : tender.requirements.map((r) => ({
          id: r.id, requirementCode: r.code, requirementTitle: r.title, requirementType: r.type,
          mandatory: r.mandatory, description: r.description,
          allowedDocTypes: JSON.stringify(getAllowedDocTypesForRequirement(r.type)),
          multipleDocumentsAllowed: false, expiryRequired: false, verificationRequired: false,
          declarationRequired: false, formFieldsSchema: JSON.stringify([]),
        }));
    const requirementSnapshot = JSON.stringify(reqConfigs);

    if (existing) {
      // Update existing draft
      await prisma.application.update({
        where: { id: existing.id },
        data: { profileSnapshot: JSON.stringify(profileSnapshot), requirementSnapshot },
      });
      return ok({ applicationId: existing.id, status: "DRAFT", existing: true });
    }

    // Count applications for numbering
    const appCount = await prisma.application.count();
    const app = await prisma.application.create({
      data: {
        tenderId,
        organizationId: session.organizationId,
        userId: session.userId,
        applicationNumber: `APP/2026/${String(appCount + 1).padStart(5, "0")}`,
        status: "DRAFT",
        profileSnapshot: JSON.stringify(profileSnapshot),
        requirementSnapshot,
        formValuesSnapshot: "{}",
        declarationSnapshot: "{}",
      },
    });

    await audit({ actor: session, action: "APPLICATION_CREATED", entityType: "Application", entityId: app.id, after: { tenderNumber: tender.tenderNumber } });

    // Auto-match vault documents to requirements
    const matchResult = await autoMatchDocuments(app.id, session.organizationId, reqConfigs);

    // Calculate progress
    const progress = calculateProgress(matchResult.matched, matchResult.total, matchResult.formFieldsCount, matchResult.formFieldsCompleted);

    await prisma.application.update({
      where: { id: app.id },
      data: { progressPercent: progress },
    });

    return ok({ applicationId: app.id, status: "DRAFT", matchResult, progress });
  });
}

/** GET — List applications for current bidder */
export async function GET() {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");

    const applications = await prisma.application.findMany({
      where: { organizationId: session.organizationId },
      include: {
        tender: { select: { id: true, tenderNumber: true, title: true, closingDate: true, buyerOrganization: true, status: true } },
        documents: { select: { id: true, requirementCode: true, matchType: true, status: true, docTypeSnapshot: true, fileNameSnapshot: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok({ applications });
  });
}

// ── Helper functions ──

function getAllowedDocTypesForRequirement(requirementType: string): string[] {
  const mapping: Record<string, string[]> = {
    GST_REGISTRATION: ["GST_CERTIFICATE"],
    PAN: ["PAN_CARD"],
    UDYAM: ["UDYAM_CERTIFICATE"],
    OEM_AUTHORIZATION: ["OEM_AUTHORIZATION"],
    EXPERIENCE: ["EXPERIENCE_CERTIFICATE"],
    TURNOVER: ["TURNOVER_PROOF", "COMPANY_CERTIFICATE"],
    LOCAL_CONTENT: ["LOCAL_CONTENT_DECLARATION"],
    TECHNICAL_SPEC: ["TECHNICAL_DATASHEET"],
    CERTIFICATE: ["COMPANY_CERTIFICATE"],
    DECLARATION: ["COMPANY_CERTIFICATE", "OTHER"],
    STATUTORY: ["COMPANY_CERTIFICATE"],
    EMD: ["COMPANY_CERTIFICATE"],
    FINANCIAL: ["TURNOVER_PROOF"],
    BIS_CERTIFICATION: ["COMPANY_CERTIFICATE"],
    ORGANIZATION: ["COMPANY_CERTIFICATE"],
    OTHER: ["OTHER", "UNKNOWN"],
  };
  return mapping[requirementType] || ["OTHER", "UNKNOWN"];
}

async function autoMatchDocuments(
  applicationId: string,
  organizationId: string,
  requirementConfigs: any[],
): Promise<{ matched: number; total: number; documents: any[]; formFieldsCount: number; formFieldsCompleted: number }> {
  // Load vault documents for this organization
  const vaultDocs = await prisma.documentVault.findMany({
    where: { organizationId, isActive: true, status: { not: "FAILED" } },
  });

  const matchedDocs: any[] = [];
  let matchedCount = 0;
  let formFieldsCount = 0;
  let formFieldsCompleted = 0;

  for (const config of requirementConfigs) {
    const allowedTypes: string[] = typeof config.allowedDocTypes === "string"
      ? JSON.parse(config.allowedDocTypes)
      : (config.allowedDocTypes || []);

    // Find matching vault documents
    const matchingVaultDocs = vaultDocs.filter((vDoc) => {
      // Check if doc type matches allowed types for this requirement
      if (allowedTypes.length > 0 && !allowedTypes.includes(vDoc.docType)) return false;
      // Check expiry if required
      if (config.expiryRequired && vDoc.expiryDate && vDoc.expiryDate < new Date()) return false;
      // Must be processed/verified
      if (["FAILED", "INVALID", "UPLOADED"].includes(vDoc.status)) return false;
      return true;
    });

    if (matchingVaultDocs.length > 0) {
      // Pick the best match (most recent, verified preferred)
      const best = matchingVaultDocs.sort((a, b) => {
        const aScore = (a.verificationStatus === "VERIFIED" ? 10 : 0) + (a.version || 1);
        const bScore = (b.verificationStatus === "VERIFIED" ? 10 : 0) + (b.version || 1);
        return bScore - aScore;
      })[0];

      matchedDocs.push({
        vaultDocumentId: best.id,
        requirementCode: config.requirementCode,
        matchType: "AUTO",
        matchConfidence: 0.9,
        matchReason: `Vault document "${best.fileName}" (${best.docType}) matches requirement "${config.requirementTitle}"`,
        docTypeSnapshot: best.docType,
        fileNameSnapshot: best.fileName,
        sha256Snapshot: best.sha256,
        versionSnapshot: best.version,
      });
      matchedCount++;
    } else {
      matchedDocs.push({
        requirementCode: config.requirementCode,
        matchType: "MISSING",
        docTypeSnapshot: allowedTypes[0] || "OTHER",
        fileNameSnapshot: "",
        sha256Snapshot: "",
      });
    }

    // Count form fields
    const formFields = config.formFieldsSchema
      ? (typeof config.formFieldsSchema === "string" ? JSON.parse(config.formFieldsSchema) : config.formFieldsSchema)
      : [];
    formFieldsCount += formFields.length;
  }

  // Persist matched documents
  for (const md of matchedDocs) {
    if (md.matchType === "AUTO" && md.vaultDocumentId) {
      await prisma.applicationDocument.create({
        data: {
          applicationId,
          vaultDocumentId: md.vaultDocumentId,
          requirementCode: md.requirementCode,
          matchType: "AUTO",
          matchConfidence: md.matchConfidence,
          matchReason: md.matchReason,
          docTypeSnapshot: md.docTypeSnapshot,
          fileNameSnapshot: md.fileNameSnapshot,
          sha256Snapshot: md.sha256Snapshot,
          versionSnapshot: md.versionSnapshot,
          status: "ATTACHED",
        },
      });
    }
  }

  // Auto-fill form fields from organization profile
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (org) {
    const autoFillMap: Record<string, string | number | boolean | null> = {
      organization_name: org.legalName, pan: org.pan, gstin: org.gstin,
      udyam_number: org.udyamNumber, address: org.registeredAddress, state: org.state,
      city: org.city, phone: org.phone, annual_turnover: org.annualTurnoverLakh,
      organization_type: org.organizationType, business_category: org.businessCategory,
    };
    for (const config of requirementConfigs) {
      const formFields = config.formFieldsSchema
        ? (typeof config.formFieldsSchema === "string" ? JSON.parse(config.formFieldsSchema) : config.formFieldsSchema)
        : [];
      for (const ff of formFields) {
        const autoValue = autoFillMap[ff.key] ?? autoFillMap[ff.key?.toLowerCase?.()];
        if (autoValue !== undefined && autoValue !== null) {
          formFieldsCompleted++;
          await prisma.applicationFormValue.upsert({
            where: { applicationId_fieldKey: { applicationId, fieldKey: ff.key } },
            update: { fieldValue: String(autoValue), autoFilled: true, autoFillSource: "organization_profile", label: ff.label || ff.key, fieldType: ff.type || "text", required: ff.required || false },
            create: { applicationId, fieldKey: ff.key, fieldValue: String(autoValue), autoFilled: true, autoFillSource: "organization_profile", label: ff.label || ff.key, fieldType: ff.type || "text", required: ff.required || false },
          });
        }
      }
    }
  }

  return { matched: matchedCount, total: requirementConfigs.length, documents: matchedDocs, formFieldsCount, formFieldsCompleted };
}

function calculateProgress(matched: number, total: number, formFields: number, formCompleted: number): number {
  if (total === 0) return 0;
  const docProgress = (matched / total) * 70; // 70% weight for documents
  const formProgress = formFields > 0 ? (formCompleted / formFields) * 30 : 30; // 30% weight for form
  return Math.round(docProgress + formProgress);
}
