import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { OFFICER_ROLES } from "@/lib/roles";

/**
 * GET — Fetch bid details.
 *
 * Bidders may only read their own organisation's bids. Officers (procurement,
 * evaluation, compliance, audit, admin) may read any bid, because the
 * verification and comparison screens are built on this payload.
 */
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

    if (!bid) return fail(404, "Bid not found");

    const isOfficer = OFFICER_ROLES.includes(session.role);
    if (!isOfficer && bid.organizationId !== session.organizationId) {
      return fail(403, "You do not have access to this bid");
    }

    const tender = await prisma.tender.findUnique({
      where: { id: bid.tenderId },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        buyerOrganization: true,
        closingDate: true,
        // Required by the requirement-wise compliance comparison view.
        requirements: {
          select: { id: true, code: true, type: true, title: true, mandatory: true },
        },
      },
    });

    return ok({ bid, tender });
  });
}
