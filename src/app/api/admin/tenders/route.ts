import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/**
 * Admin tenders — returns all tenders with bids for the admin panel.
 * No auth required — AdminGate handles access control.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "";
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;

    const tenders = await prisma.tender.findMany({
      where,
      include: {
        requirements: { select: { id: true, code: true, type: true, title: true, mandatory: true, status: true, description: true } },
        bids: {
          select: {
            id: true, bidNumber: true, status: true, complianceScore: true, riskLevel: true, officerDecision: true, createdAt: true,
            organization: { select: { legalName: true, gstin: true } },
            _count: { select: { documents: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { requirements: true, bids: true } },
      },
      orderBy: { publishDate: "desc" },
      take: limit,
    });

    const formatted = tenders.map((t) => ({
      id: t.id,
      tenderNumber: t.tenderNumber,
      title: t.title,
      description: t.description,
      buyerOrganization: t.buyerOrganization,
      category: t.category,
      state: t.state,
      city: t.city,
      closingDate: t.closingDate,
      status: t.status,
      estimatedValueLakh: t.estimatedValueLakh,
      requirementCount: t._count.requirements,
      bidCount: t._count.bids,
      requirements: t.requirements,
      bids: t.bids.map((b) => ({
        id: b.id,
        bidNumber: b.bidNumber,
        status: b.status,
        complianceScore: b.complianceScore,
        riskLevel: b.riskLevel,
        officerDecision: b.officerDecision,
        organization: b.organization,
        documentCount: b._count.documents,
        createdAt: b.createdAt,
      })),
    }));

    return ok({ tenders: formatted });
  });
}
