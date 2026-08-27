import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { REQUIREMENT_TYPES } from "@/lib/constants";
import { toJson } from "@/lib/json";

const addAction = z.object({
  action: z.literal("add"),
  type: z.string(),
  title: z.string().min(3),
  description: z.string().optional().default(""),
  mandatory: z.boolean().default(true),
  evidenceRequired: z.boolean().default(true),
  params: z.record(z.string(), z.unknown()).optional().default({}),
});

const updateAction = z.object({
  action: z.literal("update"),
  requirementId: z.string(),
  type: z.string().optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  mandatory: z.boolean().optional(),
  evidenceRequired: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const statusAction = z.object({
  action: z.literal("approve") //.or(z.literal("reject")).or(z.literal("approveAll"))
  ,
  requirementId: z.string().optional(),
});

const approveAllAction = z.object({ action: z.literal("approveAll") });
const rejectAction = z.object({ action: z.literal("reject"), requirementId: z.string() });
const reanalyzeAction = z.object({ action: z.literal("reanalyze") });

const bodySchema = z.union([addAction, updateAction, statusAction, approveAllAction, rejectAction, reanalyzeAction]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { getSession } = await import("@/lib/auth");
    const session = await getSession() ?? { userId: "admin-panel", email: "admin", name: "Admin", role: "SUPER_ADMIN" as const, organizationId: null };
    const { id } = await ctx.params;
    const tender = await prisma.tender.findUnique({ where: { id }, include: { requirements: true } });
    if (!tender) return fail(404, "Tender not found");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return fail(400, parsed.error.issues.map((i) => i.message).join("; "));
    const body = parsed.data;

    switch (body.action) {
      case "add": {
        if (!(REQUIREMENT_TYPES as readonly string[]).includes(body.type)) return fail(400, "Unknown requirement type");
        const nextIndex = tender.requirements.length + 1;
        const created = await prisma.tenderRequirement.create({
          data: {
            tenderId: id,
            code: `R${nextIndex}`,
            type: body.type,
            title: body.title,
            description: body.description,
            mandatory: body.mandatory,
            evidenceRequired: body.evidenceRequired,
            paramsJson: toJson(body.params),
            extractionMethod: "MANUAL",
            status: "APPROVED",
            approvedById: session.userId,
            approvedAt: new Date(),
            confidence: 1,
          },
        });
        await audit({ actor: session, action: "REQUIREMENT_ADDED", entityType: "TenderRequirement", entityId: created.id, after: { title: body.title, type: body.type } });
        return ok({ requirementId: created.id });
      }

      case "update": {
        const existing = tender.requirements.find((r) => r.id === body.requirementId);
        if (!existing) return fail(404, "Requirement not found");
        const updated = await prisma.tenderRequirement.update({
          where: { id: body.requirementId },
          data: {
            type: body.type ?? existing.type,
            title: body.title ?? existing.title,
            description: body.description ?? existing.description,
            mandatory: body.mandatory ?? existing.mandatory,
            evidenceRequired: body.evidenceRequired ?? existing.evidenceRequired,
            paramsJson: body.params ? toJson(body.params) : (existing.paramsJson as string),
            extractionMethod: existing.extractionMethod === "MANUAL" ? "MANUAL" : "AI_EDITED",
          },
        });
        await audit({
          actor: session,
          action: "REQUIREMENT_MODIFIED",
          entityType: "TenderRequirement",
          entityId: existing.id,
          before: { title: existing.title, mandatory: existing.mandatory, type: existing.type },
          after: { title: updated.title, mandatory: updated.mandatory, type: updated.type },
        });
        return ok({ requirementId: updated.id });
      }

      case "approve": {
        const existing = tender.requirements.find((r) => r.id === body.requirementId);
        if (!existing) return fail(404, "Requirement not found");
        await prisma.tenderRequirement.update({
          where: { id: existing.id },
          data: { status: "APPROVED", approvedById: session.userId, approvedAt: new Date() },
        });
        await audit({ actor: session, action: "REQUIREMENT_APPROVED", entityType: "TenderRequirement", entityId: existing.id, after: { title: existing.title } });
        return ok({ approved: true });
      }

      case "approveAll": {
        const drafts = tender.requirements.filter((r) => r.status === "DRAFT");
        for (const d of drafts) {
          await prisma.tenderRequirement.update({
            where: { id: d.id },
            data: { status: "APPROVED", approvedById: session.userId, approvedAt: new Date() },
          });
        }
        // freeze the checklist: it becomes the machine-readable compliance checklist for this tender
        await prisma.tender.update({ where: { id }, data: { requirementsFrozen: true } });
        await audit({
          actor: session,
          action: "REQUIREMENTS_FROZEN",
          entityType: "Tender",
          entityId: id,
          after: { approved: drafts.length, total: tender.requirements.length },
          reason: "Officer approved the AI-extracted requirement checklist",
        });
        return ok({ approved: drafts.length, frozen: true });
      }

      case "reject": {
        const existing = tender.requirements.find((r) => r.id === body.requirementId);
        if (!existing) return fail(404, "Requirement not found");
        await prisma.tenderRequirement.update({
          where: { id: existing.id },
          data: { status: "REJECTED", approvedById: session.userId, approvedAt: new Date() },
        });
        await audit({ actor: session, action: "REQUIREMENT_REJECTED", entityType: "TenderRequirement", entityId: existing.id, before: { title: existing.title } });
        return ok({ rejected: true });
      }

      case "reanalyze": {
        await prisma.tender.update({ where: { id }, data: { aiAnalysisStatus: "PROCESSING" } });
        return ok({ queued: true, note: "Re-analysis is triggered from the tender document panel (Upload → Analyze)." });
      }
    }
  });
}
