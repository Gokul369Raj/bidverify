import { describe, it, expect } from "vitest";
import { buildConsistencyFindings } from "@/lib/engine/consistency";
import { evaluateRequirement, defaultRuleConfig, type RuleFacts } from "@/lib/engine/rules";
import { compareEntities } from "@/lib/engine/entity";

function doc(docType: string, fields: Record<string, string>, fileName = `${docType}.pdf`): RuleFacts["docs"][number] {
  return {
    id: docType,
    docType,
    fileName,
    sha256: "hash-" + docType,
    status: "PROCESSED",
    fields,
    createdAt: new Date(),
  };
}

describe("Cross-document consistency", () => {
  it("flags PAN-in-GSTIN linkage conflict as HIGH", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "ABC Technologies Pvt Ltd", isMsme: false, isStartup: false },
      docs: [
        doc("PAN_CARD", { pan: "AAPFU0939F" }),
        doc("GST_CERTIFICATE", { gstin: "27AABCU9603R1ZM" }), // embedded PAN AABCU9603R ≠ AAPFU0939F
      ],
      verifications: {},
      submitted: true,
    };
    const findings = buildConsistencyFindings(facts);
    expect(findings.some((f) => f.kind === "PAN_GSTIN_LINKAGE_CONFLICT" && f.severity === "HIGH")).toBe(true);
  });

  it("does not flag when PAN matches GSTIN segment", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "ABC Technologies Pvt Ltd", isMsme: false, isStartup: false },
      docs: [
        doc("PAN_CARD", { pan: "AAPFU0939F" }),
        doc("GST_CERTIFICATE", { gstin: "27AAPFU0939F1ZV" }),
      ],
      verifications: {},
      submitted: true,
    };
    const findings = buildConsistencyFindings(facts);
    expect(findings.find((f) => f.kind === "PAN_GSTIN_LINKAGE_CONFLICT")).toBeUndefined();
  });

  it("raises HIGH name mismatch between materially different document names", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "XYZ Enterprises LLP", isMsme: false, isStartup: false },
      docs: [doc("GST_CERTIFICATE", { legalName: "Completely Different Industries Ltd", gstin: "27AAPFU0939F1ZV" })],
      verifications: {},
      submitted: true,
    };
    const findings = buildConsistencyFindings(facts);
    expect(findings.some((f) => f.kind === "CROSS_DOCUMENT_NAME_MISMATCH" && f.severity === "HIGH")).toBe(true);
  });
});

describe("Entity resolution", () => {
  it("matches formatting variants of the same company", () => {
    const r = compareEntities({
      claimedName: "ABC Technologies Pvt. Ltd.",
      officialName: "ABC TECHNOLOGIES PRIVATE LIMITED",
      identifiers: {},
    });
    expect(["EXACT", "SEMANTIC"]).toContain(r.matchStatus);
  });

  it("never silently merges different companies", () => {
    const r = compareEntities({
      claimedName: "ABC Technologies Pvt Ltd",
      officialName: "XYZ Enterprises",
      identifiers: {},
    });
    expect(r.matchStatus).toBe("MISMATCH");
  });

  it("identifier conflict overrides name similarity", () => {
    const r = compareEntities({
      claimedName: "ABC Technologies Pvt Ltd",
      officialName: "ABC Technologies Pvt Ltd",
      identifiers: { GSTIN: ["27AAAAA0000A1Z5", "29AAAAA0000A1Z5"] },
    });
    expect(r.matchStatus).toBe("MISMATCH");
  });
});

describe("Rules engine (deterministic)", () => {
  const cfg = defaultRuleConfig("LOCAL_CONTENT");

  it("passes when declared local content meets threshold", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "T", isMsme: false, isStartup: false },
      docs: [doc("LOCAL_CONTENT_DECLARATION", { localContentPct: "62" })],
      verifications: {},
      submitted: true,
    };
    const r = evaluateRequirement(
      { id: "r1", code: "R1", type: "LOCAL_CONTENT", title: "Local content", mandatory: true, evidenceRequired: true, params: { localContentPct: 50 }, sourceText: null },
      facts,
      cfg,
    );
    expect(r.result).toBe("PASS");
  });

  it("fails mandatory requirement below threshold", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "T", isMsme: false, isStartup: false },
      docs: [doc("LOCAL_CONTENT_DECLARATION", { localContentPct: "20" })],
      verifications: {},
      submitted: true,
    };
    const r = evaluateRequirement(
      { id: "r2", code: "R2", type: "LOCAL_CONTENT", title: "Local content", mandatory: true, evidenceRequired: true, params: { localContentPct: 50 }, sourceText: null },
      facts,
      cfg,
    );
    expect(r.result).toBe("FAIL");
  });

  it("reports INSUFFICIENT_EVIDENCE without a declaration instead of failing silently", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "T", isMsme: false, isStartup: false },
      docs: [],
      verifications: {},
      submitted: true,
    };
    const r = evaluateRequirement(
      { id: "r3", code: "R3", type: "LOCAL_CONTENT", title: "Local content", mandatory: true, evidenceRequired: true, params: { localContentPct: 50 }, sourceText: null },
      facts,
      cfg,
    );
    expect(r.result).toBe(cfg.missingResult);
  });

  it("treats expired OEM authorization honestly", () => {
    const facts: RuleFacts = {
      org: { id: "o1", legalName: "T", isMsme: false, isStartup: false },
      docs: [doc("OEM_AUTHORIZATION", { validTill: "2020-01-01", authorizationDate: "2019-06-01", oemName: "OEM Ltd", bidderName: "T" })],
      verifications: {},
      submitted: true,
    };
    const r = evaluateRequirement(
      { id: "r4", code: "R4", type: "OEM_AUTHORIZATION", title: "OEM auth", mandatory: true, evidenceRequired: true, params: {}, sourceText: null },
      facts,
      defaultRuleConfig("OEM_AUTHORIZATION"),
    );
    expect(r.result).toBe("FAIL");
  });
});
