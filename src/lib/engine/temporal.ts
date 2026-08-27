/**
 * Temporal compliance engine.
 *
 * Answers a different question from expiry checks:
 *   NOT  "Is this document valid today?"
 *   BUT  "Was this document valid at the moment that legally matters?"
 *
 * Relevant dates, in precedence order:
 *   bidSubmittedAt (when provided) → tenderClosingDate → now
 */

export interface TemporalDates {
  issueDate?: Date | null;
  expiryDate?: Date | null;
  bidSubmittedAt?: Date | null;
  tenderClosingDate?: Date | null;
}

export type TemporalVerdict =
  | "VALID_AT_SUBMISSION"
  | "EXPIRED_AT_SUBMISSION"
  | "NOT_YET_VALID_AT_SUBMISSION"
  | "EXPIRED_NOW_STILL_RELEVANT"
  | "VALIDITY_UNKNOWN"
  | "NO_DATES_ON_DOCUMENT";

export interface TemporalResult {
  verdict: TemporalVerdict;
  /** The legally relevant evaluation instant used. */
  evaluatedAt: Date;
  explanation: string;
  requiresOfficerReview: boolean;
}

function d(v?: Date | null): Date | null {
  return v && !Number.isNaN(v.getTime()) ? v : null;
}

export function evaluateTemporal(dates: TemporalDates): TemporalResult {
  const submitted = d(dates.bidSubmittedAt);
  const closing = d(dates.tenderClosingDate);
  // Precedence: actual submission, else tender close, else now.
  const relevant = submitted ?? closing ?? new Date();
  const issue = d(dates.issueDate);
  const expiry = d(dates.expiryDate);

  if (!issue && !expiry) {
    return {
      verdict: "NO_DATES_ON_DOCUMENT",
      evaluatedAt: relevant,
      explanation: "Document states no validity dates; temporal standing cannot be computed. Officer may confirm lifetime/evergreen validity.",
      requiresOfficerReview: false,
    };
  }
  if (!expiry) {
    if (issue && issue > relevant) {
      return {
        verdict: "NOT_YET_VALID_AT_SUBMISSION",
        evaluatedAt: relevant,
        explanation: `Issued ${issue.toISOString().slice(0, 10)} — AFTER the relevant date ${relevant.toISOString().slice(0, 10)}. Document post-dates the submission window.`,
        requiresOfficerReview: true,
      };
    }
    return {
      verdict: "VALIDITY_UNKNOWN",
      evaluatedAt: relevant,
      explanation: "Issue date present but no expiry recorded; cannot confirm validity at the relevant date.",
      requiresOfficerReview: false,
    };
  }

  // Issued AFTER the legally relevant instant → document did not exist yet.
  if (issue && issue > relevant) {
    return {
      verdict: "NOT_YET_VALID_AT_SUBMISSION",
      evaluatedAt: relevant,
      explanation: `Issued ${issue.toISOString().slice(0, 10)} — AFTER the relevant date ${relevant.toISOString().slice(0, 10)}. Document post-dates the submission window.`,
      requiresOfficerReview: true,
    };
  }

  if (expiry >= relevant) {
    return {
      verdict: "VALID_AT_SUBMISSION",
      evaluatedAt: relevant,
      explanation: `Valid until ${expiry.toISOString().slice(0, 10)} — covers the relevant date ${relevant.toISOString().slice(0, 10)}${submitted ? " (actual bid submission)" : ""}.`,
      requiresOfficerReview: false,
    };
  }

  // Expired relative to the relevant date…
  if (submitted || closing) {
    return {
      verdict: "EXPIRED_AT_SUBMISSION",
      evaluatedAt: relevant,
      explanation: `Expired ${expiry.toISOString().slice(0, 10)}, BEFORE the relevant date ${relevant.toISOString().slice(0, 10)}${submitted ? " (actual bid submission)" : " (tender closing)"}. Treated as non-compliant where the tender requires current validity.`,
      requiresOfficerReview: true,
    };
  }

  // No tender context at all — classic "expired now".
  return {
    verdict: "EXPIRED_NOW_STILL_RELEVANT",
    evaluatedAt: relevant,
    explanation: `Validity ended ${expiry.toISOString().slice(0, 10)} (before today).`,
    requiresOfficerReview: false,
  };
}
