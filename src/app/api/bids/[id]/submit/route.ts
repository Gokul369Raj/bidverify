import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** Bidder submits their bid (locks it). Sends notification with progress tracker. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireBidder();
    const { id } = await ctx.params;
    const bid = await prisma.bidSubmission.findUnique({ where: { id }, include: { tender: true, organization: true, documents: true } });
    if (!bid) return fail(404, "Bid not found");
    if (bid.organizationId !== session.organizationId) return fail(403, "Not your bid");
    if (bid.status !== "DRAFT") return fail(409, `Bid is already ${bid.status}`);
    
    await prisma.bidSubmission.update({ where: { id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await audit({ actor: session, action: "BID_SUBMITTED", entityType: "BidSubmission", entityId: id, after: { bidNumber: bid.bidNumber, tender: bid.tender.tenderNumber } });

    // Send bid submitted notification with progress tracker
    const docCount = bid.documents.length;
    const progressSteps = [
      `✅ Step 1: Bid Submitted — ${bid.bidNumber} for ${bid.tender.tenderNumber}`,
      `⏳ Step 2: Under Compliance Review — AI verification engine is analyzing ${docCount} uploaded document(s)`,
      `⏳ Step 3: Verification Results — Compliance score and risk assessment will be generated`,
      `⏳ Step 4: Officer Decision — Procurement officer will review and make final decision`,
    ];
    await prisma.notification.create({
      data: {
        userId: session.userId,
        title: `Bid Submitted — ${bid.tender.tenderNumber}`,
        body: `Your bid ${bid.bidNumber} for "${bid.tender.title}" has been submitted successfully.\n\n📋 Application Progress Tracker:\n${progressSteps.join("\n")}\n\nWe will notify you at each stage. Track your bid at /bidder/bids`,
        kind: "SUCCESS",
        link: "/bidder/bids",
      },
    });

    return ok({ submitted: true, bidNumber: bid.bidNumber });
  });
}
