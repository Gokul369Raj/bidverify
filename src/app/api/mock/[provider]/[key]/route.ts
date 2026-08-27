import { prisma } from "@/lib/db";
import { ok, fail, handle } from "@/lib/api";
import { parseJson } from "@/lib/json";

const ALLOWED = new Set(["GST", "PAN", "UDYAM", "MCA", "DIGILOCKER", "BLACKLIST"]);

/** Mock government API simulators. Every response includes SIMULATED_DATA=true. */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string; key: string }> }) {
  return handle(async () => {
    const { provider, key } = await ctx.params;
    const p = provider.toUpperCase();
    if (!ALLOWED.has(p)) return fail(400, "Unknown provider");
    const row = await prisma.mockRegistry.findUnique({ where: { registry_key: { registry: p as never, key: decodeURIComponent(key) } } });
    const data = row ? parseJson<Record<string, unknown>>(row.dataJson, {}) : { error: "Not found in the simulated registry", SIMULATED_DATA: true };
    return ok({ provider: p, key: decodeURIComponent(key), ...data, SIMULATED_DATA: true });
  });
}
