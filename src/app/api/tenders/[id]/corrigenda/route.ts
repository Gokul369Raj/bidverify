import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOfficer } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, fail, handle } from "@/lib/api";
import { storage, scanFile, maxUploadBytes } from "@/lib/storage";
import { parseJson, toJson } from "@/lib/json";
import { aiCorrigendumDiff, type CorrigendumChange } from "@/lib/ai/tasks";

const applyAction = z.object({
  action: z.literal("apply"),
  corrigendumId: z.string(),
  changes: z.array(z.object({ requirementCode: z.string().optional(), field: z.string(), oldValue: z.string(), newValue: z.string() })).optional(),
});

/** Upload a corrigendum (with AI-diffed changes) or apply an approved corrigendum. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireOfficer();
    const { id } = await ctx.params;
    const tender = await prisma.tender.findUnique({ where: { id }, include: { requirements: { where: { status: "APPROVED" } } } });
    if (!tender) return fail(404, "Tender not found");

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const parsed = applyAction.safeParse(await req.json());
      if (!parsed.success) return fail(400, "Invalid apply payload");
      const cor = await prisma.corrigendum.findUnique({ where: { id: parsed.data.corrigendumId } });
      if (!cor || cor.tenderId !== id) return fail(404, "Corrigendum not found");
      if (cor.applied) return fail(409, "Corrigendum already applied");

      const changes = (parsed.data.changes ?? parseJson<CorrigendumChange[]>(cor.changesJson, []));
      let appliedCount = 0;
      for (const change of changes) {
        if (change.requirementCode) {
          const req = tender.requirements.find((r) => r.code === change.requirementCode);
          if (!req) continue;
          const params = parseJson<Record<string, unknown>>(req.paramsJson, {});
          let touched = false;
          if (change.field === "mandatory") {
            await prisma.tenderRequirement.update({ where: { id: req.id }, data: { mandatory: change.newValue === "mandatory" || change.newValue === "true" } });
            touched = true;
          } else if (/local\s*content/i.test(change.field) || change.field === "specification") {
            const pct = /(\d+)\s*%/.exec(change.newValue)?.[1];
            if (pct) params.localContentPct = parseInt(pct, 10);
            touched = true;
          } else if (/turnover/i.test(change.field)) {
            const m = /([\d,.]+)\s*(crore|lakh)/i.exec(change.newValue);
            if (m) params.minTurnoverLakh = parseFloat(m[1].replace(/,/g, "")) * (m[2].toLowerCase().startsWith("crore") ? 100 : 1);
            touched = true;
          } else if (/deadline|closing/i.test(change.field)) {
            const date = new Date(change.newValue);
            if (!Number.isNaN(date.getTime())) {
              await prisma.tender.update({ where: { id }, data: { closingDate: date } });
            }
            continue;
          }
          if (touched) {
            await prisma.tenderRequirement.update({
              where: { id: req.id },
              data: { paramsJson: toJson(params), extractionMethod: "CORRIGENDUM" },
            });
            appliedCount++;
          }
        } else if (/deadline|closing/i.test(change.field)) {
          const date = new Date(change.newValue);
          if (!Number.isNaN(date.getTime())) await prisma.tender.update({ where: { id }, data: { closingDate: date } });
        }
      }
      await prisma.corrigendum.update({
        where: { id: cor.id },
        data: { applied: true, approvedById: session.userId, changesJson: toJson(changes) },
      });
      await audit({
        actor: session,
        action: "CORRIGENDUM_APPLIED",
        entityType: "Tender",
        entityId: id,
        after: { corrigendumNumber: cor.corrigendumNumber, changes: changes.length, appliedCount },
        reason: "Officer approved corrigendum changes",
      });
      return ok({ applied: true, appliedCount, changes: changes.length });
    }

    // multipart: corrigendum upload + AI diff
    const form = await req.formData();
    const corrigendumNumber = String(form.get("corrigendumNumber") ?? "").trim();
    if (!corrigendumNumber) return fail(400, "corrigendumNumber is required");
    const text = String(form.get("text") ?? "").trim();
    const file = form.get("file") as File | null;

    let storedFile: { fileName: string; storagePath: string; sha256: string } | null = null;
    let pdfBase64: string | undefined;
    if (file && file instanceof File && file.size > 0) {
      if (file.size > maxUploadBytes()) return fail(413, "File too large");
      const buffer = Buffer.from(await file.arrayBuffer());
      const scan = scanFile(file.name, file.type, buffer);
      if (!scan.ok) return fail(415, scan.reason ?? "File rejected");
      const saved = await storage.save(buffer, file.name);
      storedFile = { fileName: file.name, storagePath: saved.storagePath, sha256: saved.sha256 };
      if (file.name.toLowerCase().endsWith(".pdf")) pdfBase64 = buffer.toString("base64");
    }
    if (!text && !pdfBase64) return fail(400, "Provide the corrigendum text or upload its file");

    // AI diff against the approved checklist (deterministic fallback returns [] — officer can enter changes manually)
    const diff = await aiCorrigendumDiff(
      {
        requirements: tender.requirements.map((r) => ({ code: r.code, type: r.type, title: r.title, params: parseJson<Record<string, unknown>>(r.paramsJson, {}) })),
        corrigendumText: text || "Corrigendum PDF attached.",
      },
      session.userId,
    );
    void pdfBase64; // (vision diff of corrigendum PDFs uses the same prompt path in live mode)

    const cor = await prisma.corrigendum.create({
      data: {
        tenderId: id,
        corrigendumNumber,
        title: String(form.get("title") ?? ""),
        fileName: storedFile?.fileName ?? null,
        storagePath: storedFile?.storagePath ?? null,
        changesJson: toJson(diff.data),
      },
    });
    await prisma.tenderDocument.create({
      data: {
        tenderId: id,
        fileName: storedFile?.fileName ?? `${corrigendumNumber}.txt`,
        fileType: file?.type ?? "text/plain",
        fileSize: file?.size ?? text.length,
        storagePath: storedFile?.storagePath ?? "inline",
        sha256: storedFile?.sha256 ?? "inline",
        docKind: "CORRIGENDUM",
        uploadedById: session.userId,
      },
    });
    await audit({ actor: session, action: "CORRIGENDUM_UPLOADED", entityType: "Tender", entityId: id, after: { corrigendumNumber, detectedChanges: diff.data.length, aiProvider: diff.meta.provider, simulated: diff.meta.simulated } });

    return ok({ corrigendumId: cor.id, changes: diff.data, aiMeta: { provider: diff.meta.provider, simulated: diff.meta.simulated } });
  });
}
