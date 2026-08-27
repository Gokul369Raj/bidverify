import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

/** GET /api/tenders/[id] — fetch full tender details including requirements, bids, docs. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireSession();
    const { id } = await ctx.params;
    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        requirements: { orderBy: { code: "asc" } },
        documents: { orderBy: { createdAt: "asc" } },
        corrigenda: { orderBy: { publishedAt: "desc" } },
        bids: {
          include: {
            organization: { select: { id: true, legalName: true, tradeName: true, gstin: true, pan: true, udyamNumber: true, isMsme: true, isStartup: true } },
            documents: { include: { fields: true }, orderBy: { createdAt: "asc" } },
            complianceResults: { include: { requirement: true, evidences: true } },
            risks: { orderBy: { calculatedAt: "desc" }, take: 1 },
            anomalies: { orderBy: { createdAt: "desc" } },
            verifications: { orderBy: { checkedAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!tender) return { ok: false, error: "Tender not found", status: 404 } as any;
    return ok(tender);
  });
}
