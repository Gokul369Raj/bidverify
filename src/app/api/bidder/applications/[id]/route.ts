import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** GET — Get full application details */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
        organization: { select: { id: true, legalName: true, pan: true, gstin: true, udyamNumber: true, cin: true, registeredAddress: true, state: true, city: true, phone: true, organizationType: true, businessCategory: true } },
        documents: {
          include: {
            vaultDocument: { include: { extractions: { select: { field: true, value: true, confidence: true } } } },
          },
        },
        formValues: true,
      },
    });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");

    // Enrich with requirement matching info
    const reqConfigs = app.tender.requirementConfigs.length > 0
      ? app.tender.requirementConfigs
      : app.tender.requirements.map((r) => ({
          id: r.id, requirementCode: r.code, requirementTitle: r.title, requirementType: r.type,
          mandatory: r.mandatory, description: r.description,
          allowedDocTypes: getAllowedDocTypesForRequirement(r.type),
          expiryRequired: false, verificationRequired: false, declarationRequired: false,
          formFieldsSchema: [],
        }));

    // Filter out documents whose vault doc was deleted
    app.documents = app.documents.filter((d: any) => !d.vaultDocumentId || d.vaultDocument?.isActive);

    const enrichedReqs = reqConfigs.map((config: any) => {
      const attached = app.documents.filter((d) => d.requirementCode === config.requirementCode);
      const allowedTypes: string[] = Array.isArray(config.allowedDocTypes) ? config.allowedDocTypes : (typeof config.allowedDocTypes === "string" ? JSON.parse(config.allowedDocTypes) : []);
      return {
        ...config,
        attachedDocuments: attached,
        hasDocuments: attached.length > 0,
        missing: config.mandatory && attached.length === 0,
        expired: attached.some((a: any) => {
          if (!a.vaultDocument?.expiryDate) return false;
          return new Date(a.vaultDocument.expiryDate) < new Date();
        }),
      };
    });

    // Overall status
    const mandatoryReqs = enrichedReqs.filter((r: any) => r.mandatory);
    const missingMandatory = mandatoryReqs.filter((r: any) => r.missing);
    const allComplete = missingMandatory.length === 0;

    // Auto-fill status
    const formValues = app.formValues;
    const org = app.organization;
    const profileFields = {
      legalName: org?.legalName || "",
      pan: org?.pan || "",
      gstin: org?.gstin || "",
      udyamNumber: org?.udyamNumber || "",
      cin: org?.cin || "",
      registeredAddress: org?.registeredAddress || "",
      state: org?.state || "",
      city: org?.city || "",
      phone: org?.phone || "",
      organizationType: org?.organizationType || "",
      businessCategory: org?.businessCategory || "",
    };

    return ok({
      application: app,
      requirementMatchings: enrichedReqs,
      stats: {
        totalRequirements: enrichedReqs.length,
        mandatoryRequirements: mandatoryReqs.length,
        missingMandatory: missingMandatory.length,
        documentsAttached: app.documents.length,
        allComplete,
        progressPercent: app.progressPercent,
      },
      profileAutoFill: profileFields,
      formValues: formValues.map((fv) => ({
        key: fv.fieldKey,
        value: fv.fieldValue,
        label: fv.label,
        autoFilled: fv.autoFilled,
        autoFillSource: fv.autoFillSource,
        required: fv.required,
        fieldType: fv.fieldType,
      })),
    });
  });
}

/** POST — Update form values or declarations */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");
    if (app.status !== "DRAFT" && app.status !== "IN_PROGRESS") return fail(409, "Application is no longer editable");

    const body = await req.json();
    
    // Update form values
    if (body.formValues && typeof body.formValues === "object") {
      for (const [key, value] of Object.entries(body.formValues)) {
        await prisma.applicationFormValue.upsert({
          where: { applicationId_fieldKey: { applicationId: id, fieldKey: key } },
          update: { fieldValue: String(value), autoFilled: false },
          create: { applicationId: id, fieldKey: key, fieldValue: String(value), autoFilled: false, label: key, fieldType: "text" },
        });
      }
    }

    // Update declarations
    if (body.declarations && typeof body.declarations === "object") {
      await prisma.application.update({ where: { id }, data: { declarationSnapshot: JSON.stringify(body.declarations) } });
    }

    // Recalculate progress
    const docs = await prisma.applicationDocument.findMany({ where: { applicationId: id } });
    const formValuesCount = await prisma.applicationFormValue.count({ where: { applicationId: id } });
    const formValuesCompleted = await prisma.applicationFormValue.count({ where: { applicationId: id, fieldValue: { not: "" } } });
    const progress = Math.round(((docs.length / Math.max(1, 10)) * 70) + ((formValuesCompleted / Math.max(1, formValuesCount)) * 30));

    await prisma.application.update({ where: { id }, data: { status: "IN_PROGRESS", progressPercent: progress } });

    await audit({ actor: session, action: "APPLICATION_UPDATED", entityType: "Application", entityId: id });

    return ok({ updated: true, progressPercent: progress });
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
