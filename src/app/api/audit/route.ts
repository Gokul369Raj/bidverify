import { prisma } from "@/lib/db";
import { ok, handle } from "@/lib/api";

export async function GET(req: Request) {
  return handle(async () => {
    // Admin panel has its own password gate (AdminGate component)
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50")));
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    return ok({ logs, total, page, limit });
  });
}
