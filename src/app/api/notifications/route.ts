import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const [all, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.notification.count({ where: { userId: session.userId, read: false } }),
    ]);
    return ok({ notifications: all, unread });
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { notificationId, markAll } = await req.json();
    if (markAll) {
      await prisma.notification.updateMany({ where: { userId: session.userId, read: false }, data: { read: true } });
    } else if (notificationId) {
      await prisma.notification.update({ where: { id: notificationId, userId: session.userId }, data: { read: true } });
    }
    return ok({ updated: true });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    const { notificationId, deleteAll } = await req.json();
    if (deleteAll) {
      await prisma.notification.deleteMany({ where: { userId: session.userId } });
    } else if (notificationId) {
      await prisma.notification.delete({ where: { id: notificationId, userId: session.userId } });
    }
    return ok({ deleted: true });
  });
}