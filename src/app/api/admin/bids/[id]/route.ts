import { prisma } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api";

/**
 * GET — Full bid detail for admin review page.
 * Returns bidder info, tender details, all documents with extractions,
 * compliance results, and requirement matching.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;

    const bid = await prisma.bidSubmission.findUnique({
      where: { id },
      include: {
        organization: true,
        tender: {
          include: {
            requirements: {
              select: { id: true, code: true, type: true, title: true, mandatory: true, status: true, description: true },
            },
            requirementConfigs: { where: { status: "ACTIVE" } },
          },
        },
        documents: {
          include: {
            fields: { select: { field: true, value: true, confidence: true, source: true } },
          },
        },
        complianceResults: true,
        verifications: true,
        application: {
          include: {
            user: { select: { id: true, name: true, email: true, phone: true } },
            documents: {
              include: {
                vaultDocument: {
                  include: {
                    extractions: { select: { field: true, value: true, confidence: true } },
                  },
                },
              },
            },
            formValues: true,
          },
        },
      },
    });

    if (!bid) return fail(404, "Bid not found");

    const appUser = bid.application?.user;

    // Build the requirement matching from the application
    const appDocs = bid.application?.documents ?? [];

    // Map BidDocuments to their vault scores via ApplicationDocument
    const vaultScoreMap = new Map<string, number | null>();
    for (const ad of appDocs) {
      if (ad.vaultDocument?.storagePath && ad.vaultDocument?.intelligenceScore != null) {
        vaultScoreMap.set(ad.vaultDocument.storagePath, ad.vaultDocument.intelligenceScore);
      }
    }
    const reqConfigs = bid.tender.requirementConfigs.length > 0
      ? bid.tender.requirementConfigs
      : bid.tender.requirements.map((r: any) => ({
          id: r.id,
          requirementCode: r.code,
          requirementTitle: r.title,
          requirementType: r.type,
          mandatory: r.mandatory,
          description: r.description,
        }));

    const requirementMatchings = reqConfigs.map((config: any) => {
      const code = config.requirementCode || config.code;
      const attached = appDocs.filter((d: any) => d.requirementCode === code);
      return {
        requirementCode: code,
        requirementTitle: config.requirementTitle || config.title || "",
        requirementType: config.requirementType || config.type,
        mandatory: config.mandatory,
        description: config.description || "",
        hasDocuments: attached.length > 0,
        missing: config.mandatory && attached.length === 0,
        documents: attached.map((d: any) => ({
          id: d.id,
          fileName: d.fileNameSnapshot || d.uploadedFileName || "Unknown",
          docType: d.docTypeSnapshot,
          matchType: d.matchType,
          status: d.status,
          vaultDocId: d.vaultDocumentId,
          vaultScore: d.vaultDocument?.intelligenceScore,
          vaultVerification: d.vaultDocument?.verificationStatus,
          extractions: d.vaultDocument?.extractions ?? [],
        })),
      };
    });

    // Profile auto-fill data
    const profileAutoFill = {
      legalName: bid.organization.legalName,
      pan: bid.organization.pan,
      gstin: bid.organization.gstin,
      udyamNumber: bid.organization.udyamNumber,
      cin: bid.organization.cin,
      registeredAddress: bid.organization.registeredAddress,
      state: bid.organization.state,
      organizationType: bid.organization.organizationType,
      businessCategory: bid.organization.businessCategory,
      annualTurnoverLakh: bid.organization.annualTurnoverLakh,
      isMsme: bid.organization.isMsme,
    };

    // Form values
    const formValues = (bid.application?.formValues ?? []).map((fv: any) => ({
      key: fv.fieldKey,
      value: fv.fieldValue,
      label: fv.label,
      autoFilled: fv.autoFilled,
      required: fv.required,
    }));

    return ok({
      bid: {
        id: bid.id,
        bidNumber: bid.bidNumber,
        status: bid.status,
        complianceScore: bid.complianceScore,
        riskLevel: bid.riskLevel,
        riskScore: bid.riskScore,
        officerDecision: bid.officerDecision,
        decisionNotes: bid.decisionNotes,
        decisionAt: bid.decisionAt,
        aiRecommendation: bid.aiRecommendation,
        submittedAt: bid.submittedAt,
        createdAt: bid.createdAt,
      },
      bidder: {
        userId: appUser?.id,
        name: appUser?.name ?? bid.organization.legalName,
        email: appUser?.email ?? "Unknown",
        phone: appUser?.phone,
      },
      organization: profileAutoFill,
      tender: {
        id: bid.tender.id,
        tenderNumber: bid.tender.tenderNumber,
        title: bid.tender.title,
        description: bid.tender.description,
        category: bid.tender.category,
        estimatedValueLakh: bid.tender.estimatedValueLakh,
        closingDate: bid.tender.closingDate,
        status: bid.tender.status,
      },
      documents: bid.documents.map((d: any) => ({
        id: d.id,
        docType: d.docType,
        docTypeSource: d.docTypeSource,
        fileName: d.fileName,
        fileType: d.fileType,
        fileSize: d.fileSize,
        storagePath: d.storagePath,
        sha256: d.sha256,
        status: d.status,
        score: vaultScoreMap.get(d.storagePath) ?? null,
        classificationConfidence: d.classificationConfidence,
        processingError: d.processingError,
        extractedFields: d.fields.map((f: any) => ({
          field: f.field,
          value: f.value,
          confidence: f.confidence,
          source: f.source,
        })),
      })),
      requirementMatchings,
      formValues,
      complianceResults: bid.complianceResults,
      verificationResults: bid.verifications,
    });
  });
}
