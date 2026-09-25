import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";
import { aiInterpretSearch } from "@/lib/ai/tasks";

/**
 * Fast path: plain keyword search runs without any AI call (instant dashboards).
 * The AI interpreter only engages for natural-language queries that actually
 * need it (long queries with intent words), and its result is cached by the
 * orchestrator, so repeat searches stay fast.
 */
function needsAiInterpretation(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  // short single-token or ID-like queries → plain contains() is enough
  if (q.length <= 24 && !q.includes(" ")) return false;
  return true;
}

const FALLBACK_FILTERS = { q: "", category: "", state: "", msmeFriendly: false, startupFriendly: false, oemRequired: false, experienceRequired: false, closingWithinDays: 0, keywords: [] as string[] };

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { query = "", page = 1, limit = 20, ...filters } = await req.json();

    const useAi = needsAiInterpretation(String(query));
    const interpreted = useAi
      ? await aiInterpretSearch(query || "", session.userId)
      : null;
    const sf = interpreted ? interpreted.data : { ...FALLBACK_FILTERS, q: String(query) };

    const where: any = { status: "ACTIVE" };
    if (sf.q || filters.q) where.OR = [
      { title: { contains: sf.q || filters.q } },
      { tenderNumber: { contains: sf.q || filters.q } },
      { description: { contains: sf.q || filters.q } },
    ];
    if (sf.category || filters.category) where.category = sf.category || filters.category;
    if (sf.state || filters.state) where.state = sf.state || filters.state;
    if (sf.msmeFriendly || filters.msmeFriendly) where.description = { contains: "MSME" };
    if (filters.closingWithinDays) {
      const d = new Date(); d.setDate(d.getDate() + filters.closingWithinDays);
      where.closingDate = { lte: d };
    }
    if (filters.saved && session.role === "BIDDER") {
      const saved = await prisma.savedTender.findMany({ where: { userId: session.userId }, select: { tenderId: true } });
      where.id = { in: saved.map(s => s.tenderId) };
    }
    // keyword search across title + description
    if (sf.keywords?.length) {
      where.AND = sf.keywords.map(k => ({
        OR: [{ title: { contains: k } }, { description: { contains: k } }],
      }));
    }

    const isOfficer = session.role !== "BIDDER";
    const [tenders, total] = await Promise.all([
      prisma.tender.findMany({ where, orderBy: { publishDate: "desc" }, skip: (page - 1) * limit, take: limit, select: {
        id: true, tenderNumber: true, title: true, buyerOrganization: true, category: true, state: true, city: true,
        status: true,
        publishDate: true, closingDate: true, source: true, dataLabel: true, emdAmount: true, estimatedValueLakh: true,
        requirementsFrozen: true, aiAnalysisStatus: true,
        _count: { select: { requirements: true, bids: true } },
        ...(isOfficer ? { bids: {
          select: {
            id: true, bidNumber: true, status: true, complianceScore: true, riskLevel: true, officerDecision: true,
            organization: { select: { legalName: true, gstin: true } },
            _count: { select: { documents: true } },
          },
          orderBy: { createdAt: "desc" },
        } } : {}),
      }}),
      prisma.tender.count({ where }),
    ]);

    const savedSet = session.role === "BIDDER"
      ? new Set((await prisma.savedTender.findMany({ where: { userId: session.userId }, select: { tenderId: true } })).map(s => s.tenderId))
      : new Set<string>();

    return ok({ tenders: tenders.map(t => ({ ...t, saved: savedSet.has(t.id) })), total, page, limit, aiInterpretation: sf, simulated: interpreted?.meta.simulated ?? true });
  });
}
