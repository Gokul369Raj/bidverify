import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { sha256Hex } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ token: z.string().min(10), password: z.string().min(8).max(128) });

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientIp(req);
    if (!rateLimit(`reset:${ip}`, 10, 60_000).ok) return fail(429, "Too many attempts — try again later");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Token and a password of at least 8 characters are required");

    const row = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256Hex(parsed.data.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) return fail(400, "This reset link is invalid or has expired");

    await prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
    await prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await audit({ action: "PASSWORD_RESET_COMPLETED", entityType: "User", entityId: row.userId, ip });

    return ok({ reset: true });
  });
}
