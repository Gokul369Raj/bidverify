import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** POST — Withdraw a bid submission */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const bid = await prisma.bidSubmission.findUnique({ where: { id }, include: { tender: true, organization: true } });
    if (!bid) return fail(404, "Bid not found");
    if (bid.organizationId !== session.organizationId) return fail(403, "Access denied");
    if (bid.status === "WITHDRAWN") return fail(409, "Bid already withdrawn");
    if (bid.status === "DECIDED") return fail(409, "Cannot withdraw — bid already decided");

    await prisma.bidSubmission.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });

    await audit({
      actor: session, action: "BID_WITHDRAWN", entityType: "BidSubmission", entityId: id,
      after: { bidNumber: bid.bidNumber, tender: bid.tender.tenderNumber },
    });

    // Notify officers
    const officers = await prisma.user.findMany({ where: { role: { in: ["PROCUREMENT_OFFICER", "SUPER_ADMIN"] } } });
    for (const u of officers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: `Bid Withdrawn — ${bid.tender.tenderNumber}`,
          body: `${bid.organization.legalName} withdrew their bid (${bid.bidNumber}) for "${bid.tender.title}".`,
          kind: "WARNING",
          link: "/officer",
        },
      });
    }

    return ok({ withdrawn: true });
  });
}
