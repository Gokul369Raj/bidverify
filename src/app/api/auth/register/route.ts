import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { GSTIN_REGEX, PAN_REGEX, UDYAM_REGEX } from "@/lib/constants";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
  organization: z.object({
    legalName: z.string().min(2).max(200),
    tradeName: z.string().max(200).optional().or(z.literal("")),
    phone: z.string().max(20).optional().or(z.literal("")),
    pan: z.string().regex(PAN_REGEX, "PAN must look like ABCDE1234F").optional().or(z.literal("")),
    gstin: z.string().regex(GSTIN_REGEX, "GSTIN must be 15 characters").optional().or(z.literal("")),
    udyamNumber: z.string().regex(UDYAM_REGEX, "Udyam must look like UDYAM-XX-00-0000000").optional().or(z.literal("")),
    cin: z.string().max(21).optional().or(z.literal("")),
    registeredAddress: z.string().max(500).optional().or(z.literal("")),
    state: z.string().max(60).optional().or(z.literal("")),
    city: z.string().max(60).optional().or(z.literal("")),
    organizationType: z.string().optional(),
    businessCategory: z.string().optional(),
    isOem: z.boolean().optional(),
    isStartup: z.boolean().optional(),
    isMsme: z.boolean().optional(),
    annualTurnoverLakh: z.number().positive().optional(),
    incorporationDate: z.string().optional().or(z.literal("")),
  }),
});

export async function POST(req: Request) {
  return handle(async () => {
    const ip = clientIp(req);
    if (!rateLimit(`register:${ip}`, 10, 60_000).ok) return fail(429, "Too many attempts — try again in a minute");

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));

    const { name, email, password, organization: org } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail(409, "An account with this email already exists");

    const createdOrg = await prisma.organization.create({
      data: {
        legalName: org.legalName,
        tradeName: org.tradeName || null,
        phone: org.phone || null,
        pan: org.pan || null,
        gstin: org.gstin || null,
        udyamNumber: org.udyamNumber || null,
        cin: org.cin || null,
        registeredAddress: org.registeredAddress || null,
        state: org.state || null,
        city: org.city || null,
        organizationType: org.organizationType || null,
        businessCategory: org.businessCategory || null,
        isOem: org.isOem ?? false,
        isStartup: org.isStartup ?? false,
        isMsme: org.isMsme ?? (Boolean(org.udyamNumber)),
        annualTurnoverLakh: org.annualTurnoverLakh ?? null,
        incorporationDate: org.incorporationDate ? new Date(org.incorporationDate) : null,
        fieldStatusJson: JSON.stringify(
          Object.fromEntries(
            ["pan", "gstin", "udyamNumber", "legalName"].map((f) => [f, { status: "SELF_DECLARED", source: "REGISTRATION_FORM", method: "self", verifiedAt: null }]),
          ),
        ),
      },
    });

    // Registration always creates a BIDDER. Privileged roles are granted only by admins.
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role: "BIDDER",
        organizationId: createdOrg.id,
      },
    });

    const token = await createSessionToken(user);
    await setSessionCookie(token);
    await audit({ actor: { userId: user.id, email, name, role: "BIDDER", organizationId: createdOrg.id }, action: "USER_REGISTERED", entityType: "User", entityId: user.id, ip, after: { email } });

    return ok({ userId: user.id, role: user.role, redirect: "/bidder" });
  });
}
