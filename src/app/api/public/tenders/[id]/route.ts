import { prisma } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api";

/**
 * Public tender detail — no authentication required.
 * Shows requirements and eligibility but hides internal compliance data.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        requirements: {
          where: { status: "APPROVED" },
          select: { id: true, code: true, type: true, title: true, description: true, mandatory: true, evidenceRequired: true, paramsJson: true },
        },
        documents: { select: { id: true, fileName: true, fileType: true, fileSize: true, docKind: true } },
        _count: { select: { bids: true } },
      },
    });
    if (!tender) return fail(404, "Tender not found");

    return ok({
      id: tender.id,
      tenderNumber: tender.tenderNumber,
      title: tender.title,
      description: tender.description,
      buyerOrganization: tender.buyerOrganization,
      department: tender.department,
      category: tender.category,
      state: tender.state,
      city: tender.city,
      publishDate: tender.publishDate,
      closingDate: tender.closingDate,
      estimatedValueLakh: tender.estimatedValueLakh,
      emdAmount: tender.emdAmount,
      status: tender.status,
      dataLabel: tender.dataLabel,
      requirements: tender.requirements,
      documents: tender.documents,
      bidCount: tender._count.bids,
    });
  });
}
