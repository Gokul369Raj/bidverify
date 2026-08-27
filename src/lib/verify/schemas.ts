/**
 * DOCUMENT SCHEMA REGISTRY — STRICT IDENTITY EVIDENCE PROFILES
 *
 * Every document type defines:
 *   identityEvidence  — core signals that MUST be present to establish document identity
 *   supportingSignals — optional signals that increase confidence but don't determine identity
 *   identityThreshold — minimum identity score (0-100) to pass the evidence gate
 *
 * SCORE RULES:
 *   - Before identity gate: score = null (not calculated)
 *   - If identity gate fails: score = 0, REJECTED
 *   - Only after identity gate passes: detailed verification score is calculated
 */

export interface IdentityEvidence {
  /** Core concept keywords — combination must match, not just one */
  coreConcepts: string[];
  /** Identifier pattern (regex) — if present, strong identity signal */
  identifierPattern?: RegExp;
  /** Expected issuer/authority keywords */
  issuerSignals: string[];
  /** Expected field labels that should appear */
  expectedFieldLabels: string[];
  /** Number of distinct core concept groups that must match */
  minConceptMatches: number;
  /** Minimum combined evidence score to pass gate (0-100) */
  identityThreshold: number;
}

export interface SupportingSignal {
  name: string;
  type: "qr" | "barcode" | "signature" | "photo" | "metadata" | "layout" | "stamp";
  description: string;
  /** Is this signal expected for this document type? */
  expected: boolean;
  /** Score bonus if present (0-10) */
  bonusIfPresent: number;
  /** Score penalty if absent and expected (0-10) — ONLY for expected signals */
  penaltyIfAbsent: number;
}

export interface VerificationWeight {
  classification: number;
  structure: number;
  extraction: number;
  identifiers: number;
  qrBarcode: number;
  signature: number;
  forensics: number;
  consistency: number;
}

export interface DocSchemaField {
  name: string;
  label: string;
  pattern?: RegExp;
  required: boolean;
  description: string;
}

export interface DocSchemaRule {
  name: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  check: (text: string, fields: Record<string, string>, meta: Record<string, any>) => { passed: boolean; detail: string; score?: number };
}

export interface DocumentTypeSchema {
  docType: string;
  label: string;
  issuer: string;
  /** Core evidence profile — THE HARD GATE */
  identityEvidence: IdentityEvidence;
  /** Optional supporting signals */
  supportingSignals: SupportingSignal[];
  /** Forbidden keywords that indicate wrong document type */
  forbiddenKeywords: string[];
  /** Extractable fields */
  extractableFields: DocSchemaField[];
  /** Required fields for verification (post-identity) */
  requiredFields: string[];
  /** Schema-specific validation rules (post-identity) */
  validationRules: DocSchemaRule[];
  /** Verification scoring weights (post-identity) */
  weights: VerificationWeight;
}

// ═══════════════════════════════════════════════════════════════
// PAN CARD SCHEMA
// ═══════════════════════════════════════════════════════════════

const PAN_SCHEMA: DocumentTypeSchema = {
  docType: "PAN_CARD",
  label: "PAN Card",
  issuer: "Income Tax Department / NSDL / UTIITSL",
  identityEvidence: {
    coreConcepts: ["permanent account number", "income tax department", "income tax", "pan card"],
    identifierPattern: /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/,
    issuerSignals: ["income tax department", "income tax", "government of india"],
    expectedFieldLabels: ["permanent account number", "pan", "name", "date of birth"],
    minConceptMatches: 1,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "photo", type: "photo", description: "Photograph of PAN holder", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
    { name: "signature", type: "signature", description: "Signature of PAN holder", expected: false, bonusIfPresent: 3, penaltyIfAbsent: 0 },
    { name: "qr", type: "qr", description: "QR code on newer PAN cards", expected: false, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "gstin", "registration certificate", "udyam", "msme"],
  extractableFields: [
    { name: "pan", label: "PAN Number", pattern: /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/, required: true, description: "Permanent Account Number" },
    { name: "holder_name", label: "Holder Name", required: true, description: "Name of PAN holder" },
    { name: "father_name", label: "Father's Name", required: false, description: "Father's or Mother's name" },
    { name: "dob", label: "Date of Birth", pattern: /\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}/, required: false, description: "Date of birth" },
  ],
  requiredFields: ["pan"],
  validationRules: [
    {
      name: "pan_format",
      description: "PAN must match AAAAANNNNA format",
      severity: "CRITICAL",
      check: (text) => {
        const match = text.match(/\b([A-Za-z]{5}[0-9]{4}[A-Za-z])\b/);
        if (!match) return { passed: false, detail: "No valid PAN format found" };
        return { passed: true, detail: `Valid PAN: ${match[1].toUpperCase()}`, score: 5 };
      },
    },
  ],
  weights: { classification: 30, structure: 10, extraction: 10, identifiers: 20, qrBarcode: 5, signature: 5, forensics: 10, consistency: 10 },
};

// ═══════════════════════════════════════════════════════════════
// GST REG-06 SCHEMA
// ═══════════════════════════════════════════════════════════════

const GST_SCHEMA: DocumentTypeSchema = {
  docType: "GST_CERTIFICATE",
  label: "GST Registration Certificate (REG-06)",
  issuer: "Goods and Services Tax Network / GST Portal",
  identityEvidence: {
    coreConcepts: ["goods and services tax", "registration certificate", "form gst reg-06", "gst registration"],
    identifierPattern: /\b[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z]Z[0-9A-Za-z]\b/,
    issuerSignals: ["goods and services tax", "gstn", "gst portal"],
    expectedFieldLabels: ["gstin", "legal name", "trade name", "registration", "certificate"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "qr", type: "qr", description: "QR code on GST certificate", expected: false, bonusIfPresent: 5, penaltyIfAbsent: 0 },
    { name: "signature", type: "signature", description: "Digital signature", expected: false, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["permanent account number", "income tax department", "udyam", "msme"],
  extractableFields: [
    { name: "gstin", label: "GSTIN", pattern: /\b[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z]Z[0-9A-Za-z]\b/, required: true, description: "GST Identification Number" },
    { name: "legal_name", label: "Legal Name", required: true, description: "Legal name of the taxpayer" },
    { name: "trade_name", label: "Trade Name", required: false, description: "Trade or business name" },
    { name: "registration_date", label: "Registration Date", required: false, description: "Date of registration" },
  ],
  requiredFields: ["gstin"],
  validationRules: [
    {
      name: "gstin_format",
      description: "GSTIN must match 2-digit state code + PAN + Z + alphanumeric",
      severity: "CRITICAL",
      check: (text) => {
        const match = text.match(/\b([0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][0-9A-Za-z]Z[0-9A-Za-z])\b/i);
        if (!match) return { passed: false, detail: "No valid GSTIN format found" };
        return { passed: true, detail: `Valid GSTIN: ${match[1].toUpperCase()}`, score: 5 };
      },
    },
  ],
  weights: { classification: 30, structure: 10, extraction: 10, identifiers: 25, qrBarcode: 5, signature: 5, forensics: 10, consistency: 5 },
};

// ═══════════════════════════════════════════════════════════════
// UDYAM SCHEMA
// ═══════════════════════════════════════════════════════════════

const UDYAM_SCHEMA: DocumentTypeSchema = {
  docType: "UDYAM_CERTIFICATE",
  label: "Udyam / MSME Certificate",
  issuer: "Ministry of Micro, Small and Medium Enterprises / Udyam Registration Portal",
  identityEvidence: {
    coreConcepts: ["udyam registration certificate", "udyam registration", "ministry of micro", "small and medium enterprise"],
    identifierPattern: /\b(UDYAM[- ]?[A-Z]{2}[- ]?\d{7,12})\b/i,
    issuerSignals: ["ministry of micro", "small and medium", "enterprise", "udyam"],
    expectedFieldLabels: ["udyam registration number", "enterprise name", "type of enterprise"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "qr", type: "qr", description: "Dynamic QR on Udyam certificate", expected: true, bonusIfPresent: 10, penaltyIfAbsent: 2 },
    { name: "signature", type: "signature", description: "Digital signature", expected: false, bonusIfPresent: 3, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "gstin", "income tax department", "permanent account number"],
  extractableFields: [
    { name: "udyam_number", label: "Udyam Registration Number", pattern: /\b(UDYAM[- ]?[A-Z]{2}[- ]?\d{7,12})\b/i, required: true, description: "Udyam registration number" },
    { name: "enterprise_name", label: "Enterprise Name", required: true, description: "Name of the enterprise" },
    { name: "enterprise_type", label: "Type of Enterprise", required: false, description: "Micro/Small/Medium" },
  ],
  requiredFields: ["udyam_number"],
  validationRules: [
    {
      name: "udyam_format",
      description: "Udyam number must match expected format",
      severity: "CRITICAL",
      check: (text) => {
        const match = text.match(/\b(UDYAM[- ]?[A-Z]{2}[- ]?\d{7,12})\b/i);
        if (!match) return { passed: false, detail: "No valid Udyam number found" };
        return { passed: true, detail: `Valid Udyam: ${match[1].toUpperCase()}`, score: 5 };
      },
    },
  ],
  weights: { classification: 30, structure: 10, extraction: 10, identifiers: 20, qrBarcode: 15, signature: 5, forensics: 5, consistency: 5 },
};

// ═══════════════════════════════════════════════════════════════
// MCA CERTIFICATE OF INCORPORATION
// ═══════════════════════════════════════════════════════════════

const MCA_SCHEMA: DocumentTypeSchema = {
  docType: "COMPANY_CERTIFICATE",
  label: "Certificate of Incorporation",
  issuer: "Ministry of Corporate Affairs (MCA) / Registrar of Companies",
  identityEvidence: {
    coreConcepts: ["certificate of incorporation", "ministry of corporate affairs", "registrar of companies", "incorporation"],
    identifierPattern: /\b[UFLPTABCORGS]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/,
    issuerSignals: ["ministry of corporate affairs", "registrar of companies", "mca"],
    expectedFieldLabels: ["certificate of incorporation", "company name", "cin", "date of incorporation"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Digital signature", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam", "income tax department"],
  extractableFields: [
    { name: "cin", label: "CIN", pattern: /\b[UFLPTABCORGS]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/, required: true, description: "Company Identification Number" },
    { name: "company_name", label: "Company Name", required: true, description: "Name of the company" },
    { name: "incorporation_date", label: "Incorporation Date", required: false, description: "Date of incorporation" },
  ],
  requiredFields: ["cin"],
  validationRules: [
    {
      name: "cin_format",
      description: "CIN must match MCA format",
      severity: "CRITICAL",
      check: (text) => {
        const match = text.match(/\b([UFLPTABCORGS]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/);
        if (!match) return { passed: false, detail: "No valid CIN found" };
        return { passed: true, detail: `Valid CIN: ${match[1]}`, score: 5 };
      },
    },
  ],
  weights: { classification: 30, structure: 10, extraction: 10, identifiers: 25, qrBarcode: 0, signature: 10, forensics: 10, consistency: 5 },
};

// ═══════════════════════════════════════════════════════════════
// EXPERIENCE CERTIFICATE
// ═══════════════════════════════════════════════════════════════

const EXPERIENCE_SCHEMA: DocumentTypeSchema = {
  docType: "EXPERIENCE_CERTIFICATE",
  label: "Experience Certificate",
  issuer: "Client / Employer / Government Agency",
  identityEvidence: {
    coreConcepts: ["experience certificate", "completion certificate", "performance certificate", "work certificate"],
    issuerSignals: [],
    expectedFieldLabels: ["project", "client", "contract", "completion", "supply", "installation"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Signatory signature", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "gstin", "udyam", "income tax"],
  extractableFields: [
    { name: "client_name", label: "Client/Employer", required: true, description: "Client or employer name" },
    { name: "project_name", label: "Project Name", required: false, description: "Name of the project" },
    { name: "completion_date", label: "Completion Date", required: false, description: "Date of completion" },
  ],
  requiredFields: ["client_name"],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 15, identifiers: 5, qrBarcode: 0, signature: 10, forensics: 10, consistency: 25 },
};

// ═══════════════════════════════════════════════════════════════
// OEM AUTHORIZATION
// ═══════════════════════════════════════════════════════════════

const OEM_SCHEMA: DocumentTypeSchema = {
  docType: "OEM_AUTHORIZATION",
  label: "OEM Authorization Letter",
  issuer: "Original Equipment Manufacturer",
  identityEvidence: {
    coreConcepts: ["authorization letter", "oem authorization", "dealer authorization", "manufacturer authorization"],
    issuerSignals: ["manufacturer", "oem", "dealer"],
    expectedFieldLabels: ["authorization", "authorize", "manufacturer", "dealer", "product", "model"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Authorized signatory", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "oem_name", label: "OEM/Manufacturer Name", required: true, description: "Manufacturer name" },
    { name: "bidder_name", label: "Authorized Bidder", required: true, description: "Authorized party" },
    { name: "product_model", label: "Product/Model", required: false, description: "Product authorized" },
  ],
  requiredFields: ["oem_name", "bidder_name"],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 15, identifiers: 5, qrBarcode: 0, signature: 15, forensics: 10, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// ISO CERTIFICATE
// ═══════════════════════════════════════════════════════════════

const ISO_SCHEMA: DocumentTypeSchema = {
  docType: "ISO_CERTIFICATE",
  label: "ISO Certificate",
  issuer: "Certification Body (BSI, TUV, SGS, Bureau Veritas)",
  identityEvidence: {
    coreConcepts: ["iso certificate", "certification body", "quality management system", "environmental management"],
    identifierPattern: /\bISO\s*\d{4,5}(?::\d{4})?\b/i,
    issuerSignals: ["certification body", "accreditation", "certification"],
    expectedFieldLabels: ["iso", "certificate", "scope", "certification", "organization"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Certification body signature", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam", "income tax"],
  extractableFields: [
    { name: "iso_standard", label: "ISO Standard", pattern: /\bISO\s*\d{4,5}(?::\d{4})?\b/i, required: true, description: "ISO standard number" },
    { name: "certificate_number", label: "Certificate Number", required: true, description: "Certificate number" },
    { name: "organization", label: "Certified Organization", required: true, description: "Organization name" },
    { name: "scope", label: "Scope", required: true, description: "Scope of certification" },
  ],
  requiredFields: ["iso_standard", "certificate_number"],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 15, identifiers: 10, qrBarcode: 0, signature: 10, forensics: 10, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// TURNOVER CERTIFICATE
// ═══════════════════════════════════════════════════════════════

const TURNOVER_SCHEMA: DocumentTypeSchema = {
  docType: "TURNOVER_PROOF",
  label: "Turnover Certificate",
  issuer: "Chartered Accountant / CA Firm",
  identityEvidence: {
    coreConcepts: ["turnover certificate", "chartered accountant", "financial year", "turnover"],
    issuerSignals: ["chartered accountant", "ca", "certified"],
    expectedFieldLabels: ["turnover", "financial year", "certified", "chartered accountant"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "CA signature", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
    { name: "stamp", type: "stamp", description: "CA stamp/seal", expected: false, bonusIfPresent: 3, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "organization_name", label: "Organization Name", required: true, description: "Company name" },
    { name: "financial_year", label: "Financial Year", required: true, description: "Financial year" },
    { name: "turnover_amount", label: "Turnover Amount", required: true, description: "Annual turnover" },
    { name: "ca_name", label: "CA Name", required: false, description: "Chartered Accountant name" },
  ],
  requiredFields: ["organization_name", "turnover_amount"],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 20, identifiers: 5, qrBarcode: 0, signature: 10, forensics: 5, consistency: 25 },
};

// ═══════════════════════════════════════════════════════════════
// WORK ORDER / PURCHASE ORDER
// ═══════════════════════════════════════════════════════════════

const WORKORDER_SCHEMA: DocumentTypeSchema = {
  docType: "WORK_ORDER",
  label: "Work Order / Purchase Order",
  issuer: "Client / Government Department",
  identityEvidence: {
    coreConcepts: ["work order", "purchase order", "supply order"],
    issuerSignals: [],
    expectedFieldLabels: ["work order", "purchase order", "buyer", "supplier", "order number"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Authorized signatory", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "order_number", label: "PO/WO Number", required: true, description: "Order number" },
    { name: "buyer_name", label: "Buyer", required: true, description: "Buyer name" },
    { name: "supplier_name", label: "Supplier", required: true, description: "Supplier name" },
  ],
  requiredFields: ["order_number"],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 10, qrBarcode: 0, signature: 10, forensics: 5, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// ITR DOCUMENT
// ═══════════════════════════════════════════════════════════════

const ITR_SCHEMA: DocumentTypeSchema = {
  docType: "ITR_DOCUMENT",
  label: "ITR Acknowledgement",
  issuer: "Income Tax Department",
  identityEvidence: {
    coreConcepts: ["income tax return", "return of income", "acknowledgement"],
    issuerSignals: ["income tax department", "income tax"],
    expectedFieldLabels: ["income tax return", "acknowledgement", "assessment year", "pan"],
    minConceptMatches: 2,
    identityThreshold: 40,
  },
  supportingSignals: [],
  forbiddenKeywords: ["goods and services tax", "gstin", "udyam"],
  extractableFields: [
    { name: "pan", label: "PAN", required: true, description: "PAN of taxpayer" },
    { name: "assessment_year", label: "Assessment Year", required: true, description: "Assessment year" },
    { name: "acknowledgement_number", label: "Acknowledgement No.", required: true, description: "ITR acknowledgement number" },
  ],
  requiredFields: ["acknowledgement_number"],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 15, qrBarcode: 0, signature: 5, forensics: 10, consistency: 15 },
};

// ═══════════════════════════════════════════════════════════════
// BANK CERTIFICATE
// ═══════════════════════════════════════════════════════════════

const BANK_SCHEMA: DocumentTypeSchema = {
  docType: "BANK_CERTIFICATE",
  label: "Bank Certificate / Cancelled Cheque",
  issuer: "Bank",
  identityEvidence: {
    coreConcepts: ["bank certificate", "cancelled cheque", "bank guarantee", "bank statement"],
    issuerSignals: ["bank", "ifsc", "micr"],
    expectedFieldLabels: ["bank", "account", "ifsc", "account holder", "branch"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "bank_name", label: "Bank Name", required: true, description: "Bank name" },
    { name: "account_holder", label: "Account Holder", required: true, description: "Account holder" },
    { name: "ifsc", label: "IFSC Code", pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/, required: false, description: "IFSC code" },
  ],
  requiredFields: ["bank_name"],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 15, qrBarcode: 0, signature: 0, forensics: 10, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// EPFO/ESIC
// ═══════════════════════════════════════════════════════════════

const EPFO_SCHEMA: DocumentTypeSchema = {
  docType: "EPFO_ESIC",
  label: "EPFO / ESIC Registration",
  issuer: "EPFO / ESIC",
  identityEvidence: {
    coreConcepts: ["epfo", "esic", "provident fund", "employee state insurance"],
    issuerSignals: ["epfo", "esic", "provident fund"],
    expectedFieldLabels: ["epfo", "esic", "establishment", "employer", "code number"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "establishment_name", label: "Establishment Name", required: true, description: "Employer name" },
    { name: "code_number", label: "Code Number", required: false, description: "EPFO/ESIC code" },
  ],
  requiredFields: ["establishment_name"],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 10, qrBarcode: 0, signature: 0, forensics: 15, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// LOCAL CONTENT DECLARATION
// ═══════════════════════════════════════════════════════════════

const LOCAL_CONTENT_SCHEMA: DocumentTypeSchema = {
  docType: "LOCAL_CONTENT_DECLARATION",
  label: "Local Content Declaration",
  issuer: "Bidder / Company",
  identityEvidence: {
    coreConcepts: ["local content", "make in india", "local content declaration"],
    issuerSignals: [],
    expectedFieldLabels: ["local content", "make in india", "declaration", "compliance"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Authorized signatory", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["goods and services tax", "udyam"],
  extractableFields: [
    { name: "content_percentage", label: "Local Content %", required: false, description: "Local content percentage" },
  ],
  requiredFields: [],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 5, qrBarcode: 0, signature: 10, forensics: 10, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// AFFIDAVIT / UNDERTAKING
// ═══════════════════════════════════════════════════════════════

const UNDERTAKING_SCHEMA: DocumentTypeSchema = {
  docType: "OTHER",
  label: "Undertaking / Affidavit / Declaration",
  issuer: "Bidder / Company",
  identityEvidence: {
    coreConcepts: ["undertaking", "affidavit", "declaration", "self-declaration"],
    issuerSignals: [],
    expectedFieldLabels: ["undertaking", "affidavit", "declare", "declaration"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "signature", type: "signature", description: "Declarant signature", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
    { name: "stamp", type: "stamp", description: "Stamp paper", expected: false, bonusIfPresent: 3, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: [],
  extractableFields: [
    { name: "declarant_name", label: "Declarant Name", required: false, description: "Person making declaration" },
  ],
  requiredFields: [],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 10, identifiers: 0, qrBarcode: 0, signature: 15, forensics: 10, consistency: 30 },
};

// ═══════════════════════════════════════════════════════════════
// INVOICE
// ═══════════════════════════════════════════════════════════════

const INVOICE_SCHEMA: DocumentTypeSchema = {
  docType: "INVOICE",
  label: "Tax Invoice",
  issuer: "Seller / Supplier",
  identityEvidence: {
    coreConcepts: ["tax invoice", "invoice", "bill"],
    issuerSignals: [],
    expectedFieldLabels: ["invoice number", "invoice date", "buyer", "seller", "amount", "total"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [],
  forbiddenKeywords: [],
  extractableFields: [
    { name: "invoice_number", label: "Invoice Number", required: true, description: "Invoice number" },
    { name: "buyer_name", label: "Buyer", required: true, description: "Buyer name" },
    { name: "total_amount", label: "Total Amount", required: false, description: "Total amount" },
  ],
  requiredFields: ["invoice_number"],
  validationRules: [],
  weights: { classification: 30, structure: 10, extraction: 15, identifiers: 10, qrBarcode: 5, signature: 0, forensics: 10, consistency: 20 },
};

// ═══════════════════════════════════════════════════════════════
// TECHNICAL DATASHEET
// ═══════════════════════════════════════════════════════════════

const DATASHEET_SCHEMA: DocumentTypeSchema = {
  docType: "TECHNICAL_DATASHEET",
  label: "Technical Datasheet",
  issuer: "Manufacturer / OEM",
  identityEvidence: {
    coreConcepts: ["datasheet", "data sheet", "technical specification", "product specification"],
    issuerSignals: ["manufacturer", "oem"],
    expectedFieldLabels: ["specification", "technical", "product", "model", "features"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [],
  forbiddenKeywords: [],
  extractableFields: [
    { name: "product_name", label: "Product Name", required: true, description: "Product name" },
    { name: "model_number", label: "Model Number", required: false, description: "Model number" },
  ],
  requiredFields: ["product_name"],
  validationRules: [],
  weights: { classification: 25, structure: 10, extraction: 15, identifiers: 5, qrBarcode: 0, signature: 0, forensics: 10, consistency: 35 },
};

// ═══════════════════════════════════════════════════════════════
// TYPES NEEDED BY PIPELINE
// ═══════════════════════════════════════════════════════════════

export interface DocSchemaRuleResult {
  passed: boolean;
  detail: string;
  score?: number;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TYPE IDENTIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-identify document type from text content.
 * Tries each schema's identity evidence and returns the best match.
 */
export function identifyDocumentType(
  text: string,
): { docType: string; confidence: number; schema: DocumentTypeSchema } | null {
  let bestMatch: { docType: string; confidence: number; schema: DocumentTypeSchema } | null = null;
  
  for (const schema of ALL_SCHEMAS) {
    const result = evaluateIdentityEvidence(text, schema);
    if (result.passed && (!bestMatch || result.score > bestMatch.confidence)) {
      bestMatch = {
        docType: schema.docType,
        confidence: result.score,
        schema,
      };
    }
  }
  
  return bestMatch;
}

/**
 * Evaluate the declared document type against the content.
 * This is the STRICT IDENTITY GATE: does this content contain sufficient
 * evidence to be the document type the user selected?
 */
export function evaluateDeclaredTypeIdentity(
  text: string,
  declaredDocType: string,
): { passed: boolean; score: number; reason: string; evidence: Record<string, any> } {
  const schema = getDocSchema(declaredDocType);
  if (!schema) {
    // No schema for this type — can't evaluate, let it pass with low confidence
    return {
      passed: false,
      score: 0,
      reason: "NO_SCHEMA_AVAILABLE",
      evidence: { declaredType: declaredDocType },
    };
  }
  
  const result = evaluateIdentityEvidence(text, schema);
  
  return {
    passed: result.passed,
    score: result.score,
    reason: result.reason || (result.passed ? "IDENTITY_PASSED" : "INSUFFICIENT_EVIDENCE"),
    evidence: {
      declaredType: declaredDocType,
      schemaType: schema.docType,
      schemaLabel: schema.label,
      identityThreshold: schema.identityEvidence.identityThreshold,
      matchedConcepts: result.matchedConcepts,
      identifierFound: result.identifierFound,
      matchedIssuer: result.matchedIssuer,
      fieldLabelsFound: result.fieldLabelsFound,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// AADHAAR CARD SCHEMA
// ═══════════════════════════════════════════════════════════════

const AADHAAR_SCHEMA: DocumentTypeSchema = {
  docType: "AADHAAR_CARD",
  label: "Aadhaar Card",
  issuer: "Unique Identification Authority of India (UIDAI)",
  identityEvidence: {
    coreConcepts: ["aadhaar", "unique identification authority", "uidai", "unique identification number", "आधार"],
    identifierPattern: /\b\d{4}[ ]?\d{4}[ ]?\d{4}\b/,
    issuerSignals: ["uidai", "unique identification authority", "government of india"],
    expectedFieldLabels: ["aadhaar", "unique identification", "uid", "dob", "gender", "address"],
    minConceptMatches: 1,
    identityThreshold: 35,
  },
  supportingSignals: [
    { name: "photo", type: "photo", description: "Photograph of Aadhaar holder", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
    { name: "qr", type: "qr", description: "QR code on Aadhaar", expected: true, bonusIfPresent: 5, penaltyIfAbsent: 0 },
  ],
  forbiddenKeywords: ["permanent account number", "income tax department", "goods and services tax", "gstin", "udyam"],
  extractableFields: [
    { name: "aadhaar_number", label: "Aadhaar Number", pattern: /\b(\d{4}[ ]?\d{4}[ ]?\d{4})\b/, required: true, description: "12-digit Aadhaar number" },
    { name: "holder_name", label: "Name", required: true, description: "Name of Aadhaar holder" },
    { name: "dob", label: "Date of Birth", required: false, description: "Date of birth" },
    { name: "gender", label: "Gender", required: false, description: "Gender" },
  ],
  requiredFields: ["aadhaar_number"],
  validationRules: [
    {
      name: "aadhaar_format",
      description: "Aadhaar number must be 12 digits",
      severity: "CRITICAL",
      check: (text) => {
        const match = text.match(/\b(\d{4}[ ]?\d{4}[ ]?\d{4})\b/);
        if (!match) return { passed: false, detail: "No valid 12-digit Aadhaar number found" };
        return { passed: true, detail: `Valid Aadhaar: ${match[1]}`, score: 5 };
      },
    },
  ],
  weights: { classification: 30, structure: 10, extraction: 10, identifiers: 20, qrBarcode: 10, signature: 5, forensics: 10, consistency: 5 },
};

// ═══════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════

const ALL_SCHEMAS: DocumentTypeSchema[] = [
  PAN_SCHEMA, GST_SCHEMA, AADHAAR_SCHEMA, UDYAM_SCHEMA, MCA_SCHEMA, EXPERIENCE_SCHEMA,
  OEM_SCHEMA, ISO_SCHEMA, TURNOVER_SCHEMA, WORKORDER_SCHEMA, ITR_SCHEMA,
  BANK_SCHEMA, EPFO_SCHEMA, LOCAL_CONTENT_SCHEMA, UNDERTAKING_SCHEMA,
  INVOICE_SCHEMA, DATASHEET_SCHEMA,
];

const SCHEMA_MAP: Record<string, DocumentTypeSchema> = {};
for (const schema of ALL_SCHEMAS) {
  SCHEMA_MAP[schema.docType] = schema;
}

export function getDocSchema(docType: string): DocumentTypeSchema | undefined {
  return SCHEMA_MAP[docType];
}

/**
 * Evaluate document-type identity evidence against a schema.
 * Returns a score 0-100 and which evidence signals matched.
 */
export function evaluateIdentityEvidence(
  text: string,
  schema: DocumentTypeSchema,
): { score: number; passed: boolean; matchedConcepts: string[]; matchedIssuer: string[]; identifierFound: boolean; fieldLabelsFound: string[]; reason: string } {
  const lower = text.toLowerCase();
  const evidence = schema.identityEvidence;
  
  // 1. Core concept matching
  const matchedConcepts: string[] = [];
  for (const concept of evidence.coreConcepts) {
    if (lower.includes(concept.toLowerCase())) {
      matchedConcepts.push(concept);
    }
  }
  
  // 2. Identifier pattern matching
  let identifierFound = false;
  if (evidence.identifierPattern) {
    identifierFound = evidence.identifierPattern.test(text);
  }
  
  // 3. Issuer signal matching
  const matchedIssuer: string[] = [];
  for (const issuer of evidence.issuerSignals) {
    if (lower.includes(issuer.toLowerCase())) {
      matchedIssuer.push(issuer);
    }
  }
  
  // 4. Expected field labels
  const fieldLabelsFound: string[] = [];
  for (const label of evidence.expectedFieldLabels) {
    if (lower.includes(label.toLowerCase())) {
      fieldLabelsFound.push(label);
    }
  }
  
  // 5. Forbidden keyword check (strong negative signal)
  const forbiddenFound = schema.forbiddenKeywords.filter(kw => lower.includes(kw));
  
  // 6. Calculate identity score
  let score = 0;
  
  // Core concept score: each match = 20 points, up to 60
  score += Math.min(60, matchedConcepts.length * 20);
  
  // Identifier pattern score: 25 points if found
  if (identifierFound) score += 25;
  
  // Issuer signal score: each match = 5 points, up to 15
  score += Math.min(15, matchedIssuer.length * 5);
  
  // Field label score: each match = 2 points, up to 10
  score += Math.min(10, fieldLabelsFound.length * 2);
  
  // Forbidden keyword penalty: -30 each
  score -= forbiddenFound.length * 30;
  
  score = Math.max(0, Math.min(100, score));
  
  // 7. Determine pass/fail
  const conceptThreshold = Math.min(evidence.minConceptMatches, matchedConcepts.length);
  const conceptsPassed = matchedConcepts.length >= evidence.minConceptMatches || identifierFound;
  const passed = score >= evidence.identityThreshold && conceptsPassed;
  
  let reason = "";
  if (!passed) {
    if (matchedConcepts.length === 0 && !identifierFound) {
      reason = "CORE_DOCUMENT_EVIDENCE_MISSING";
    } else if (forbiddenFound.length > 0) {
      reason = "WRONG_DOCUMENT_TYPE";
    } else {
      reason = "DOCUMENT_TYPE_NOT_ESTABLISHED";
    }
  }
  
  return { score, passed, matchedConcepts, matchedIssuer, identifierFound, fieldLabelsFound, reason };
}

export function getAllSchemas(): DocumentTypeSchema[] {
  return [...ALL_SCHEMAS];
}

export { ALL_SCHEMAS, SCHEMA_MAP };
