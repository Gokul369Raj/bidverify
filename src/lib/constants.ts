/** Shared domain constants used by backend engines and UI. */

export const REQUIREMENT_TYPES = [
  "GST_REGISTRATION",
  "PAN",
  "UDYAM",
  "OEM_AUTHORIZATION",
  "TURNOVER",
  "EXPERIENCE",
  "LOCAL_CONTENT",
  "CERTIFICATE",
  "DECLARATION",
  "TECHNICAL_SPEC",
  "STATUTORY",
  "EMD",
  "FINANCIAL",
  "ORGANIZATION",
  "OTHER",
  "BIS_CERTIFICATION",
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  GST_REGISTRATION: "GST Registration",
  PAN: "PAN Registration",
  UDYAM: "Udyam / MSME Registration",
  OEM_AUTHORIZATION: "OEM Authorization",
  TURNOVER: "Annual Turnover",
  EXPERIENCE: "Past Experience",
  LOCAL_CONTENT: "Local Content",
  CERTIFICATE: "Certification",
  DECLARATION: "Declaration",
  TECHNICAL_SPEC: "Technical Specification",
  STATUTORY: "Statutory Compliance",
  EMD: "EMD / Bid Security",
  FINANCIAL: "Financial Requirement",
  ORGANIZATION: "Organization Requirement",
  OTHER: "Other Condition",
  BIS_CERTIFICATION: "BIS Certification",
};

export const DOCUMENT_TYPES = [
  "GST_CERTIFICATE",
  "PAN_CARD",
  "UDYAM_CERTIFICATE",
  "OEM_AUTHORIZATION",
  "EXPERIENCE_CERTIFICATE",
  "TURNOVER_PROOF",
  "LOCAL_CONTENT_DECLARATION",
  "TECHNICAL_DATASHEET",
  "COMPANY_CERTIFICATE",
  "OTHER",
  "UNKNOWN",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  GST_CERTIFICATE: "GST Certificate",
  PAN_CARD: "PAN Card / PAN Certificate",
  UDYAM_CERTIFICATE: "Udyam Certificate",
  OEM_AUTHORIZATION: "OEM Authorization Letter",
  EXPERIENCE_CERTIFICATE: "Experience Certificate",
  TURNOVER_PROOF: "Turnover Proof (CA/Audit)",
  LOCAL_CONTENT_DECLARATION: "Local Content Declaration",
  TECHNICAL_DATASHEET: "Technical Datasheet",
  COMPANY_CERTIFICATE: "Company Certificate",
  OTHER: "Other",
  UNKNOWN: "Unknown — Manual Classification Required",
};

/** Which requirement types each document type can serve as evidence for. */
export const DOC_TYPE_TO_REQUIREMENT_TYPES: Record<string, string[]> = {
  GST_CERTIFICATE: ["GST_REGISTRATION"],
  PAN_CARD: ["PAN"],
  UDYAM_CERTIFICATE: ["UDYAM"],
  OEM_AUTHORIZATION: ["OEM_AUTHORIZATION"],
  EXPERIENCE_CERTIFICATE: ["EXPERIENCE"],
  TURNOVER_PROOF: ["TURNOVER", "FINANCIAL"],
  LOCAL_CONTENT_DECLARATION: ["LOCAL_CONTENT"],
  TECHNICAL_DATASHEET: ["TECHNICAL_SPEC"],
  COMPANY_CERTIFICATE: ["CERTIFICATE", "ORGANIZATION", "STATUTORY", "DECLARATION", "BIS_CERTIFICATION"],
  OTHER: ["OTHER"],
  UNKNOWN: [],
};

export const VERIFICATION_PROVIDERS = [
  "GST",
  "PAN",
  "UDYAM",
  "DIGILOCKER",
  "MCA",
  "EPFO",
  "ESIC",
  "STARTUP",
  "NSIC",
  "BLACKLIST",
] as const;

export const COMPLIANCE_RESULTS = [
  "PASS",
  "FAIL",
  "REVIEW",
  "NOT_APPLICABLE",
  "INSUFFICIENT_EVIDENCE",
  "VERIFICATION_UNAVAILABLE",
] as const;

export const FIELD_STATES = [
  "SELF_DECLARED",
  "AI_EXTRACTED",
  "API_VERIFIED",
  "MANUALLY_VERIFIED",
  "MISMATCH",
  "REVIEW_REQUIRED",
] as const;

// ── identifier formats ──
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Jammu & Kashmir", "Chandigarh", "Puducherry",
];
