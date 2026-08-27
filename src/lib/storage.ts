import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { sha256Hex } from "@/lib/crypto";

/**
 * Storage abstraction. LocalStorageAdapter keeps files under ./storage with opaque
 * hashed names; physical paths are never exposed to clients. A future
 * S3CompatibleAdapter can implement the same interface.
 */
export interface StorageAdapter {
  save(buffer: Buffer, originalName: string): Promise<{ storagePath: string; sha256: string; size: number }>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}

const ROOT = path.join(process.cwd(), "storage");

function safeJoin(relative: string): string {
  const full = path.join(ROOT, relative);
  if (!full.startsWith(ROOT)) throw new Error("Path traversal blocked");
  return full;
}

class LocalStorageAdapter implements StorageAdapter {
  async save(buffer: Buffer, originalName: string): Promise<{ storagePath: string; sha256: string; size: number }> {
    const dir = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await fs.mkdir(path.join(ROOT, dir), { recursive: true });
    const ext = path.extname(originalName).slice(0, 10).replace(/[^.\w]/g, "");
    const name = crypto.randomUUID() + ext;
    const relative = path.join(dir, name);
    await fs.writeFile(safeJoin(relative), buffer);
    return { storagePath: relative, sha256: sha256Hex(buffer), size: buffer.byteLength };
  }

  async read(storagePath: string): Promise<Buffer> {
    return fs.readFile(safeJoin(storagePath));
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(safeJoin(storagePath));
    } catch {
      /* already gone */
    }
  }
}

export const storage: StorageAdapter = new LocalStorageAdapter();

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
  "application/octet-stream", // browsers often send this for docx/zip
];

export function scanFile(fileName: string, mimeType: string, buffer: Buffer): { ok: boolean; reason?: string } {
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: `File type ${ext || "(none)"} not allowed` };
  }
  if (mimeType && !ALLOWED_UPLOAD_MIMES.includes(mimeType)) {
    return { ok: false, reason: `MIME type ${mimeType} not allowed` };
  }
  // Signature check for the most common types (stops naive disguised executables)
  const hex = buffer.subarray(0, 4).toString("hex");
  const isZip = hex.startsWith("504b"); // zip/docx/xlsx
  if (ext === ".pdf" && hex !== "25504446") return { ok: false, reason: "File does not match declared PDF signature" };
  if ([".docx", ".xlsx", ".zip"].includes(ext) && !isZip) return { ok: false, reason: "File does not match declared Office/ZIP signature" };
  if (buffer.subarray(0, 2).toString() === "MZ") return { ok: false, reason: "Executable content rejected" };
  return { ok: true };
}

export function maxUploadBytes(): number {
  return (parseInt(process.env.MAX_UPLOAD_MB || "25", 10) || 25) * 1024 * 1024;
}
