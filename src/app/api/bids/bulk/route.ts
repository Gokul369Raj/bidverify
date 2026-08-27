import { runVerificationPipeline } from "@/lib/engine/pipeline";
import { requireOfficer } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Bulk verification endpoint — triggers verification for multiple bids at once. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireOfficer();
    const { bidIds } = await req.json();

    if (!bidIds || !Array.isArray(bidIds) || bidIds.length === 0) {
      return fail(400, "bidIds array is required");
    }
    if (bidIds.length > 50) {
      return fail(400, "Maximum 50 bids can be verified at once");
    }

    const results: any[] = [];
    for (const bidId of bidIds) {
      try {
        // Update status to under verification
        await prisma.bidSubmission.update({
          where: { id: bidId },
          data: { status: "UNDER_VERIFICATION" },
        });

        // Run verification pipeline for each bid
        const result = await runVerificationPipeline(bidId, session);
        results.push({
          bidId,
          complianceScore: result.complianceScore,
          riskLevel: result.riskLevel,
          status: "COMPLETED",
        });

        // Notify bidder
        const bid = await prisma.bidSubmission.findUnique({ where: { id: bidId } });
        const bidderUsers = await prisma.user.findMany({ where: { organizationId: bid?.organizationId } });
        for (const u of bidderUsers) {
          await prisma.notification.create({
            data: {
              userId: u.id,
              title: `Verification complete — Bid ${bidId}`,
              body: `Compliance score ${result.complianceScore}/100 · Risk ${result.riskLevel}.`,
              kind: result.complianceScore >= 70 ? "SUCCESS" : "WARNING",
              link: `/bidder/bids/${bidId}`,
            },
          });
        }

        await audit({
          actor: session,
          action: "BULK_VERIFICATION_COMPLETED",
          entityType: "BidSubmission",
          entityId: bidId,
          after: { complianceScore: result.complianceScore, risk: result.riskLevel },
        });
      } catch (err) {
        results.push({
          bidId,
          error: err instanceof Error ? err.message : "Verification failed",
          status: "FAILED",
        });
      }
    }

    return ok({ results, total: bidIds.length, completed: results.filter((r) => r.status === "COMPLETED").length });
  });
}