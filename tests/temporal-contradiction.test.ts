import { describe, it, expect } from "vitest";
import { evaluateTemporal } from "@/lib/engine/temporal";
import { detectContradictions } from "@/lib/engine/contradictions";
import type { RuleFacts } from "@/lib/engine/rules";
import { computeBlockers } from "@/lib/engine/blockers";

const DAY = 86400_000;
function doc(docType: string, fields: Record<string, string>): RuleFacts["docs"][number] {
  return {
    id: docType + Math.random().toString(36).slice(2),
    docType, fileName: docType + ".pdf", sha256: "h" + docType,
    status: "PROCESSED", fields, createdAt: new Date(),
  };
}

describe("Temporal compliance engine", () => {
  const submitted = new Date(Date.now() - 30 * DAY);

  it("EXPIRED_AT_SUBMISSION when validity ended before bid submission", () => {
    const r = evaluateTemporal({
      issueDate: new Date(Date.now() - 500 * DAY),
      expiryDate: new Date(submitted.getTime() - DAY), // expired before submission
      bidSubmittedAt: submitted,
    });
    expect(r.verdict).toBe("EXPIRED_AT_SUBMISSION");
    expect(r.requiresOfficerReview).toBe(true);
    expect(r.explanation).toMatch(/BEFORE the relevant date/);
  });

  it("VALID_AT_SUBMISSION even if expired today (grandfathered at submission)", () => {
    const r = evaluateTemporal({
      expiryDate: new Date(submitted.getTime() + DAY), // valid at submission, expired now
      bidSubmittedAt: submitted,
    });
    expect(r.verdict).toBe("VALID_AT_SUBMISSION");
  });

  it("NOT_YET_VALID_AT_SUBMISSION for documents issued after submission", () => {
    const r = evaluateTemporal({
      issueDate: new Date(), // issued today — after submission
      expiryDate: new Date(Date.now() + 365 * DAY),
      bidSubmittedAt: submitted,
    });
    expect(r.verdict).toBe("NOT_YET_VALID_AT_SUBMISSION");
  });

  it("falls back to tender closing date when submission time unknown", () => {
    const closing = new Date(Date.now() - 10 * DAY);
    const r = evaluateTemporal({
      expiryDate: new Date(closing.getTime() - DAY),
      tenderClosingDate: closing,
    });
    expect(r.verdict).toBe("EXPIRED_AT_SUBMISSION");
    expect(r.explanation).toMatch(/tender closing/);
  });

  it("NO_DATES_ON_DOCUMENT is a first-class unknown state", () => {
    expect(evaluateTemporal({}).verdict).toBe("NO_DATES_ON_DOCUMENT");
  });
});

describe("Contradiction engine", () => {
  it("flags HIGH identity-name contradiction between GST and PAN", () => {
    const facts = {
      org: { id: "o", legalName: "Totally Different Corp", isMsme: false, isStartup: false },
      docs: [
        doc("GST_CERTIFICATE", { legalName: "Alpha Manufacturing Industries Ltd" }),
        doc("PAN_CARD", { name: "Beta Traders Partnership" }),
      ],
      verifications: {},
      submitted: true,
    } as unknown as RuleFacts;
    const c = detectContradictions(facts);
    expect(c.some((x) => x.kind === "IDENTITY_NAME_CONTRADICTION" && x.severity === "HIGH")).toBe(true);
  });

  it("raises TURNOVER_OUTLIER for wildly inconsistent financials", () => {
    const facts = {
      org: { id: "o", legalName: "X Ltd", isMsme: false, isStartup: false },
      docs: [doc("TURNOVER_PROOF", { fy1TurnoverLakh: "12", fy2TurnoverLakh: "400" })],
      verifications: {},
      submitted: true,
    } as unknown as RuleFacts;
    const c = detectContradictions(facts);
    expect(c.some((x) => x.kind === "TURNOVER_OUTLIER")).toBe(true);
  });

  it("stays silent when evidence agrees (no false contradictions)", () => {
    const facts = {
      org: { id: "o", legalName: "Same Name Pvt Ltd", isMsme: false, isStartup: false },
      docs: [
        doc("GST_CERTIFICATE", { legalName: "Same Name Pvt. Ltd.", address: "Plot 5, MIDC Andheri Mumbai 400093" }),
        doc("PAN_CARD", { name: "Same Name Pvt Ltd" }),
      ],
      verifications: {},
      submitted: true,
    } as unknown as RuleFacts;
    const c = detectContradictions(facts);
    expect(c.find((x) => x.kind === "IDENTITY_NAME_CONTRADICTION")).toBeUndefined();
  });
});

describe("Blockers engine (what-would-change-the-result)", () => {
  it("orders blockers by severity and explains resolution", () => {
    const b = computeBlockers(
      [
        { code: "R9", result: "INSUFFICIENT_EVIDENCE", details: { recommendation: "Request OEM letter." } },
        { code: "R2", result: "REVIEW", details: { recommendation: "Officer to confirm GST status." } },
        { code: "R1", result: "PASS", details: {} as never },
      ],
      new Map([["R2", "GST Registration"], ["R9", "OEM Authorization"]]),
    );
    expect(b[0].code).toBe("R2");           // REVIEW outranks INSUFFICIENT
    expect(b[0].title).toBe("GST Registration");
    expect(b.every((x) => x.resolutionPath.length > 0)).toBe(true);
    expect(b.find((x) => x.code === "R1")).toBeUndefined(); // passing reqs never block
  });
});
