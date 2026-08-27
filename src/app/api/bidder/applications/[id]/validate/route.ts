import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** POST — Run pre-submission validation + AI pre-check */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        tender: {
          include: {
            requirementConfigs: { where: { status: "ACTIVE" } },
            requirements: { where: { status: { in: ["APPROVED", "DRAFT"] } } },
          },
        },
        documents: { include: { vaultDocument: true } },
        formValues: true,
        organization: true,
      },
    });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");

    const reqConfigs = app.tender.requirementConfigs.length > 0
      ? app.tender.requirementConfigs
      : app.tender.requirements.map((r) => ({
          id: r.id, requirementCode: r.code, requirementTitle: r.title, requirementType: r.type,
          mandatory: r.mandatory, description: r.description,
          allowedDocTypes: getAllowedDocTypesForRequirement(r.type),
          expiryRequired: false, verificationRequired: false, declarationRequired: false,
        }));

    // Run validation checks
    const checks: any[] = [];
    let allPass = true;

    for (const config of reqConfigs) {
      const allowedTypes: string[] = Array.isArray(config.allowedDocTypes) ? config.allowedDocTypes : (typeof config.allowedDocTypes === "string" ? JSON.parse(config.allowedDocTypes) : []);
      const attachedDocs = app.documents.filter((d) => d.requirementCode === config.requirementCode);

      const check: any = {
        requirementCode: config.requirementCode,
        requirementTitle: (config as any).requirementTitle || (config as any).title,
        requirementType: (config as any).requirementType || (config as any).type,
        mandatory: config.mandatory,
        status: "PASS",
        reason: "",
        evidence: [],
        risk: "LOW",
      };

      if (attachedDocs.length === 0) {
        if (config.mandatory) {
          check.status = "FAIL";
          check.reason = "Required document not attached";
          check.risk = "HIGH";
          allPass = false;
        } else {
          check.status = "OPTIONAL_MISSING";
          check.reason = "Optional document not provided";
        }
      } else {
        // Check document validity
        for (const doc of attachedDocs) {
          const vaultDoc = doc.vaultDocument;
          check.evidence.push({
            fileName: doc.fileNameSnapshot,
            docType: doc.docTypeSnapshot,
            version: doc.versionSnapshot,
            verificationStatus: vaultDoc?.verificationStatus || "NOT_VERIFIED",
          });

          // Check expiry
          if (vaultDoc?.expiryDate && new Date(vaultDoc.expiryDate) < new Date()) {
            check.status = "FAIL";
            check.reason = `Document expired on ${new Date(vaultDoc.expiryDate).toLocaleDateString()}`;
            check.risk = "HIGH";
            allPass = false;
          }

          // Check verification
          if (vaultDoc?.verificationStatus === "FAILED") {
            check.status = "FAIL";
            check.reason = "Document verification failed";
            check.risk = "MEDIUM";
            allPass = false;
          } else if (vaultDoc?.verificationStatus === "NOT_VERIFIED") {
            if (check.status === "PASS") {
              check.status = "WARNING";
              check.reason = "Document not yet verified — review recommended";
              check.risk = "MEDIUM";
            }
          }

          // Check doc type compatibility
          if (allowedTypes.length > 0 && !allowedTypes.includes(doc.docTypeSnapshot)) {
            if (check.status === "PASS") {
              check.status = "WARNING";
              check.reason = `Document type "${doc.docTypeSnapshot}" may not match requirement type "${(config as any).requirementType || (config as any).type}"`;
              check.risk = "MEDIUM";
            }
          }
        }
      }

      checks.push(check);
    }

    // Check form completeness
    const formCheck = {
      status: app.formValues.filter((fv) => fv.required && fv.fieldValue === "").length === 0 ? "PASS" : "WARNING",
      totalFields: app.formValues.length,
      completedFields: app.formValues.filter((fv) => fv.fieldValue !== "").length,
      missingRequired: app.formValues.filter((fv) => fv.required && fv.fieldValue === "").map((fv) => fv.label || fv.fieldKey),
    };

    // Check declarations
    const declarations = app.declarationSnapshot ? JSON.parse(String(app.declarationSnapshot)) : {};
    const declarationCheck = {
      status: Object.values(declarations).every((v) => v === true || v === "true") ? "PASS" : "WARNING",
      accepted: Object.values(declarations).filter((v) => v === true || v === "true").length,
      total: Object.keys(declarations).length,
    };

    // Overall assessment
    const failCount = checks.filter((c) => c.status === "FAIL").length;
    const warningCount = checks.filter((c) => c.status === "WARNING").length;

    const overallStatus = failCount > 0 ? "NOT_READY" : warningCount > 0 ? "READY_WITH_WARNINGS" : "READY_TO_SUBMIT";
    const overallMessage = failCount > 0
      ? `${failCount} mandatory requirement(s) not met. Please address the issues below before submitting.`
      : warningCount > 0
        ? `All mandatory requirements met, but ${warningCount} item(s) need attention. You may proceed with caution.`
        : "All requirements satisfied. Your application is ready to submit!";

    await audit({ actor: session, action: "APPLICATION_VALIDATED", entityType: "Application", entityId: id, after: { overallStatus, failCount, warningCount } });

    return ok({
      overallStatus,
      overallMessage,
      requirementChecks: checks,
      formCheck,
      declarationCheck,
      canSubmit: failCount === 0,
    });
  });
}

function getAllowedDocTypesForRequirement(requirementType: string): string[] {
  const mapping: Record<string, string[]> = {
    GST_REGISTRATION: ["GST_CERTIFICATE"], PAN: ["PAN_CARD"], UDYAM: ["UDYAM_CERTIFICATE"],
    OEM_AUTHORIZATION: ["OEM_AUTHORIZATION"], EXPERIENCE: ["EXPERIENCE_CERTIFICATE"],
    TURNOVER: ["TURNOVER_PROOF"], LOCAL_CONTENT: ["LOCAL_CONTENT_DECLARATION"],
    TECHNICAL_SPEC: ["TECHNICAL_DATASHEET"], CERTIFICATE: ["COMPANY_CERTIFICATE"],
    DECLARATION: ["COMPANY_CERTIFICATE", "OTHER"], STATUTORY: ["COMPANY_CERTIFICATE"],
    EMD: ["COMPANY_CERTIFICATE"], FINANCIAL: ["TURNOVER_PROOF"],
    BIS_CERTIFICATION: ["COMPANY_CERTIFICATE"], ORGANIZATION: ["COMPANY_CERTIFICATE"],
    OTHER: ["OTHER", "UNKNOWN"],
  };
  return mapping[requirementType] || ["OTHER", "UNKNOWN"];
}
