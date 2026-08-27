/** Safe JSON helpers — works with both PostgreSQL Json columns and string-encoded columns. */

/**
 * Parse a value that may be a JSON string, a pre-parsed object, or null.
 * PostgreSQL Json columns return objects; SQLite string columns return strings.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value as T; // already parsed (PostgreSQL Json)
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Serialize a value to JSON string for writing to a Json column.
 * Prisma accepts both strings and objects for Json columns;
 * we stringify for consistency and backward compatibility.
 */
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
