import { prisma } from "@/lib/db";
import { getAiSettings, saveAiSettings } from "@/lib/ai/orchestrator";
import { ok, handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    // Admin panel has its own password gate (AdminGate component)
    const ai = await getAiSettings();
    const integrations = await prisma.apiIntegration.findMany({ where: { provider: { not: "PLATFORM_AI" } }, orderBy: { provider: "asc" } });
    return ok({ ai, integrations });
  });
}

export async function PATCH(req: Request) {
  return handle(async () => {
    const body = await req.json();
    if (body.ai) await saveAiSettings(body.ai);
    if (body.integration) {
      const i = body.integration;
      await prisma.apiIntegration.upsert({
        where: { provider: i.provider },
        update: { endpoint: i.endpoint ?? undefined, environment: i.environment ?? "SANDBOX", status: i.status ?? "NOT_CONFIGURED", configJson: JSON.stringify(i.config ?? {}) },
        create: { provider: i.provider, endpoint: i.endpoint ?? null, environment: i.environment ?? "SANDBOX", status: i.status ?? "NOT_CONFIGURED", configJson: JSON.stringify(i.config ?? {}) },
      });
    }
    return ok({ saved: true });
  });
}
