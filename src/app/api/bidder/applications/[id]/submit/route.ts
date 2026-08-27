import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** POST — Submit the application. Creates bid + attaches documents + runs verification. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");
    const { id } = await ctx.params;

    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        tender: true,
        organization: true,
        documents: { include: { vaultDocument: true } },
        formValues: true,
      },
    });
    if (!app) return fail(404, "Application not found");
    if (app.organizationId !== session.organizationId) return fail(403, "Access denied");
    if (app.status === "SUBMITTED" || app.status === "UNDER_REVIEW" || app.status === "DECIDED") {
      return fail(409, "Application already submitted");
    }

    // Final validation is done via /validate endpoint before submission

    // Create or reuse bid submission
    let bid = await prisma.bidSubmission.findUnique({
      where: { tenderId_organizationId: { tenderId: app.tenderId, organizationId: app.organizationId } },
    });

    if (!bid) {
      const count = await prisma.bidSubmission.count();
      bid = await prisma.bidSubmission.create({
        data: {
          tenderId: app.tenderId,
          organizationId: app.organizationId,
          bidNumber: `BID/2026/${String(count + 1001).padStart(5, "0")}`,
          status: "DRAFT",
        },
      });
    }

    // Update application with snapshots
    await prisma.application.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        bidSubmissionId: bid.id,
        profileSnapshot: JSON.stringify({
          legalName: app.organization.legalName, pan: app.organization.pan, gstin: app.organization.gstin,
          udyamNumber: app.organization.udyamNumber, registeredAddress: app.organization.registeredAddress,
          state: app.organization.state, city: app.organization.city,
        }),
        formValuesSnapshot: JSON.stringify(
          Object.fromEntries(app.formValues.map((fv) => [fv.fieldKey, fv.fieldValue]))
        ),
      },
    });

    // Copy documents from application to bid submission
    for (const appDoc of app.documents) {
      if (appDoc.vaultDocumentId && appDoc.vaultDocument) {
        // Copy vault document to bid
        const vaultDoc = appDoc.vaultDocument;
        const bidDoc = await prisma.bidDocument.create({
          data: {
            submissionId: bid.id,
            organizationId: app.organizationId,
            docType: appDoc.docTypeSnapshot,
            docTypeSource: "USER",
            fileName: appDoc.fileNameSnapshot,
            fileType: vaultDoc.fileType,
            fileSize: vaultDoc.fileSize,
            storagePath: vaultDoc.storagePath,
            sha256: appDoc.sha256Snapshot || vaultDoc.sha256,
            status: "UPLOADED",
            uploadedById: session.userId,
          },
        });
      } else if (appDoc.uploadedStoragePath) {
        // Copy directly uploaded document
        await prisma.bidDocument.create({
          data: {
            submissionId: bid.id,
            organizationId: app.organizationId,
            docType: appDoc.docTypeSnapshot,
            docTypeSource: "USER",
            fileName: appDoc.fileNameSnapshot,
            fileType: appDoc.uploadedFileType || "application/octet-stream",
            fileSize: appDoc.uploadedFileSize || 0,
            storagePath: appDoc.uploadedStoragePath,
            sha256: appDoc.uploadedSha256 || "",
            status: "UPLOADED",
            uploadedById: session.userId,
          },
        });
      }
    }

    // Update bid status
    await prisma.bidSubmission.update({
      where: { id: bid.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    await audit({ actor: session, action: "APPLICATION_SUBMITTED", entityType: "Application", entityId: id, after: { bidNumber: bid.bidNumber, tender: app.tender.tenderNumber, documents: app.documents.length } });

    // Send notifications
    const progressSteps = [
      `✅ Step 1: Application Submitted — ${app.applicationNumber}`,
      `📋 Step 2: ${app.documents.length} document(s) attached`,
      `⏳ Step 3: AI Compliance Verification — analyzing documents against tender requirements`,
      `⏳ Step 4: Officer Review — procurement officer will review and make decision`,
    ];

    await prisma.notification.create({
      data: {
        userId: session.userId,
        title: `Application Submitted — ${app.tender.tenderNumber}`,
        body: `Your application ${app.applicationNumber} for "${app.tender.title}" has been submitted.\n\n📋 Progress Tracker:\n${progressSteps.join("\n")}\n\nDocuments: ${app.documents.length} attached\nOrganization: ${app.organization.legalName}\n\nWe will notify you at each stage.`,
        kind: "SUCCESS",
        link: "/bidder/applications",
      },
    });

    return ok({
      submitted: true,
      applicationNumber: app.applicationNumber,
      bidNumber: bid.bidNumber,
      documentsAttached: app.documents.length,
    });
  });
}
