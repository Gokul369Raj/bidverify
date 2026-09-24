import path from "path";
import crypto from "crypto";
import { sha256Hex } from "@/lib/crypto";

/**
 * Storage abstraction. On Vercel, local filesystem is read-only —
 * all file operations go through Supabase Storage.
 */

export interface StorageAdapter {
  save(buffer: Buffer, originalName: string): Promise<{ storagePath: string; sha256: string; size: number }>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

class SupabaseStorageAdapter implements StorageAdapter {
  async save(buffer: Buffer, originalName: string): Promise<{ storagePath: string; sha256: string; size: number }> {
    const dir = new Date().toISOString().slice(0, 10);
    const ext = path.extname(originalName).slice(0, 10).replace(/[^.\w]/g, "");
    const name = crypto.randomUUID() + ext;
    const storagePath = `${dir}/${name}`;
    const { uploadToStorage } = await import("@/lib/supabase");
    const { STORAGE_BUCKETS } = await import("@/lib/supabase");
    await uploadToStorage(STORAGE_BUCKETS.BID_DOCS, storagePath, buffer, "application/octet-stream");
    return { storagePath, sha256: sha256Hex(buffer), size: buffer.byteLength };
  }

  async read(storagePath: string): Promise<Buffer> {
    const { getSupabaseServer, STORAGE_BUCKETS } = await import("@/lib/supabase");
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.BID_DOCS).download(storagePath);
    if (error) throw error;
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const { deleteFromStorage, STORAGE_BUCKETS } = await import("@/lib/supabase");
      await deleteFromStorage(STORAGE_BUCKETS.BID_DOCS, [storagePath]);
    } catch { /* already gone */ }
  }
}

export const storage: StorageAdapter = new SupabaseStorageAdapter();

/** Malware-scanning hook: currently validates extension/mime allowlist; plug a ClamAV/VirusTotal call here. */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx", ".txt", ".md", ".json", ".csv", ".zip"];

export const ALLOWED_UPLOAD_MIMES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/octet-stream",
];

export function scanFile(fileName: string, mimeType: string, buffer: Buffer): { ok: boolean; reason?: string } {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: `File type ${ext || "(none)"} not allowed` };
  }
  if (mimeType && !ALLOWED_UPLOAD_MIMES.includes(mimeType)) {
    return { ok: false, reason: `MIME type ${mimeType} not allowed` };
  }
  const hex = buffer.subarray(0, 4).toString("hex");
  const isZip = hex.startsWith("504b");
  if (ext === ".pdf" && hex !== "25504446") return { ok: false, reason: "File does not match declared PDF signature" };
  if ([".docx", ".xlsx", ".zip"].includes(ext) && !isZip) return { ok: false, reason: "File does not match declared Office/ZIP signature" };
  if (buffer.subarray(0, 2).toString() === "MZ") return { ok: false, reason: "Executable content rejected" };
  return { ok: true };
}

export function maxUploadBytes(): number {
  return (parseInt(process.env.MAX_UPLOAD_MB || "25", 10) || 25) * 1024 * 1024;
}
