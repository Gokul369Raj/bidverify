import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { sha256Hex, seededRandom } from "@/lib/crypto";
import { GeminiProvider, OpenAIProvider, LocalProvider, ProviderCallError, stripJsonFences } from "./providers";
import type { AiProvider, AiTask, CompleteOptions, PlatformAiSettings, AiOutcome } from "./types";

export const providers = {
  gemini: new GeminiProvider(),
  openai: new OpenAIProvider(),
  local: new LocalProvider(),
};

const DEFAULT_SETTINGS: PlatformAiSettings = {
  provider: "auto",
  visionEnabled: true,
  documentAnalysisEnabled: true,
};

/** Platform AI settings come from the ApiIntegration row 'PLATFORM_AI' (admin-editable) with env fallbacks. */
export async function getAiSettings(): Promise<PlatformAiSettings> {
  let stored: PlatformAiSettings | null = null;
  try {
    const row = await prisma.apiIntegration.findUnique({ where: { provider: "PLATFORM_AI" } });
    if (row) stored = parseJson<PlatformAiSettings>(row.configJson, null as unknown as PlatformAiSettings);
  } catch {
    /* db not ready */
  }
  const envProvider = (process.env.AI_PROVIDER as PlatformAiSettings["provider"]) || "auto";
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    provider: stored?.provider ?? envProvider,
  };
}

export async function saveAiSettings(patch: Partial<PlatformAiSettings>): Promise<PlatformAiSettings> {
  const current = await getAiSettings();
  const next = { ...current, ...patch };
  await prisma.apiIntegration.upsert({
    where: { provider: "PLATFORM_AI" },
    update: { configJson: JSON.stringify(next), status: "ACTIVE" },
    create: { provider: "PLATFORM_AI", configJson: JSON.stringify(next), status: "ACTIVE" },
  });
  return next;
}

/** Resolve the provider to use, or null when none is configured (demo/simulated mode). */
export function resolveProvider(settings: PlatformAiSettings): AiProvider | null {
  const order: AiProvider[] =
    settings.provider === "auto"
      ? [providers.gemini, providers.openai, providers.local]
      : settings.provider === "gemini"
        ? [providers.gemini]
        : settings.provider === "openai"
          ? [providers.openai]
          : [providers.local];
  for (const p of order) if (p.configured()) return p;
  return null;
}

// ── response cache + concurrent request dedupe ──

interface CacheEntry {
  value: unknown;
  meta: { provider: string; model: string; tokensUsed?: number };
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(opts: CompleteOptions, model: string): string {
  return sha256Hex(JSON.stringify({ task: opts.task, prompt: opts.prompt, system: opts.system, json: opts.json, model, images: (opts.images ?? []).map((i) => sha256Hex(i.dataBase64.slice(0, 4096))) }));
}

async function completeWithRetry(provider: AiProvider, opts: CompleteOptions, maxRetries = 2): Promise<{ text: string; tokensUsed: number; model: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.complete(opts);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof ProviderCallError ? err.retryable : true;
      if (!retryable || attempt === maxRetries) throw err;
      const backoff = 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

export interface RunJsonOptions<T> extends CompleteOptions {
  /** deterministic fallback executed when no provider is configured or the provider call fails */
  fallback: () => T;
  actorId?: string | null;
  /** disable response caching for this call */
  noCache?: boolean;
}

/**
 * Run an AI task with the full reliability envelope: settings-driven routing,
 * response caching, concurrent dedupe, retry with exponential backoff, and a
 * deterministic simulated fallback. Every outcome is recorded in ai_runs.
 */
export async function runJson<T>(opts: RunJsonOptions<T>): Promise<AiOutcome<T>> {
  const settings = await getAiSettings();
  const provider = resolveProvider(settings);
  const started = Date.now();

  const recordRun = async (status: string, providerName: string, model: string, output: unknown, tokens?: number, error?: string) => {
    try {
      const run = await prisma.aiRun.create({
        data: {
          task: opts.task,
          provider: providerName,
          model,
          status,
          inputRefJson: JSON.stringify({ promptChars: opts.prompt.length, images: opts.images?.length ?? 0 }),
          outputJson: JSON.stringify(output).slice(0, 8000),
          tokensUsed: tokens ?? null,
          durationMs: Date.now() - started,
          error: error ?? null,
          createdById: opts.actorId ?? null,
        },
      });
      return run.id;
    } catch {
      return undefined;
    }
  };

  const simulatedOutcome = async (fallbackReason?: string): Promise<AiOutcome<T>> => {
    const data = opts.fallback();
    const runId = await recordRun("SIMULATED", "heuristic", "deterministic-v1", data, undefined, fallbackReason);
    return {
      data,
      meta: {
        provider: "heuristic",
        model: "deterministic-v1",
        simulated: true,
        durationMs: Date.now() - started,
        runId,
        fallbackReason,
      },
    };
  };

  if (!provider) {
    return simulatedOutcome("No AI provider configured — DEMO MODE deterministic fallback used");
  }

  const model = provider.name === "gemini" ? process.env.GEMINI_MODEL || "gemini-2.0-flash" : provider.name === "openai" ? process.env.OPENAI_MODEL || "gpt-4o-mini" : process.env.LOCAL_AI_MODEL || "llama3.1";
  const key = cacheKey(opts, model);

  if (!opts.noCache && !opts.images?.length) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        data: cached.value as T,
        meta: { provider: cached.meta.provider, model: cached.meta.model, simulated: false, tokensUsed: cached.meta.tokensUsed, durationMs: Date.now() - started, fallbackReason: "cache" },
      };
    }
    const existing = inflight.get(key);
    if (existing) {
      const outcome = (await existing) as AiOutcome<T>;
      return { data: outcome.data, meta: { ...outcome.meta, durationMs: Date.now() - started, fallbackReason: "deduplicated" } };
    }
  }

  const exec = (async (): Promise<AiOutcome<T>> => {
    try {
      const effective: CompleteOptions = {
        ...opts,
        temperature: opts.temperature ?? settings.temperature ?? 0.2,
        maxTokens: opts.maxTokens ?? settings.maxTokens ?? 4096,
        images: settings.visionEnabled ? opts.images : undefined,
      };
      const res = await completeWithRetry(provider, effective);
      const text = stripJsonFences(res.text);
      let data: T;
      try {
        data = JSON.parse(text) as T;
      } catch {
        // one repair attempt: ask the model to fix its own JSON
        const repair = await completeWithRetry(provider, {
          ...opts,
          prompt: `The following was supposed to be a single valid JSON object but is malformed. Return ONLY the corrected JSON object, nothing else.\n\n${text.slice(0, 6000)}`,
          images: undefined,
        });
        data = JSON.parse(stripJsonFences(repair.text)) as T;
      }
      const runId = await recordRun("COMPLETED", provider.name, res.model, { ok: true }, res.tokensUsed);
      if (!opts.noCache && !opts.images?.length) {
        responseCache.set(key, { value: data, meta: { provider: provider.name, model: res.model, tokensUsed: res.tokensUsed }, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return { data, meta: { provider: provider.name, model: res.model, simulated: false, tokensUsed: res.tokensUsed, durationMs: Date.now() - started, runId } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // graceful degradation: AI failure never breaks the pipeline
      return simulatedOutcome(`AI provider failed (${message}) — deterministic fallback used`);
    }
  })();

  if (!opts.noCache && !opts.images?.length) {
    inflight.set(key, exec as Promise<unknown>);
    exec.finally(() => inflight.delete(key)).catch(() => undefined);
  }
  return exec;
}

/** Deterministic seed helper re-exported for task modules. */
export { seededRandom };
