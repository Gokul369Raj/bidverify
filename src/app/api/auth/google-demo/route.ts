import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { OFFICER_ROLES } from "@/lib/roles";

const schema = z.object({
  /** 'bidder' or the email of a seeded demo user */
  demoUser: z.string().min(3).max(120),
});

/**
 * DEMO MODE ONLY: simulated Google sign-in for the showcase journey when real
 * Google OAuth credentials are not configured. Sessions created here are real,
 * but the authentication event is audited as LOGIN_GOOGLE_DEMO (simulated).
 */
export async function POST(req: Request) {
  return handle(async () => {
    if (process.env.DEMO_MODE === "false") return fail(404, "Not available");
    const ip = clientIp(req);
    if (!rateLimit(`google-demo:${ip}`, 10, 60_000).ok) return fail(429, "Too many attempts");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return fail(400, "demoUser is required");

    const key = parsed.data.demoUser.toLowerCase();
    const email = key === "bidder" || key === "google" ? "sunil.kumar@abcindustries.example" : key;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return fail(404, `Demo user ${email} not found — run the seed script (npm run db:seed)`);

    const token = await createSessionToken(user);
    await setSessionCookie(token);
    await audit({
      actor: { userId: user.id, email: user.email, name: user.name, role: user.role as never, organizationId: user.organizationId },
      action: "LOGIN_GOOGLE_DEMO",
      entityType: "User",
      entityId: user.id,
      reason: "Simulated Google sign-in (DEMO MODE)",
      ip,
    });

    return ok({
      userId: user.id,
      role: user.role,
      simulated: true,
      redirect: OFFICER_ROLES.includes(user.role as never) ? "/officer" : "/bidder",
    });
  });
}
