import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

/** GET — Fetch bid details for the bidder (must own the bid) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const bid = await prisma.bidSubmission.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, legalName: true, gstin: true, pan: true, udyamNumber: true, isMsme: true } },
        documents: { orderBy: { createdAt: "asc" } },
        complianceResults: { include: { requirement: true } },
      },
    });
    if (!bid) return { ok: false, error: "Bid not found", status: 404 } as any;
    if (bid.organizationId !== session.organizationId) return { ok: false, error: "Access denied", status: 403 } as any;

    const tender = await prisma.tender.findUnique({ where: { id: bid.tenderId }, select: { id: true, tenderNumber: true, title: true, buyerOrganization: true, closingDate: true } });

    return ok({ bid, tender });
  });
}
