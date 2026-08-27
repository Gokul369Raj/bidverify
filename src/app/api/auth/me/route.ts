import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";
import { safeRole } from "@/lib/roles";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) return ok(null);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { organization: { select: { id: true, legalName: true, tradeName: true } } },
    });
    if (!user) return ok(null);
    const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
    return ok({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: safeRole(user.role),
      organization: user.organization ? { id: user.organization.id, legalName: user.organization.legalName } : null,
      unreadNotifications: unread,
    });
  });
}
