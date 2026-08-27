import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** Bidder starts (or fetches) their draft bid for a tender. */
export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) return fail(400, "Complete your organization profile first");
    const { tenderId } = await req.json();
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender || tender.status !== "ACTIVE") return fail(404, "Tender not available for bidding");

    const existing = await prisma.bidSubmission.findUnique({
      where: { tenderId_organizationId: { tenderId, organizationId: session.organizationId } },
    });
    if (existing) return ok({ bidId: existing.id, existing: true });

    const count = await prisma.bidSubmission.count();
    const bid = await prisma.bidSubmission.create({
      data: {
        tenderId,
        organizationId: session.organizationId,
        bidNumber: `BID/2026/${String(count + 1001).padStart(5, "0")}`,
        status: "DRAFT",
      },
    });
    await audit({ actor: session, action: "BID_CREATED", entityType: "BidSubmission", entityId: bid.id, after: { bidNumber: bid.bidNumber, tender: tender.tenderNumber } });
    return ok({ bidId: bid.id, existing: false });
  });
}
