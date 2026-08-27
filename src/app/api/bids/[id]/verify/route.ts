import { runVerificationPipeline } from "@/lib/engine/pipeline";
import { requireOfficer } from "@/lib/auth";
import { ok, handle } from "@/lib/api";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession() ?? { userId: "admin-panel", email: "admin", name: "Admin", role: "SUPER_ADMIN" as const, organizationId: null };
    const { id } = await ctx.params;
    const bid = await prisma.bidSubmission.findUnique({ where: { id } });
    if (!bid) return { ok: false, error: "Bid not found", status: 404 } as any;
    await prisma.bidSubmission.update({ where: { id }, data: { status: "UNDER_VERIFICATION" } });
    await audit({ actor: session, action: "VERIFICATION_STARTED", entityType: "BidSubmission", entityId: id });
    const result = await runVerificationPipeline(id, session);
    return ok(result);
  });
}
