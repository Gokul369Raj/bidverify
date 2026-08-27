import { prisma } from "@/lib/db";
import { requireSession, HttpError } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { OFFICER_ROLES } from "@/lib/roles";

export async function getBidForUser(bidId: string, session: SessionUser) {
  const bid = await prisma.bidSubmission.findUnique({
    where: { id: bidId },
    include: {
      tender: { include: { requirements: true, corrigenda: true } },
      organization: true,
      documents: { include: { fields: true } },
    },
  });
  if (!bid) throw new HttpError(404, "Bid not found");
  const isOfficer = OFFICER_ROLES.includes(session.role);
  if (!isOfficer) {
    if (session.role !== "BIDDER" || session.organizationId !== bid.organizationId) {
      // bidders must never access other organizations' bids
      throw new HttpError(403, "You do not have access to this bid");
    }
  }
  return { bid, isOfficer };
}

/** Bidders see a filtered view: no officer-only fields, no other-bidder data. */
export function sanitizeBidForBidder(bid: Awaited<ReturnType<typeof getBidForUser>>["bid"]) {
  const { officerDecision, decisionById, decisionAt, decisionNotes, ...rest } = bid;
  void officerDecision; void decisionById; void decisionAt;
  return {
    ...rest,
    decisionVisible: decisionNotes ? { notes: decisionNotes } : null,
  };
}
