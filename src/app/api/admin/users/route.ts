import { prisma } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api";

/**
 * Admin API — returns all users with full details including login stats.
 * Only accessible by SUPER_ADMIN / SYSTEM_ADMIN.
 * Protected by requireAdmin() in the admin page.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") ?? "";
    const role = url.searchParams.get("role") ?? "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { aadharNumber: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true, legalName: true, tradeName: true, pan: true, gstin: true,
              udyamNumber: true, cin: true, registeredAddress: true, state: true,
              city: true, pincode: true, phone: true, organizationType: true,
              businessCategory: true, annualTurnoverLakh: true, incorporationDate: true,
              isMsme: true, isStartup: true, isOem: true,
            },
          },
          _count: { select: { notifications: true, auditLogs: true, savedTenders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return ok({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        aadharNumber: u.aadharNumber,
        role: u.role,
        authProvider: u.authProvider,
        isActive: u.isActive,
        loginCount: u.loginCount,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        emailVerifiedAt: u.emailVerifiedAt,
        organization: u.organization,
        notificationCount: u._count.notifications,
        auditLogCount: u._count.auditLogs,
        savedTenderCount: u._count.savedTenders,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });
}
