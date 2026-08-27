import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/** GET — Admin view of all vault documents with user details.
 *  No auth required — AdminGate handles access control. */
export async function GET(req: Request) {
  return handle(async () => {

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const docType = url.searchParams.get("docType");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("q");

    const where: any = { isActive: true };
    if (userId) where.uploadedById = userId;
    if (docType) where.docType = docType;
    if (status) where.status = status;

    const documents = await prisma.documentVault.findMany({
      where,
      include: {
        organization: { select: { id: true, legalName: true, gstin: true, pan: true, udyamNumber: true, registeredAddress: true, state: true, annualTurnoverLakh: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        extractions: { select: { field: true, value: true, confidence: true, source: true } },
        _count: { select: { versions: true, applications: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Search filter
    let filtered = documents;
    if (search) {
      const q = search.toLowerCase();
      filtered = documents.filter(d =>
        d.fileName.toLowerCase().includes(q) ||
        d.docType.toLowerCase().includes(q) ||
        (d.organization?.legalName || "").toLowerCase().includes(q) ||
        (d.uploadedBy?.name || "").toLowerCase().includes(q) ||
        (d.uploadedBy?.email || "").toLowerCase().includes(q) ||
        (d.gstin || "").toLowerCase().includes(q) ||
        (d.pan || "").toLowerCase().includes(q)
      );
    }

    // Enrich with expiry status and intelligence data
    const now = new Date();
    const enriched = filtered.map(doc => {
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
        intelligenceScore: doc.intelligenceScore ?? null,
        intelligenceData: doc.intelligenceJson ? JSON.parse(doc.intelligenceJson) : null,
      };
    });

    // Get all users for the filter
    const users = await prisma.user.findMany({
      where: { role: "BIDDER" },
      select: { id: true, name: true, email: true, organizationId: true },
      orderBy: { name: "asc" },
    });

    // Build per-user summary
    const userSummaries = users.map(u => {
      const userDocs = enriched.filter(d => d.uploadedById === u.id);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        organizationId: u.organizationId,
        totalDocs: userDocs.length,
        verified: userDocs.filter(d => d.verificationStatus === "VERIFIED").length,
        processed: userDocs.filter(d => d.status === "PROCESSED").length,
        failed: userDocs.filter(d => d.status === "FAILED").length,
        expired: userDocs.filter(d => d.expiryStatus === "EXPIRED").length,
        expiring: userDocs.filter(d => d.expiryStatus === "EXPIRING_7D" || d.expiryStatus === "EXPIRING_30D").length,
        needsReview: userDocs.filter(d => d.status === "NEEDS_REVIEW").length,
        docTypes: [...new Set(userDocs.map(d => d.docType))],
      };
    }).filter(u => u.totalDocs > 0);

    // Stats
    const stats = {
      total: enriched.length,
      verified: enriched.filter(d => d.verificationStatus === "VERIFIED").length,
      processed: enriched.filter(d => d.status === "PROCESSED").length,
      failed: enriched.filter(d => d.status === "FAILED").length,
      expired: enriched.filter(d => d.expiryStatus === "EXPIRED").length,
      expiring: enriched.filter(d => d.expiryStatus === "EXPIRING_7D" || d.expiryStatus === "EXPIRING_30D").length,
      needsReview: enriched.filter(d => d.status === "NEEDS_REVIEW").length,
      byDocType: enriched.reduce((acc: Record<string, number>, d) => {
        acc[d.docType] = (acc[d.docType] || 0) + 1;
        return acc;
      }, {}),
    };

    return ok({ documents: enriched, userSummaries, stats, users });
  });
}
