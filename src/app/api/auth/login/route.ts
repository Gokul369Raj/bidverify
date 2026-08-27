import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { safeRole, OFFICER_ROLES } from "@/lib/roles";

const schema = z.object({ email: z.string().email().toLowerCase(), password: z.string().min(1) });

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientIp(req);
    if (!rateLimit(`login:${ip}`, 10, 60_000).ok) return fail(429, "Too many login attempts — try again in a minute");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "Email and password are required");
    const { email, password } = parsed.data;

    // Only fetch the columns we need — no organization include (unused here).
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      void audit({ action: "LOGIN_FAILED", entityType: "User", entityId: email, ip }).catch(() => {});
      return fail(401, "Invalid email or password");
    }
    if (!user.isActive) return fail(403, "Account is deactivated");

    const token = await createSessionToken(user);
    await setSessionCookie(token);

    const session = { userId: user.id, email: user.email, name: user.name, role: safeRole(user.role), organizationId: user.organizationId };

    // Non-critical writes run in the background so sign-in feels instant.
    const redirect = OFFICER_ROLES.includes(session.role) ? "/officer" : "/bidder";
    setTimeout(() => {
      Promise.allSettled([
        audit({ actor: session, action: "LOGIN", entityType: "User", entityId: user.id, ip }),
        prisma.user.update({
          where: { id: user.id },
          data: { loginCount: { increment: 1 }, lastLoginAt: new Date(), lastLoginIp: ip },
        }),
      ]);
    }, 0);

    return ok({ userId: user.id, role: session.role, name: user.name, redirect });
  });
}
