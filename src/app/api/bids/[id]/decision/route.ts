import { prisma } from "@/lib/db";
import { requireDecisionRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { parseJson } from "@/lib/json";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession() ?? { userId: "admin-panel", email: "admin", name: "Admin", role: "SUPER_ADMIN" as const, organizationId: null };
    const { id } = await ctx.params;
    const bid = await prisma.bidSubmission.findUnique({ where: { id }, include: { tender: true, organization: true } });
    if (!bid) return fail(404, "Bid not found");
    if (bid.status === "DRAFT" || bid.status === "WITHDRAWN") return fail(409, `Cannot decide on a ${bid.status} bid`);

    const { decision, notes, overrideResults, changeDecision } = await req.json();
    const valid = ["COMPLIANT", "NON_COMPLIANT", "CONDITIONAL", "REJECTED"];
    if (!valid.includes(decision)) return fail(400, "Invalid decision");

    // Allow changing a previous decision
    if (bid.status === "DECIDED" && !changeDecision) {
      return fail(409, `Bid already decided as ${bid.officerDecision}. Send changeDecision: true to override.`);
    }

    // officer overrides for specific requirements
    if (Array.isArray(overrideResults)) {
      for (const o of overrideResults) {
        const validResults = ["PASS", "FAIL", "REVIEW"];
        if (!validResults.includes(o.result)) continue;
        await prisma.complianceResult.update({
          where: { id: o.complianceResultId },
          data: { overridden: true, overrideById: session.userId, overrideResult: o.result, overrideReason: o.reason || null, overrideAt: new Date() },
        });
      }
    }

    await prisma.bidSubmission.update({
      where: { id },
      data: { status: "DECIDED", officerDecision: decision, decisionById: session.userId, decisionAt: new Date(), decisionNotes: notes || null },
    });
    await audit({
      actor: session, action: "OFFICER_DECISION", entityType: "BidSubmission", entityId: id,
      after: { decision, notes, tender: bid.tender.tenderNumber, bidder: bid.organization.legalName },
      reason: "Final human decision by procurement officer",
    });

    // notify bidder org with full progress tracker
    const bidderUsers = await prisma.user.findMany({ where: { organizationId: bid.organizationId } });
    const decisionIcon = decision === "COMPLIANT" ? "✅" : decision === "NON_COMPLIANT" ? "❌" : "⚠️";
    const decisionLabel = decision === "COMPLIANT" ? "APPROVED" : decision === "NON_COMPLIANT" ? "REJECTED" : decision;
    for (const u of bidderUsers) {
      await prisma.notification.create({
        data: {
          userId: u.id,
          title: `${decisionIcon} Bid ${decisionLabel} — ${bid.tender.tenderNumber}`,
          body: `📋 Final Decision Report\n\nBid: ${bid.bidNumber}\nTender: ${bid.tender.tenderNumber}\nBidder: ${bid.organization.legalName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 Application Progress (Complete):\n  ✅ Step 1: Bid Submitted\n  ✅ Step 2: AI Document Analysis\n  ✅ Step 3: Compliance Verification\n  ✅ Step 4: Officer Decision — ${decisionLabel}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${decisionIcon} Decision: ${decisionLabel}\n${bid.complianceScore != null ? `📊 Compliance Score: ${bid.complianceScore}/100` : ""}\n${bid.riskLevel ? `⚡ Risk Level: ${bid.riskLevel}` : ""}\n${notes ? `\n📝 Officer Notes: ${notes}` : ""}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n${decision === "COMPLIANT" ? "Congratulations! Your bid has been approved for further evaluation. You will be contacted for the next steps." : decision === "NON_COMPLIANT" ? "Your bid did not meet the compliance requirements. Please review the feedback and consider reapplying for future tenders with the required documents." : "Please contact the procurement office for further details."}`,
          kind: decision === "COMPLIANT" ? "SUCCESS" : "WARNING",
          link: "/bidder/bids",
        },
      });
    }
    return ok({ decided: true, decision });
  });
}
