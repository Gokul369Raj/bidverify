import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/**
 * Public platform stats — no authentication required.
 * Shows live counts for the landing page.
 * In-memory cache for 60s to avoid hitting Supabase on every load.
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET() {
  return handle(async () => {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL) {
      const res = ok(cache.data);
      res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      return res;
    }

    const [tenderCount, activeTenderCount, bidderCount, bidCount, requirementCount] = await Promise.all([
      prisma.tender.count(),
      prisma.tender.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { role: "BIDDER" } }),
      prisma.bidSubmission.count(),
      prisma.tenderRequirement.count({ where: { status: "APPROVED" } }),
    ]);

    const data = {
      totalTenders: tenderCount,
      activeTenders: activeTenderCount,
      registeredBidders: bidderCount,
      totalBids: bidCount,
      totalRequirements: requirementCount,
    };

    cache = { data, ts: now };
    const res = ok(data);
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res;
  });
}
