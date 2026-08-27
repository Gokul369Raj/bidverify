import type { AiProvider, CompleteOptions, CompleteResult } from "./types";

/** Shared JSON-repair for providers that wrap output in markdown fences. */
export function stripJsonFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return t.trim();
}

export class ProviderCallError extends Error {
  constructor(message: string, public status?: number, public retryable: boolean = false) {
    super(message);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────── Gemini (primary) ───────────────────────────

export class GeminiProvider implements AiProvider {
  name = "gemini" as const;

  configured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ProviderCallError("GEMINI_API_KEY not configured");
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const parts: Record<string, unknown>[] = [];
    if (opts.system) parts.push({ text: opts.system });
    parts.push({ text: opts.prompt });
    for (const img of opts.images ?? []) {
      parts.push({ inline_data: { mime_type: img.mime, data: img.dataBase64 } });
    }
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxTokens ?? 4096,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderCallError(`Gemini API error ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status, retryable);
    }
    const json = await res.json();
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) throw new ProviderCallError("Gemini returned empty response", 502, true);
    return {
      text,
      tokensUsed: (json.usageMetadata?.promptTokenCount ?? 0) + (json.usageMetadata?.candidatesTokenCount ?? 0),
      model,
    };
  }
}

// ─────────────────────────── OpenAI (secondary) ───────────────────────────

export class OpenAIProvider implements AiProvider {
  name = "openai" as const;

  configured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ProviderCallError("OPENAI_API_KEY not configured");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const content: Record<string, unknown>[] = [{ type: "text", text: opts.prompt }];
    for (const img of opts.images ?? []) {
      content.push({ type: "image_url", image_url: { url: `data:${img.mime};base64,${img.dataBase64}` } });
    }
    const body: Record<string, unknown> = {
      model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 4096,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content },
      ],
    };
    if (opts.json) body.response_format = { type: "json_object" };
    const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      throw new ProviderCallError(`OpenAI API error ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status, retryable);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) throw new ProviderCallError("OpenAI returned empty response", 502, true);
    return { text, tokensUsed: json.usage?.total_tokens ?? 0, model };
  }
}

// ─────────────────────────── Local (Ollama-compatible) ───────────────────────────

export class LocalProvider implements AiProvider {
  name = "local" as const;

  configured(): boolean {
    return process.env.LOCAL_AI_ENABLED === "true" && Boolean(process.env.LOCAL_AI_BASE_URL);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const base = process.env.LOCAL_AI_BASE_URL || "http://localhost:11434";
    const model = process.env.LOCAL_AI_MODEL || "llama3.1";
    const body: Record<string, unknown> = {
      model,
      stream: false,
      options: { temperature: opts.temperature ?? 0.2 },
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        ...(opts.json ? [{ role: "system", content: "Respond with a single valid JSON object and nothing else." }] : []),
        { role: "user", content: opts.images?.length ? opts.prompt : opts.prompt },
      ],
    };
    const res = await fetchWithTimeout(`${base.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ProviderCallError(`Local AI error ${res.status}`, res.status, res.status >= 500);
    }
    const json = await res.json();
    const text = json.message?.content ?? "";
    if (!text) throw new ProviderCallError("Local AI returned empty response", 502, true);
    return { text, tokensUsed: Math.ceil((opts.prompt.length + text.length) / 4), model };
  }
}
