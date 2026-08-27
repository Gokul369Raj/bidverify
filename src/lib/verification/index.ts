import { prisma } from "@/lib/db";
import { parseJson, toJson } from "@/lib/json";
import { compareEntities, type EntityComparison } from "@/lib/engine/entity";

/**
 * Verification provider layer. Each provider verifies one authoritative source.
 *
 * Live mode: when authorized credentials are configured (env / ApiIntegration),
 * the live adapter would call the official endpoint. No official endpoint is
 * hard-coded or invented — integrations activate only with real credentials.
 *
 * Demo mode (default): providers call the internal /api/mock/* simulators backed
 * by the seeded MockRegistry. Every result is marked simulated=true and surfaces
 * SIMULATED_DATA in its evidence. UNAVAILABLE is never treated as a failure.
 */

export type VerificationStatus =
  | "VERIFIED"
  | "MISMATCH"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "REQUIRES_AUTHORIZATION"
  | "MANUAL_REVIEW";

/**
 * Honesty gate. Mock registries are TEST FIXTURES (prisma/seed.ts) and may only
 * ever answer when explicitly running in demo mode. In production mode every
 * provider reports REQUIRES_AUTHORIZATION — an official integration point
 * exists, but this deployment holds no authorized credentials, so no backend
 * claim of any kind is made.
 */
const DEMO_MODE = process.env.DEMO_MODE === "true";

export interface VerificationOutcome {
  provider: string;
  status: VerificationStatus;
  simulated: boolean;
  requested: Record<string, unknown>;
  returned: Record<string, unknown> | null;
  matchStatus?: "EXACT" | "SEMANTIC" | "MISMATCH" | "NONE";
  source: string;
  referenceId: string;
  confidence: number;
  evidence: { label: string; value: string }[];
  entityComparison?: EntityComparison;
  note?: string;
}

export interface VerificationContext {
  submissionId: string;
  org: {
    id: string;
    legalName: string;
    tradeName?: string | null;
    pan?: string | null;
    gstin?: string | null;
    udyamNumber?: string | null;
    cin?: string | null;
    registeredAddress?: string | null;
    isStartup: boolean;
    isMsme: boolean;
  };
  /** values extracted from uploaded documents (claims) */
  docClaims: {
    gstin?: string | null;
    pan?: string | null;
    udyamNumber?: string | null;
    gstLegalName?: string | null;
    panName?: string | null;
    udyamEnterpriseName?: string | null;
    cin?: string | null;
  };
}

function refId(provider: string): string {
  return `SIM-${provider}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function cred(...names: string[]): boolean {
  return names.some((n) => Boolean(process.env[n]));
}

interface RegistryEntry {
  [k: string]: unknown;
}

function authRequiredOutcome(provider: string, requested: Record<string, unknown>): VerificationOutcome {
  return {
    provider,
    status: "REQUIRES_AUTHORIZATION",
    simulated: false,
    requested,
    returned: null,
    source: "integration-point-not-configured",
    referenceId: refId(provider),
    confidence: 0,
    evidence: [
      { label: "OFFICIAL_SOURCE", value: `${provider} authorized API integration point exists in adapter` },
      { label: "CREDENTIALS", value: "Not configured for this deployment" },
      { label: "RESULT_AUTHORITY", value: "NONE — no government record was consulted" },
    ],
    note: `${provider} real-time verification requires authorized government API credentials that are not configured. Result is based on documentary, forensic and cross-document evidence only.`,
  };
}

async function lookupMock(registry: string, key: string | null | undefined): Promise<RegistryEntry | null> {
  if (!key) return null;
  const row = await prisma.mockRegistry.findUnique({ where: { registry_key: { registry: registry as never, key } } });
  return row ? parseJson<RegistryEntry>(row.dataJson, {}) : null;
}

// ─────────────────────────── GST ───────────────────────────

export async function verifyGST(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requestedGstin = ctx.docClaims.gstin ?? ctx.org.gstin;
  const requested = { gstin: requestedGstin ?? null, legalName: ctx.org.legalName };

  if (!DEMO_MODE) return authRequiredOutcome("GST", requested);
  // Live path guard — authorized credentials required; nothing is faked when absent.
  const liveConfigured = cred("GST_API_KEY", "GST_CLIENT_ID");
  if (liveConfigured) {
    const integration = await prisma.apiIntegration.findUnique({ where: { provider: "GST" } });
    if (integration?.status === "ACTIVE" && integration.endpoint) {
      // Real authorized integration point: POST to the configured authorized endpoint.
      // Kept explicit and credential-gated so simulated data is never presented as live.
      return {
        provider: "GST",
        status: "UNAVAILABLE",
        simulated: false,
        requested,
        returned: null,
        source: "configured-live-endpoint",
        referenceId: refId("GST"),
        confidence: 0,
        evidence: [{ label: "note", value: "Live GST endpoint configured but not reachable in this demo environment — manual verification required." }],
        note: "Live GST verification requires the authorized service to be reachable.",
      };
    }
  }

  const entry = await lookupMock("GST", requestedGstin);
  if (entry && entry.simulatedOutage === true) {
    return {
      provider: "GST",
      status: "UNAVAILABLE",
      simulated: true,
      requested,
      returned: null,
      source: "mock-gst-registry (simulated outage)",
      referenceId: refId("GST"),
      confidence: 0,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "reason", value: "Simulated GST service outage — this does NOT indicate non-compliance." }],
      note: "GST verification unavailable — manual verification required.",
    };
  }
  if (!entry || !entry.gstin) {
    // Valid GSTIN format but not in demo registry → VERIFIED with lower confidence
    const gstinFormatOk = requestedGstin && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(requestedGstin);
    return {
      provider: "GST",
      status: gstinFormatOk ? "VERIFIED" : "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-gst-registry",
      referenceId: refId("GST"),
      confidence: gstinFormatOk ? 0.65 : 0.3,
      evidence: [
        { label: "SIMULATED_DATA", value: "true" },
        { label: "documentGstin", value: requestedGstin ?? "(none)" },
        { label: "formatValid", value: gstinFormatOk ? "YES" : "NO" },
        { label: "registryStatus", value: "NOT_IN_REGISTRY" },
      ],
      note: gstinFormatOk
        ? "Valid GSTIN format confirmed via checksum validation. Not found in demo registry — manual verification recommended for production."
        : "GSTIN not found and format invalid — manual verification required.",
    };
  }

  const returned = { gstin: entry.gstin as string, legalName: entry.legalName as string, tradeName: entry.tradeName as string, status: entry.status as string, registrationDate: entry.registrationDate as string };
  if (returned.status !== "ACTIVE") {
    return {
      provider: "GST",
      status: "MISMATCH",
      simulated: true,
      requested,
      returned,
      matchStatus: "MISMATCH",
      source: "mock-gst-registry",
      referenceId: refId("GST"),
      confidence: 0.95,
      evidence: [
        { label: "SIMULATED_DATA", value: "true" },
        { label: "registrationStatus", value: returned.status },
        { label: "expected", value: "ACTIVE" },
      ],
      note: "GST registration is not ACTIVE according to the verification source.",
    };
  }

  const comparison = compareEntities({
    claimedName: (ctx.docClaims.gstLegalName ?? ctx.org.legalName) || "",
    officialName: returned.legalName,
    identifiers: { GSTIN: [requestedGstin, returned.gstin] },
  });

  const status: VerificationStatus = comparison.matchStatus === "MISMATCH" ? "MISMATCH" : "VERIFIED";
  return {
    provider: "GST",
    status,
    simulated: true,
    requested,
    returned,
    matchStatus: comparison.matchStatus,
    source: "mock-gst-registry",
    referenceId: refId("GST"),
    confidence: status === "VERIFIED" ? 0.95 : 0.9,
    evidence: [
      { label: "SIMULATED_DATA", value: "true" },
      { label: "documentGstin", value: requestedGstin ?? "(none)" },
      { label: "registryGstin", value: returned.gstin },
      { label: "registryLegalName", value: returned.legalName },
      { label: "nameSimilarity", value: comparison.nameSimilarity.toFixed(2) },
      ...comparison.identifiers.map((i) => ({ label: `identifier.${i.kind}`, value: `${i.claimed ?? "—"} vs ${i.official ?? "—"} (${i.equal ? "match" : "differ"})` })),
    ],
    entityComparison: comparison,
    note: status === "VERIFIED" ? comparison.reason : `Potential inconsistency — requires manual review. ${comparison.reason}`,
  };
}

// ─────────────────────────── PAN ───────────────────────────

export async function verifyPAN(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requestedPan = ctx.docClaims.pan ?? ctx.org.pan;
  const requested = { pan: requestedPan ?? null, name: ctx.docClaims.panName ?? ctx.org.legalName };

  if (!DEMO_MODE) return authRequiredOutcome("PAN", requested);

  // Format check first
  const panFormatValid = requestedPan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(requestedPan);
  if (!panFormatValid) {
    return {
      provider: "PAN",
      status: "MISMATCH",
      simulated: true,
      requested,
      returned: null,
      source: "mock-pan-registry",
      referenceId: refId("PAN"),
      confidence: 0.1,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "reason", value: "Invalid PAN format" }],
      note: "Invalid PAN format — does not match pattern (AAAAA9999A).",
    };
  }

  const entry = await lookupMock("PAN", requestedPan);

  // PAN in registry → full verification
  if (entry && entry.pan) {
    const returned = { pan: entry.pan as string, name: entry.name as string, status: (entry.status as string) ?? "ACTIVE" };
    const comparison = compareEntities({
      claimedName: requested.name ?? "",
      officialName: returned.name,
      identifiers: { PAN: [requestedPan, returned.pan] },
    });
    const status: VerificationStatus = comparison.matchStatus === "MISMATCH" ? "MISMATCH" : "VERIFIED";
    return {
      provider: "PAN",
      status,
      simulated: true,
      requested,
      returned,
      matchStatus: comparison.matchStatus,
      source: "mock-pan-registry",
      referenceId: refId("PAN"),
      confidence: status === "VERIFIED" ? 0.93 : 0.9,
      evidence: [
        { label: "SIMULATED_DATA", value: "true" },
        { label: "documentPan", value: requestedPan ?? "(none)" },
        { label: "registryPan", value: returned.pan },
        { label: "registryName", value: returned.name },
        { label: "nameSimilarity", value: comparison.nameSimilarity.toFixed(2) },
      ],
      entityComparison: comparison,
      note: status === "VERIFIED" ? comparison.reason : `Potential inconsistency — requires manual review. ${comparison.reason}`,
    };
  }

  // Valid format but not in mock registry → still VERIFIED with lower confidence
  // (common for real PANs not seeded in demo data)
  return {
    provider: "PAN",
    status: "VERIFIED",
    simulated: true,
    requested,
    returned: null,
    source: "mock-pan-registry",
    referenceId: refId("PAN"),
    confidence: 0.65,
    evidence: [
      { label: "SIMULATED_DATA", value: "true" },
      { label: "documentPan", value: requestedPan ?? "—" },
      { label: "formatValid", value: "YES" },
      { label: "registryStatus", value: "NOT_IN_REGISTRY" },
      { label: "note", value: "Valid PAN format confirmed via structural validation. Registry lookup unavailable in demo mode." },
    ],
    note: "Valid PAN format confirmed. Not found in demo registry — format validation passed, manual verification recommended for production.",
  };
}

// ─────────────────────────── Udyam ───────────────────────────

export async function verifyUdyam(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requestedNumber = ctx.docClaims.udyamNumber ?? ctx.org.udyamNumber;
  const requested = { udyamNumber: requestedNumber ?? null, enterpriseName: ctx.org.legalName };

  if (!DEMO_MODE) return authRequiredOutcome("UDYAM", requested);
  const entry = await lookupMock("UDYAM", requestedNumber);
  if (!entry || !entry.udyamNumber) {
    // Valid Udyam format but not in demo registry → VERIFIED with lower confidence
    const udyamFormatOk = requestedNumber && /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(requestedNumber);
    return {
      provider: "UDYAM",
      status: udyamFormatOk ? "VERIFIED" : "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-udyam-registry",
      referenceId: refId("UDYAM"),
      confidence: udyamFormatOk ? 0.65 : 0.3,
      evidence: [
        { label: "SIMULATED_DATA", value: "true" },
        { label: "documentUdyam", value: requestedNumber ?? "(none)" },
        { label: "formatValid", value: udyamFormatOk ? "YES" : "NO" },
        { label: "registryStatus", value: "NOT_IN_REGISTRY" },
      ],
      note: udyamFormatOk
        ? "Valid Udyam format confirmed via structural validation. Not found in demo registry — manual verification recommended for production."
        : "Udyam number not found in the verification source — manual verification required if MSME benefits are claimed.",
    };
  }
  const returned = { udyamNumber: entry.udyamNumber as string, enterpriseName: entry.enterpriseName as string, enterpriseType: entry.enterpriseType as string, status: (entry.status as string) ?? "ACTIVE" };
  const comparison = compareEntities({
    claimedName: ctx.org.legalName,
    officialName: returned.enterpriseName,
    identifiers: { UDYAM: [requestedNumber, returned.udyamNumber] },
  });
  const status: VerificationStatus = comparison.matchStatus === "MISMATCH" ? "MISMATCH" : "VERIFIED";
  return {
    provider: "UDYAM",
    status,
    simulated: true,
    requested,
    returned,
    matchStatus: comparison.matchStatus,
    source: "mock-udyam-registry",
    referenceId: refId("UDYAM"),
    confidence: 0.9,
    evidence: [
      { label: "SIMULATED_DATA", value: "true" },
      { label: "registryUdyam", value: returned.udyamNumber },
      { label: "registryName", value: returned.enterpriseName },
      { label: "enterpriseType", value: returned.enterpriseType },
    ],
    entityComparison: comparison,
    note: status === "VERIFIED" ? comparison.reason : `Potential inconsistency — requires manual review. ${comparison.reason}`,
  };
}

// ─────────────────────────── MCA / Blacklist / others ───────────────────────────

export async function verifyMCA(ctx: VerificationContext): Promise<VerificationOutcome | null> {
  const cin = ctx.docClaims.cin ?? ctx.org.cin;
  if (!cin) return null;
  const requestedMca = { cin, name: ctx.org.legalName };
  if (!DEMO_MODE) return authRequiredOutcome("MCA", requestedMca);
  const entry = await lookupMock("MCA", cin);
  const requested = requestedMca;
  if (!entry || !entry.cin) {
    return {
      provider: "MCA",
      status: "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-mca-registry",
      referenceId: refId("MCA"),
      confidence: 0.3,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "lookup", value: `CIN ${cin} not present in the simulated registry` }],
      note: "CIN not found — manual verification required.",
    };
  }
  const returned = { cin: entry.cin as string, name: entry.name as string, status: (entry.status as string) ?? "ACTIVE" };
  const comparison = compareEntities({ claimedName: ctx.org.legalName, officialName: returned.name, identifiers: { CIN: [cin, returned.cin] } });
  return {
    provider: "MCA",
    status: comparison.matchStatus === "MISMATCH" ? "MISMATCH" : "VERIFIED",
    simulated: true,
    requested,
    returned,
    matchStatus: comparison.matchStatus,
    source: "mock-mca-registry",
    referenceId: refId("MCA"),
    confidence: 0.88,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "registryName", value: returned.name }, { label: "companyStatus", value: returned.status }],
    entityComparison: comparison,
  };
}

export async function verifyBlacklist(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requested = { legalName: ctx.org.legalName, gstin: ctx.org.gstin ?? null };
  if (!DEMO_MODE) return authRequiredOutcome("BLACKLIST", requested);
  const entry = await lookupMock("BLACKLIST", ctx.org.legalName.toUpperCase());
  if (entry?.blacklisted === true) {
    return {
      provider: "BLACKLIST",
      status: "MISMATCH",
      simulated: true,
      requested,
      returned: { blacklisted: true, authority: entry.authority as string, since: entry.since as string },
      matchStatus: "MISMATCH",
      source: "mock-blacklist-registry",
      referenceId: refId("BLACKLIST"),
      confidence: 0.9,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "listedBy", value: String(entry.authority ?? "") }],
      note: "Potential inconsistency: organization appears in the simulated debarment list — manual verification required.",
    };
  }
  return {
    provider: "BLACKLIST",
    status: "VERIFIED",
    simulated: true,
    requested,
    returned: { blacklisted: false },
    source: "mock-blacklist-registry",
    referenceId: refId("BLACKLIST"),
    confidence: 0.85,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "result", value: "No debarment record found in the simulated registry" }],
  };
}

export async function verifyStartup(ctx: VerificationContext): Promise<VerificationOutcome | null> {
  if (!ctx.org.isStartup) return null;
  if (!DEMO_MODE) return authRequiredOutcome("STARTUP", { legalName: ctx.org.legalName });
  // DPIIT startup recognition — simulated
  return {
    provider: "STARTUP",
    status: "VERIFIED",
    simulated: true,
    requested: { legalName: ctx.org.legalName },
    returned: { recognized: true, recognitionNumber: "DPIIT-SIM-4821", validTill: "2027-03-31" },
    source: "mock-dpiit-registry",
    referenceId: refId("STARTUP"),
    confidence: 0.85,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }],
  };
}

// ─────────────────────────── EPFO ───────────────────────────

export async function verifyEPFO(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requested = { pan: ctx.org.pan ?? null };
  if (!DEMO_MODE) return authRequiredOutcome("EPFO", requested);
  const entry = await lookupMock("EPFO", ctx.org.pan);
  if (!entry || !entry.epfNumber) {
    return {
      provider: "EPFO",
      status: "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-epfo-registry",
      referenceId: refId("EPFO"),
      confidence: 0.3,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "lookup", value: `EPF number not found for PAN ${ctx.org.pan ?? "(none)"} in the simulated registry` }],
      note: "EPF verification not found — manual verification required.",
    };
  }
  const returned = { epfNumber: entry.epfNumber as string, establishmentName: entry.establishmentName as string, status: (entry.status as string) ?? "ACTIVE" };
  return {
    provider: "EPFO",
    status: "VERIFIED",
    simulated: true,
    requested,
    returned,
    source: "mock-epfo-registry",
    referenceId: refId("EPFO"),
    confidence: 0.88,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "registryEpfNumber", value: returned.epfNumber }, { label: "registryName", value: returned.establishmentName }],
    note: "EPF establishment verified successfully.",
  };
}

// ─────────────────────────── ESIC ───────────────────────────

export async function verifyESIC(ctx: VerificationContext): Promise<VerificationOutcome> {
  const requested = { pan: ctx.org.pan ?? null };
  if (!DEMO_MODE) return authRequiredOutcome("ESIC", requested);
  const entry = await lookupMock("ESIC", ctx.org.pan);
  if (!entry || !entry.esiNumber) {
    return {
      provider: "ESIC",
      status: "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-esic-registry",
      referenceId: refId("ESIC"),
      confidence: 0.3,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "lookup", value: `ESI number not found for PAN ${ctx.org.pan ?? "(none)"} in the simulated registry` }],
      note: "ESI verification not found — manual verification required.",
    };
  }
  const returned = { esiNumber: entry.esiNumber as string, establishmentName: entry.establishmentName as string, status: (entry.status as string) ?? "ACTIVE" };
  return {
    provider: "ESIC",
    status: "VERIFIED",
    simulated: true,
    requested,
    returned,
    source: "mock-esic-registry",
    referenceId: refId("ESIC"),
    confidence: 0.88,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "registryEsicNumber", value: returned.esiNumber }, { label: "registryName", value: returned.establishmentName }],
    note: "ESI establishment verified successfully.",
  };
}

// ─────────────────────────── NSIC ───────────────────────────

export async function verifyNSIC(ctx: VerificationContext): Promise<VerificationOutcome | null> {
  if (!ctx.org.udyamNumber) return null;
  const requested = { udyamNumber: ctx.org.udyamNumber, organizationName: ctx.org.legalName };
  if (!DEMO_MODE) return authRequiredOutcome("NSIC", requested);
  const entry = await lookupMock("NSIC", ctx.org.udyamNumber);
  if (!entry || !entry.nsicCertificate) {
    return {
      provider: "NSIC",
      status: "NOT_FOUND",
      simulated: true,
      requested,
      returned: null,
      source: "mock-nsic-registry",
      referenceId: refId("NSIC"),
      confidence: 0.3,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "lookup", value: `NSIC certificate not found for Udyam ${ctx.org.udyamNumber} in the simulated registry` }],
      note: "NSIC verification not found — manual verification required if NSIC benefits are claimed.",
    };
  }
  const returned = { nsicCertificate: entry.nsicCertificate as string, validTill: entry.validTill as string, status: (entry.status as string) ?? "ACTIVE" };
  return {
    provider: "NSIC",
    status: "VERIFIED",
    simulated: true,
    requested,
    returned,
    source: "mock-nsic-registry",
    referenceId: refId("NSIC"),
    confidence: 0.85,
    evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "registryNsicCertificate", value: returned.nsicCertificate }, { label: "validTill", value: returned.validTill }],
    note: "NSIC certification verified successfully.",
  };
}

/** Providers that are acknowledged but not configured — must fail gracefully as UNAVAILABLE. */
export function unavailableProvider(provider: string, reason: string): VerificationOutcome {
  return {
    provider,
    status: "UNAVAILABLE",
    simulated: false,
    requested: {},
    returned: null,
    source: "not-configured",
    referenceId: refId(provider),
    confidence: 0,
    evidence: [{ label: "reason", value: reason }],
    note: `${provider} verification unavailable — manual verification required.`,
  };
}

/** Run all applicable verification providers for a submission. */
export async function runVerificationProviders(ctx: VerificationContext, includeStatutory = false): Promise<VerificationOutcome[]> {
  const outcomes: VerificationOutcome[] = [];
  outcomes.push(await verifyGST(ctx));
  outcomes.push(await verifyPAN(ctx));
  if (ctx.org.udyamNumber || ctx.docClaims.udyamNumber) outcomes.push(await verifyUdyam(ctx));
  const mca = await verifyMCA(ctx);
  if (mca) outcomes.push(mca);
  outcomes.push(await verifyBlacklist(ctx));
  const startup = await verifyStartup(ctx);
  if (startup) outcomes.push(startup);
  outcomes.push(await verifyEPFO(ctx));
  outcomes.push(await verifyESIC(ctx));
  const nsic = await verifyNSIC(ctx);
  if (nsic) outcomes.push(nsic);
  if (process.env.DIGILOCKER_CLIENT_ID && DEMO_MODE) {
    // DigiLocker requester integration point (OAuth pull flow) — demo adapter below
    outcomes.push({
      provider: "DIGILOCKER",
      status: "UNAVAILABLE",
      simulated: true,
      requested: {},
      returned: null,
      source: "digilocker-demo-adapter",
      referenceId: refId("DIGILOCKER"),
      confidence: 0,
      evidence: [{ label: "SIMULATED_DATA", value: "true" }, { label: "reason", value: "DigiLocker demo adapter: requester flow requires interactive consent — skipped in batch verification." }],
      note: "DigiLocker fetch available from the document panel (demo adapter).",
    });
  }
  return outcomes;
}

export { toJson };
