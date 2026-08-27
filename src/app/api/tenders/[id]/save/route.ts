import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOfficer, requireSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";

/** Save/unsave a tender (bidder). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender) return fail(404, "Tender not found");
    const existing = await prisma.savedTender.findUnique({ where: { userId_tenderId: { userId: session.userId, tenderId: id } } });
    if (existing) {
      await prisma.savedTender.delete({ where: { userId_tenderId: { userId: session.userId, tenderId: id } } });
      return ok({ saved: false });
    }
    await prisma.savedTender.create({ data: { userId: session.userId, tenderId: id } });
    return ok({ saved: true });
  });
}
