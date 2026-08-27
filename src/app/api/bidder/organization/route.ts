import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireBidder } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { GSTIN_REGEX, PAN_REGEX } from "@/lib/constants";

const orgSchema = z.object({
  legalName: z.string().min(2).max(200),
  tradeName: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  pan: z.string().regex(PAN_REGEX, "PAN must look like ABCDE1234F").optional().or(z.literal("")),
  gstin: z.string().regex(GSTIN_REGEX, "GSTIN must be 15 characters").optional().or(z.literal("")),
  udyamNumber: z.string().optional().or(z.literal("")),
  registeredAddress: z.string().max(500).optional().or(z.literal("")),
  state: z.string().max(60).optional().or(z.literal("")),
  city: z.string().max(60).optional().or(z.literal("")),
  organizationType: z.string().optional(),
  businessCategory: z.string().optional(),
  isMsme: z.boolean().optional(),
  isStartup: z.boolean().optional(),
  isOem: z.boolean().optional(),
  cin: z.string().max(30).optional().or(z.literal("")),
  pincode: z.string().max(10).optional().or(z.literal("")),
  annualTurnoverLakh: z.number().nonnegative().optional(),
  incorporationDate: z.string().optional().or(z.literal("")),
});


/** Full organization profile for the signed-in bidder (null when never created — e.g. Google sign-ups). */
export async function GET() {
  return handle(async () => {
    const session = await requireBidder();
    if (!session.organizationId) {
      return ok({ organization: null, complete: false, missingFields: ["legalName", "pan", "gstin", "registeredAddress"] });
    }
    const org = await prisma.organization.findUnique({ where: { id: session.organizationId } });
    if (!org) return ok({ organization: null, complete: false, missingFields: ["legalName"] });

    const required: [keyof typeof org, string][] = [
      ["legalName", "Legal name"], ["pan", "PAN"], ["gstin", "GSTIN"],
      ["registeredAddress", "Registered address"], ["state", "State"], ["phone", "Phone"],
    ];
    const missingFields = required.filter(([k]) => !org[k]).map(([, label]) => label);
    return ok({
      organization: {
        legalName: org.legalName, tradeName: org.tradeName, phone: org.phone,
        pan: org.pan, gstin: org.gstin, udyamNumber: org.udyamNumber, cin: org.cin,
        registeredAddress: org.registeredAddress, state: org.state, city: org.city,
        pincode: org.pincode, organizationType: org.organizationType,
        businessCategory: org.businessCategory,
        annualTurnoverLakh: org.annualTurnoverLakh,
        incorporationDate: org.incorporationDate?.toISOString().slice(0, 10) ?? "",
        isMsme: org.isMsme, isStartup: org.isStartup, isOem: org.isOem,
      },
      complete: missingFields.length === 0,
      missingFields,
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireBidder();
    const body = await req.json();
    const parsed = orgSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues.map((i) => i.message).join("; "));

    const org = parsed.data;

    if (session.organizationId) {
      // Update existing organization
      const updated = await prisma.organization.update({
        where: { id: session.organizationId },
        data: {
          legalName: org.legalName,
          tradeName: org.tradeName || null,
          phone: org.phone || null,
          pan: org.pan || null,
          gstin: org.gstin || null,
          udyamNumber: org.udyamNumber || null,
          registeredAddress: org.registeredAddress || null,
          state: org.state || null,
          city: org.city || null,
          organizationType: org.organizationType || null,
          businessCategory: org.businessCategory || null,
          cin: org.cin || null,
          pincode: org.pincode || null,
          annualTurnoverLakh: org.annualTurnoverLakh ?? null,
          incorporationDate: org.incorporationDate ? new Date(org.incorporationDate) : null,
          isMsme: org.isMsme ?? false,
          isStartup: org.isStartup ?? false,
          isOem: org.isOem ?? false,
        },
      });
      await audit({ actor: session, action: "ORGANIZATION_UPDATED", entityType: "Organization", entityId: updated.id, after: { legalName: org.legalName } });
      return ok({ organizationId: updated.id, updated: true });
    }

    // Create new organization and link to user
    const created = await prisma.organization.create({
      data: {
        legalName: org.legalName,
        tradeName: org.tradeName || null,
        phone: org.phone || null,
        pan: org.pan || null,
        gstin: org.gstin || null,
        udyamNumber: org.udyamNumber || null,
        registeredAddress: org.registeredAddress || null,
        state: org.state || null,
        city: org.city || null,
        organizationType: org.organizationType || null,
        businessCategory: org.businessCategory || null,
        isMsme: org.isMsme ?? false,
        isStartup: org.isStartup ?? false,
        isOem: org.isOem ?? false,
        fieldStatusJson: JSON.stringify(
          Object.fromEntries(
            ["pan", "gstin", "udyamNumber", "legalName"].map((f) => [f, { status: "SELF_DECLARED", source: "PROFILE_SETUP", method: "self", verifiedAt: null }]),
          ),
        ),
      },
    });

    await prisma.user.update({
      where: { id: session.userId },
      data: { organizationId: created.id },
    });

    await audit({ actor: { ...session, organizationId: created.id }, action: "ORGANIZATION_CREATED", entityType: "Organization", entityId: created.id, after: { legalName: org.legalName } });
    return ok({ organizationId: created.id, created: true });
  });
}
