import { HttpError } from "@/lib/auth";

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>): Response {
  return Response.json({ ok: false, error, ...extra }, { status });
}

/** Wrap an API handler with uniform error translation. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return fail(err.status, err.message);
    console.error("API error", err);
    return fail(500, err instanceof Error ? err.message : "Internal server error");
  }
}
