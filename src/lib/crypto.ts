import crypto from "crypto";

/** Derive a 32-byte key for AES-256-GCM from the configured encryption key. */
function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || "bidverify-dev-key";
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt a secret for at-rest storage (AES-256-GCM). Output: v1:iv:tag:ciphertext (base64url parts). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(packed: string): string | null {
  try {
    const [version, ivB, tagB, dataB] = packed.split(":");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function sha256Hex(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Mask a secret for display: never return full values to clients. */
export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "••••";
  return value.slice(0, 3) + "••••" + value.slice(-3);
}

/** Deterministic PRNG seeded from a string — used by demo/simulated AI so results are stable per document. */
export function seededRandom(seed: string): () => number {
  let h = crypto.createHash("sha256").update(seed).digest().readUInt32BE(0) || 1;
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 0xffffffff;
  };
}
