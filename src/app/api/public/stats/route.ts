import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/**
 * Public platform stats — no authentication required.
 * Shows live counts for the landing page.
 */
export async function GET() {
  return handle(async () => {
    const [tenderCount, activeTenderCount, bidderCount, bidCount, requirementCount] = await Promise.all([
      prisma.tender.count(),
      prisma.tender.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "BIDDER" } }),
      prisma.bidSubmission.count(),
      prisma.tenderRequirement.count({ where: { status: "APPROVED" } }),
    ]);

    return ok({
      totalTenders: tenderCount,
      activeTenders: activeTenderCount,
      registeredBidders: bidderCount,
      totalBids: bidCount,
      totalRequirements: requirementCount,
    });
  });
}
