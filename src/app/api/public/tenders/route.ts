import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

/**
 * Public tender listing — no authentication required.
 * Bidders can browse tenders without logging in.
 * Supports search, category, state, status filters, and pagination.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const category = url.searchParams.get("category") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const status = url.searchParams.get("status") ?? "ACTIVE";
    const closingSoon = url.searchParams.get("closingSoon") === "true";
    const msmeFriendly = url.searchParams.get("msme") === "true";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (status) where.status = status;

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { tenderNumber: { contains: q, mode: "insensitive" } },
        { buyerOrganization: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (state) where.state = { contains: state, mode: "insensitive" };
    if (closingSoon) {
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      where.closingDate = { lte: weekFromNow };
    }
    if (msmeFriendly) {
      where.OR = [
        ...(where.OR ?? []),
        { requirements: { some: { type: "UDYAM" } } },
      ];
    }

    const [tenders, total] = await Promise.all([
      prisma.tender.findMany({
        where,
        include: {
          requirements: { select: { id: true, type: true, mandatory: true, title: true } },
          _count: { select: { bids: true } },
        },
        orderBy: { publishDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.tender.count({ where }),
    ]);

    // Public summary — hide internal fields
    const publicTenders = tenders.map((t) => ({
      id: t.id,
      tenderNumber: t.tenderNumber,
      title: t.title,
      description: t.description.slice(0, 300),
      buyerOrganization: t.buyerOrganization,
      department: t.department,
      category: t.category,
      state: t.state,
      city: t.city,
      publishDate: t.publishDate,
      closingDate: t.closingDate,
      estimatedValueLakh: t.estimatedValueLakh,
      status: t.status,
      dataLabel: t.dataLabel,
      requirementCount: t.requirements.length,
      mandatoryCount: t.requirements.filter((r) => r.mandatory).length,
      bidCount: t._count.bids,
      requirementTypes: [...new Set(t.requirements.map((r) => r.type))],
    }));

    return ok({
      tenders: publicTenders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });
}
