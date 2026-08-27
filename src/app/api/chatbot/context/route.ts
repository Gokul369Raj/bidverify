import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

/** GET — Return full context for the chatbot about the logged-in user */
export async function GET() {
  return handle(async () => {
    const session = await requireSession();

    // Organization
    const org = session.organizationId
      ? await prisma.organization.findUnique({ where: { id: session.organizationId } })
      : null;

    // Applications with tender info and documents
    const applications = session.organizationId
      ? await prisma.application.findMany({
          where: { organizationId: session.organizationId },
          include: {
            tender: { select: { id: true, tenderNumber: true, title: true, buyerOrganization: true, closingDate: true, status: true } },
            documents: { select: { id: true, requirementCode: true, matchType: true, status: true, fileNameSnapshot: true, docTypeSnapshot: true } },
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

    // Bids with tender, documents, compliance
    const bids = session.organizationId
      ? await prisma.bidSubmission.findMany({
          where: { organizationId: session.organizationId },
          include: {
            tender: { select: { tenderNumber: true, title: true } },
            documents: { select: { id: true, fileName: true, status: true, docType: true } },
            complianceResults: { include: { requirement: { select: { title: true, code: true } } } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Vault documents
    const vaultDocs = session.organizationId
      ? await prisma.documentVault.findMany({
          where: { organizationId: session.organizationId, isActive: true },
          select: { id: true, fileName: true, docType: true, verificationStatus: true, intelligenceScore: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : [];

    // Notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: session.userId },
      select: { id: true, title: true, body: true, read: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Compliance summary
    const complianceResults = bids.flatMap((b) =>
      b.complianceResults.map((cr) => ({
        bidNumber: b.bidNumber,
        tenderNumber: b.tender?.tenderNumber,
        requirement: cr.requirement?.title || cr.ruleCode,
        result: cr.result,
        explanation: cr.explanation,
      }))
    );

    return ok({
      user: { name: session.name, email: session.email, role: session.role },
      organization: org ? {
        legalName: org.legalName, gstin: org.gstin, pan: org.pan, udyamNumber: org.udyamNumber,
        state: org.state, city: org.city, isMsme: org.isMsme, businessCategory: org.businessCategory,
      } : null,
      applications: applications.map((a) => ({
        id: a.id, number: a.applicationNumber, status: a.status, progress: a.progressPercent,
        tenderNumber: a.tender?.tenderNumber, tenderTitle: a.tender?.title,
        documentsAttached: a.documents.length,
        requiredDocs: a.documents.map((d) => ({ code: d.requirementCode, file: d.fileNameSnapshot, type: d.docTypeSnapshot, status: d.status })),
      })),
      bids: bids.map((b) => ({
        id: b.id, number: b.bidNumber, status: b.status, decision: b.officerDecision, decisionNotes: b.decisionNotes,
        complianceScore: b.complianceScore, riskLevel: b.riskLevel,
        tenderNumber: b.tender?.tenderNumber, tenderTitle: b.tender?.title,
        documents: b.documents.map((d) => ({ name: d.fileName, type: d.docType, verification: d.status })),
        complianceChecks: b.complianceResults.map((cr) => ({
          requirement: cr.requirement?.title || cr.ruleCode, status: cr.result, notes: cr.explanation,
        })),
      })),
      vaultDocuments: vaultDocs.map((v) => ({
        name: v.fileName, type: v.docType, verification: v.verificationStatus, score: v.intelligenceScore, status: v.status,
      })),
      notifications: notifications.map((n) => ({ title: n.title, body: n.body, read: n.read, date: n.createdAt })),
      stats: {
        totalApplications: applications.length,
        submittedApplications: applications.filter((a) => a.status === "SUBMITTED").length,
        totalBids: bids.length,
        totalVaultDocs: vaultDocs.length,
        verifiedVaultDocs: vaultDocs.filter((v) => v.verificationStatus === "VERIFIED").length,
        unreadNotifications: notifications.filter((n) => !n.read).length,
      },
    });
  });
}
