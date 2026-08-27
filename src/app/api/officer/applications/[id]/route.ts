import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { OFFICER_ROLES } from "@/lib/roles";

/** GET — Get full application details for officer review */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    if (!OFFICER_ROLES.includes(session.role)) return fail(403, "Officer access required");

    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        tender: {
          include: {
            requirementConfigs: true,
            requirements: { where: { status: { in: ["APPROVED", "DRAFT"] } } },
          },
        },
        organization: true,
        user: { select: { name: true, email: true, phone: true } },
        documents: {
          include: {
            vaultDocument: {
              include: {
                extractions: { select: { field: true, value: true, confidence: true, source: true } },
                organization: { select: { legalName: true } },
              },
            },
          },
        },
        formValues: true,
      },
    });
    if (!app) return fail(404, "Application not found");

    await audit({ actor: session, action: "OFFICER_VIEWED_APPLICATION", entityType: "Application", entityId: id });

    // Get related bid submission if exists
    let bidSubmission = null;
    if (app.bidSubmissionId) {
      bidSubmission = await prisma.bidSubmission.findUnique({
        where: { id: app.bidSubmissionId },
        include: {
          documents: { include: { fields: true } },
          complianceResults: { include: { requirement: true } },
          risks: true,
          anomalies: true,
        },
      });
    }

    // Requirement matching analysis
    const reqConfigs = app.tender.requirementConfigs.length > 0
      ? app.tender.requirementConfigs
      : app.tender.requirements.map((r) => ({
          requirementCode: r.code,
          requirementTitle: r.title,
          requirementType: r.type,
          mandatory: r.mandatory,
          description: r.description,
        }));

    const analysis = reqConfigs.map((config: any) => {
      const code = config.requirementCode || config.code;
      const attached = app.documents.filter((d) => d.requirementCode === code);
      return {
        requirementCode: code,
        requirementTitle: config.requirementTitle || config.title,
        requirementType: config.requirementType || config.type,
        mandatory: config.mandatory,
        description: config.description,
        documentsAttached: attached.length,
        documents: attached.map((d) => ({
          id: d.id,
          fileName: d.fileNameSnapshot,
          docType: d.docTypeSnapshot,
          matchType: d.matchType,
          verificationStatus: d.vaultDocument?.verificationStatus || "NOT_VERIFIED",
          expiryDate: d.vaultDocument?.expiryDate,
          extractedFields: d.vaultDocument?.extractions?.map((e) => ({ field: e.field, value: e.value, confidence: e.confidence })) || [],
        })),
        status: attached.length > 0 ? "SUBMITTED" : config.mandatory ? "MISSING" : "NOT_PROVIDED",
      };
    });

    // Profile snapshot
    const profileSnapshot = app.profileSnapshot ? (typeof app.profileSnapshot === "string" ? JSON.parse(app.profileSnapshot) : app.profileSnapshot) : {};

    // Form values
    const formValues = app.formValues.map((fv) => ({
      key: fv.fieldKey,
      value: fv.fieldValue,
      label: fv.label,
      autoFilled: fv.autoFilled,
      required: fv.required,
    }));

    // Declarations
    const declarations = app.declarationSnapshot
      ? (typeof app.declarationSnapshot === "string" ? JSON.parse(app.declarationSnapshot) : app.declarationSnapshot)
      : {};

    return ok({
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        status: app.status,
        progressPercent: app.progressPercent,
        submittedAt: app.submittedAt,
        createdAt: app.createdAt,
      },
      tender: {
        id: app.tender.id,
        tenderNumber: app.tender.tenderNumber,
        title: app.tender.title,
        buyerOrganization: app.tender.buyerOrganization,
        closingDate: app.tender.closingDate,
      },
      bidder: {
        organizationId: app.organizationId,
        legalName: app.organization.legalName,
        pan: app.organization.pan,
        gstin: app.organization.gstin,
        udyamNumber: app.organization.udyamNumber,
        city: app.organization.city,
        state: app.organization.state,
        isMsme: app.organization.isMsme,
        isStartup: app.organization.isStartup,
        contactName: app.user.name,
        contactEmail: app.user.email,
        contactPhone: app.user.phone,
      },
      requirementAnalysis: analysis,
      profileSnapshot,
      formValues,
      declarations,
      documents: app.documents.map((d) => ({
        id: d.id,
        fileName: d.fileNameSnapshot,
        docType: d.docTypeSnapshot,
        requirementCode: d.requirementCode,
        matchType: d.matchType,
        status: d.status,
        vaultDocument: d.vaultDocument ? {
          id: d.vaultDocument.id,
          sha256: d.vaultDocument.sha256,
          version: d.vaultDocument.version,
          verificationStatus: d.vaultDocument.verificationStatus,
          expiryDate: d.vaultDocument.expiryDate,
          extractions: d.vaultDocument.extractions,
        } : null,
      })),
      bidSubmission: bidSubmission ? {
        id: bidSubmission.id,
        bidNumber: bidSubmission.bidNumber,
        complianceScore: bidSubmission.complianceScore,
        riskLevel: bidSubmission.riskLevel,
        officerDecision: bidSubmission.officerDecision,
        complianceResults: bidSubmission.complianceResults,
        risks: bidSubmission.risks,
        anomalies: bidSubmission.anomalies,
      } : null,
    });
  });
}
