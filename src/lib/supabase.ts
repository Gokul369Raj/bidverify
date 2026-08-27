// Supabase client utilities — server-side and browser-side
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Server-side client (service role — full access) ────────
// Use in API routes / server actions for admin-level DB access.
// NEVER expose service role key to the browser.

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let _serverClient: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (!_serverClient) {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        "Supabase server client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.",
      );
    }
    _serverClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _serverClient;
}

// ── Browser-side client (anon key — user-scoped) ───────────
// Use in client components. Requires NEXT_PUBLIC_ prefix.
// This client respects Supabase RLS policies.

let _browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (_browserClient) return _browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY env vars.",
    );
  }

  _browserClient = createClient(url, anonKey);
  return _browserClient;
}

// ── Storage helpers ─────────────────────────────────────────
// Supabase Storage buckets:
//   "tender-docs"  — uploaded tender PDFs / corrigenda
//   "bid-docs"     — bidder-uploaded compliance documents

export const STORAGE_BUCKETS = {
  TENDER_DOCS: "tender-docs",
  BID_DOCS: "bid-docs",
} as const;

/**
 * Upload a file to Supabase Storage.
 * Returns the public/supabase URL of the stored object.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  file: Buffer | ArrayBuffer,
  contentType: string,
): Promise<{ path: string; url: string }> {
  const supabase = getSupabaseServer();

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return { path, url: urlData.publicUrl };
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFromStorage(
  bucket: string,
  paths: string[],
): Promise<void> {
  const supabase = getSupabaseServer();
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

/**
 * Get a signed URL for private file access (expires in seconds).
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
