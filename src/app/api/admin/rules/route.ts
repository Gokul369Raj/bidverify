import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ok, fail, handle } from "@/lib/api";
import { toJson } from "@/lib/json";

export async function GET() {
  return handle(async () => {
    // Admin panel has its own password gate (AdminGate component)
    const rules = await prisma.complianceRule.findMany({ where: { active: true }, orderBy: { code: "asc" }, include: { history: { orderBy: { version: "desc" }, take: 3 } } });
    return ok({ rules });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const session = await getSession();
    const { code, name, description, requirementType, expression, weight, active } = await req.json();
    if (!code || !name || !requirementType) return fail(400, "code, name, requirementType required");
    const existing = await prisma.complianceRule.findUnique({ where: { code } });
    if (existing) {
      const newVersion = existing.version + 1;
      await prisma.complianceRuleHistory.create({ data: { ruleId: existing.id, version: existing.version, changedById: session?.userId ?? "admin", changeJson: toJson({ before: existing.expressionJson, after: expression }), reason: "Rule updated" } });
      const updated = await prisma.complianceRule.update({ where: { id: existing.id }, data: { name, description: description || "", requirementType, expressionJson: toJson(expression ?? {}), weight: weight ?? 1, version: newVersion, active: active ?? true } });
      return ok({ ruleId: updated.id, version: newVersion });
    }
    const created = await prisma.complianceRule.create({ data: { code, name, description: description || "", requirementType, expressionJson: toJson(expression ?? {}), weight: weight ?? 1, active: active ?? true, createdById: session?.userId ?? "admin", approvedById: session?.userId ?? "admin" } });
    return ok({ ruleId: created.id, version: 1 });
  });
}
