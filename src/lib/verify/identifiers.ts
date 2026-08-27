/**
 * Cryptographic / structural identifier validators.
 *
 * These are DETERMINISTIC checks derived from publicly documented formats:
 *  - GSTIN: 15-char structure, state code, embedded PAN, mod-36 checksum
 *  - PAN:   [A-Z]{5}[0-9]{4}[A-Z] + entity-type character semantics
 *  - Udyam: UDYAM-XX-00-0000000 structure
 *  - CIN:   L/U + industry + state + year + ownership + serial
 *
 * A syntactically VALID identifier is NOT an officially VERIFIED identifier.
 * Official verification requires an authorized government source — see
 * src/lib/verification (provider states such as REQUIRES_AUTHORIZATION).
 */

export interface IdentifierValidation {
  field: string;
  value: string;
  valid: boolean;
  /** Deterministic-format confidence. This is NOT verification authority. */
  confidence: number;
  checks: { check: string; passed: boolean; detail?: string }[];
  errors: string[];
  meta?: Record<string, unknown>;
}

const GST_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Valid GST state codes (as per GST common portal documentation). */
const GST_STATE_CODES = new Set([
  "01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16",
  "17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32",
  "33","34","35","36","37","38","97","99",
]);

export const GST_STATE_NAMES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra",
  "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
  "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
};

/** Compute the GSTIN mod-36 checksum character for the first 14 characters. */
export function gstinChecksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = GST_CHARSET.indexOf(first14[i].toUpperCase());
    if (val < 0) return "?";
    const factor = i % 2 === 0 ? 1 : 2;
    const product = val * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARSET[(36 - (sum % 36)) % 36];
}

export function validateGSTIN(raw: string | undefined | null): IdentifierValidation {
  const value = (raw ?? "").trim().toUpperCase();
  const checks: IdentifierValidation["checks"] = [];
  const errors: string[] = [];

  const push = (check: string, passed: boolean, detail?: string) => {
    checks.push({ check, passed, detail });
    if (!passed) errors.push(detail ?? check);
  };

  push("length_15", value.length === 15, value.length === 15 ? undefined : `Expected 15 characters, got ${value.length}`);
  push("pattern", /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(value), "Structure must be NNAAAA NNNNA AZ (alphanumeric with trailing Z before check char)");

  const meta: Record<string, unknown> = {};
  if (value.length === 15) {
    const stateCode = value.slice(0, 2);
    const stateOk = GST_STATE_CODES.has(stateCode);
    push("state_code", stateOk, stateOk ? `State code ${stateCode} (${GST_STATE_NAMES[stateCode] ?? "unknown"})` : `Invalid GST state code ${stateCode}`);
    meta.stateCode = stateCode;
    meta.stateName = GST_STATE_NAMES[stateCode];

    const embeddedPan = value.slice(2, 12);
    const panOk = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(embeddedPan);
    push("pan_segment", panOk, panOk ? `Embedded PAN ${embeddedPan}` : "Characters 3–12 are not a structurally valid PAN");
    meta.embeddedPan = panOk ? embeddedPan : undefined;

    if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[A-Z0-9]$/.test(value)) {
      const expected = gstinChecksumChar(value.slice(0, 14));
      const actual = value[14];
      const checksumOk = actual === expected;
      push("mod36_checksum", checksumOk, checksumOk ? `Checksum '${actual}' matches computed '${expected}'` : `Checksum mismatch: got '${actual}', computed '${expected}'`);
      meta.checksumValid = checksumOk;
    }
  }

  const failed = checks.filter((c) => !c.check.includes("checksum") && !c.passed).length;
  const checksumCheck = checks.find((c) => c.check === "mod36_checksum");
  const valid = checks.every((c) => c.passed);
  // Confidence reflects deterministic format strength only.
  const confidence = valid ? 0.99 : checksumCheck?.passed ? 0.85 : failed === 0 ? 0.7 : 0.3;

  return { field: "gstin", value, valid, confidence, checks, errors, meta };
}

const PAN_ENTITY_TYPES: Record<string, string> = {
  P: "Individual", C: "Company", H: "Hindu Undivided Family", F: "Firm/LLP",
  A: "Association of Persons", T: "Trust", B: "Body of Individuals",
  L: "Local Authority", J: "Artificial Juridical Person", G: "Government",
};

export function validatePAN(raw: string | undefined | null): IdentifierValidation {
  const value = (raw ?? "").trim().toUpperCase();
  const checks: IdentifierValidation["checks"] = [];
  const errors: string[] = [];
  const push = (check: string, passed: boolean, detail?: string) => {
    checks.push({ check, passed, detail });
    if (!passed) errors.push(detail ?? check);
  };

  push("length_10", value.length === 10, value.length === 10 ? undefined : `Expected 10 characters, got ${value.length}`);
  const patternOk = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
  push("pattern", patternOk, "Structure must be AAAAA NNNN A");

  const meta: Record<string, unknown> = {};
  if (patternOk) {
    const entityType = value[3];
    meta.entityType = PAN_ENTITY_TYPES[entityType] ?? "Unknown";
    push("entity_type_known", Boolean(PAN_ENTITY_TYPES[entityType]), `${entityType} = ${meta.entityType}`);
  }

  const valid = checks.every((c) => c.passed);
  return { field: "pan", value, valid, confidence: valid ? 0.95 : 0.3, checks, errors, meta };
}

export function validateUdyam(raw: string | undefined | null): IdentifierValidation {
  const value = (raw ?? "").trim().toUpperCase();
  const checks: IdentifierValidation["checks"] = [];
  const errors: string[] = [];
  const push = (check: string, passed: boolean, detail?: string) => {
    checks.push({ check, passed, detail });
    if (!passed) errors.push(detail ?? check);
  };
  const patternOk = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(value);
  push("pattern", patternOk, "Format must be UDYAM-AA-NN-NNNNNNN");
  const meta: Record<string, unknown> = {};
  if (patternOk) {
    meta.stateCode = value.slice(6, 8);
    push("district_digits", /^\d{2}$/.test(value.slice(9, 11)), `District code ${value.slice(9, 11)}`);
  }
  const valid = checks.every((c) => c.passed);
  return { field: "udyamNumber", value, valid, confidence: valid ? 0.95 : 0.35, checks, errors, meta };
}

export function validateCIN(raw: string | undefined | null): IdentifierValidation {
  const value = (raw ?? "").trim().toUpperCase();
  const ok = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{2,3}\d{6}$/.test(value);
  const checks: IdentifierValidation["checks"] = [
    { check: "cin_pattern", passed: ok, detail: "L/U + 5-digit industry + 2-letter state + year + ownership + 6-digit serial" },
  ];
  return { field: "cin", value, valid: ok, confidence: ok ? 0.92 : 0.3, checks, errors: ok ? [] : ["CIN structure invalid"] };
}

/** Run every validator applicable to an extracted-field bag. */
export function validateExtractedIdentifiers(fields: Record<string, string>): IdentifierValidation[] {
  const out: IdentifierValidation[] = [];
  if (fields.gstin && fields.gstin !== "NOT_FOUND_IN_SOURCE") out.push(validateGSTIN(fields.gstin));
  if (fields.pan && fields.pan !== "NOT_FOUND_IN_SOURCE") out.push(validatePAN(fields.pan));
  if (fields.udyamNumber && fields.udyamNumber !== "NOT_FOUND_IN_SOURCE") out.push(validateUdyam(fields.udyamNumber));
  if (fields.cin && fields.cin !== "NOT_FOUND_IN_SOURCE") out.push(validateCIN(fields.cin));
  return out;
}
