import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { OFFICER_ROLES } from "@/lib/roles";

/** GET — List all tender applications for officer review */
export async function GET(req: Request) {
  return handle(async () => {
    const session = await requireSession();
    if (!OFFICER_ROLES.includes(session.role)) return fail(403, "Officer access required");

    const url = new URL(req.url);
    const tenderId = url.searchParams.get("tenderId");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    const where: any = {};
    if (tenderId) where.tenderId = tenderId;
    if (status) where.status = status;

    const applications = await prisma.application.findMany({
      where,
      include: {
        tender: { select: { id: true, tenderNumber: true, title: true, buyerOrganization: true, status: true, closingDate: true } },
        organization: { select: { id: true, legalName: true, pan: true, gstin: true, city: true, state: true, isMsme: true, isStartup: true } },
        user: { select: { name: true, email: true } },
        documents: {
          include: {
            vaultDocument: {
              select: { id: true, docType: true, fileName: true, verificationStatus: true, expiryDate: true, status: true, sha256: true, version: true },
            },
          },
        },
        formValues: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    // Enrich with requirement matchings
    const enriched = applications.map((app) => {
      const docMap: Record<string, any[]> = {};
      for (const doc of app.documents) {
        if (!docMap[doc.requirementCode || "unassigned"]) docMap[doc.requirementCode || "unassigned"] = [];
        docMap[doc.requirementCode || "unassigned"].push(doc);
      }
      return {
        ...app,
        documentCount: app.documents.length,
        formFieldCount: app.formValues.length,
      };
    });

    return ok({ applications: enriched, total: enriched.length });
  });
}
