import { prisma } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api";
import { audit } from "@/lib/audit";
import { z } from "zod";

/**
 * Admin tender management: PATCH (edit) and DELETE (remove).
 * DELETE cascades all dependent records inside a transaction so the tender
 * disappears cleanly everywhere. Every mutation is audited with before/after.
 */

const patchSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  description: z.string().max(5000).optional(),
  buyerOrganization: z.string().min(2).max(200).optional(),
  department: z.string().max(200).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  state: z.string().max(60).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  closingDate: z.string().datetime().or(z.string().min(8)).optional(),
  estimatedValueLakh: z.number().nonnegative().nullable().optional(),
  emdAmount: z.number().nonnegative().nullable().optional(),
  status: z.enum(["ACTIVE", "CLOSED", "CANCELLED"]).optional(),
});

function parseIdFrom(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  return ctx.params.then(p => p.id);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await parseIdFrom(ctx);
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return fail(400, parsed.error.issues.map(i => i.message).join("; "));

    const existing = await prisma.tender.findUnique({ where: { id } });
    if (!existing) return fail(404, "Tender not found");

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.closingDate) data.closingDate = new Date(parsed.data.closingDate);

    const updated = await prisma.tender.update({ where: { id }, data });
    await audit({
      action: "TENDER_UPDATED",
      entityType: "Tender",
      entityId: id,
      before: { title: existing.title, status: existing.status, closingDate: existing.closingDate },
      after: { title: updated.title, status: updated.status, closingDate: updated.closingDate },
    });

    // Return the shape the admin grid already consumes.
    const full = await prisma.tender.findUnique({
      where: { id },
      include: {
        requirements: { select: { id: true, code: true, type: true, title: true, mandatory: true, status: true, description: true } },
        _count: { select: { requirements: true, bids: true } },
      },
    });
    return ok({ tender: full });
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const id = await parseIdFrom(ctx);
    const existing = await prisma.tender.findUnique({
      where: { id },
      include: { _count: { select: { bids: true, requirements: true } } },
    });
    if (!existing) return fail(404, "Tender not found");

    await prisma.$transaction(async (tx) => {
      const submissions = await tx.bidSubmission.findMany({ where: { tenderId: id }, select: { id: true } });
      for (const sub of submissions) {
        await tx.evidenceItem.deleteMany({ where: { submissionId: sub.id } });
        await tx.complianceResult.deleteMany({ where: { submissionId: sub.id } });
        await tx.extractedField.deleteMany({ where: { document: { submissionId: sub.id } } });
        await tx.bidDocument.deleteMany({ where: { submissionId: sub.id } });
        await tx.verificationResult.deleteMany({ where: { submissionId: sub.id } });
        await tx.anomaly.deleteMany({ where: { submissionId: sub.id } });
        await tx.riskScore.deleteMany({ where: { submissionId: sub.id } });
        await tx.report.deleteMany({ where: { submissionId: sub.id } });
      }
      await tx.bidSubmission.deleteMany({ where: { tenderId: id } });
      await tx.savedTender.deleteMany({ where: { tenderId: id } });
      await tx.corrigendum.deleteMany({ where: { tenderId: id } });
      await tx.tenderRequirement.deleteMany({ where: { tenderId: id } });
      await tx.tenderDocument.deleteMany({ where: { tenderId: id } });
      await tx.notification.deleteMany({ where: { link: `/bidder/tenders/${id}` } });
      await tx.tender.delete({ where: { id } });
    });

    await audit({
      action: "TENDER_DELETED",
      entityType: "Tender",
      entityId: id,
      before: { tenderNumber: existing.tenderNumber, title: existing.title, bids: existing._count.bids },
    });
    return ok({ deleted: true, tenderNumber: existing.tenderNumber });
  });
}
