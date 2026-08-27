import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().email().toLowerCase() });

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientIp(req);
    if (!rateLimit(`forgot:${ip}`, 5, 60_000).ok) return fail(429, "Too many attempts — try again later");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "A valid email is required");

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Do not reveal whether the account exists.
    if (!user) return ok({ sent: true });

    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    await audit({ action: "PASSWORD_RESET_REQUESTED", entityType: "User", entityId: user.id, ip });

    // No mail provider is configured in the demo: the reset link is returned so the
    // flow is testable. In production this would be emailed and never returned.
    const demoMode = process.env.DEMO_MODE !== "false";
    return ok({ sent: true, ...(demoMode ? { demoResetUrl: `/reset-password?token=${token}` } : {}) });
  });
}
