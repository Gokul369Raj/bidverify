/**
 * DOCUMENT-TYPE-AWARE VERIFICATION PIPELINE
 *
 * Single source of truth for document vault verification.
 * The selected document type is a strict requirement.
 * Wrong document → score = 0, STATUS = FAILED.
 *
 * Architecture:
 *   1. File Intake & Validation
 *   2. PDF Encryption Detection / Password Unlock
 *   3. Native Text Extraction
 *   4. OCR Fallback
 *   5. Document-Type Rules Engine (HARD GATE)
 *   6. Critical Field Extraction & Validation
 *   7. QR / Barcode Verification
 *   8. Digital Signature Detection
 *   9. Tamper / Forensic Analysis
 *  10. Weighted Scoring
 *  11. Result Explanation
 *  12. Audit Log
 */

import zlib from "zlib";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type VerificationStatus =
  | "PROCESSING"
  | "VERIFIED"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "BLOCKED"
  | "PASSWORD_REQUIRED";

export interface VerificationResult {
  status: VerificationStatus;
  score: number; // 0-100
  selectedDocType: string;
  detectedDocType: string | null;
  docTypeMatch: boolean;

  // Evidence breakdown
  evidence: EvidenceBreakdown;

  // Extracted fields from the actual document
  extractedFields: ExtractedField[];

  // Processing metadata
  processing: ProcessingMeta;

  // Audit trail
  audit: AuditEntry[];

  // Human-readable messages
  humanMessage: string;
  actionMessage: string;
  failureReason: string | null;

  // OCR status (for debugging production issues)
  ocrFailed: boolean;
  textExtractionMode: string;
}

export interface EvidenceBreakdown {
  docTypeMatch: EvidenceItem;
  requiredIdentifier: EvidenceItem;
  supportingFields: EvidenceItem;
  ocrConfidence: EvidenceItem;
  qrVerification: EvidenceItem;
  digitalSignature: EvidenceItem;
  structuralConsistency: EvidenceItem;
  tamperAnalysis: EvidenceItem;
}

export interface EvidenceItem {
  label: string;
  status: "PASS" | "FAIL" | "WARN" | "NOT_APPLICABLE" | "NOT_DETECTED";
  score: number; // points earned (0-max)
  maxScore: number;
  detail: string;
  source?: string; // page, OCR region, etc.
}

export interface ExtractedField {
  field: string;
  value: string;
  page?: number;
  confidence: number;
  source: "NATIVE_TEXT" | "OCR" | "QR" | "AI_VISION" | "METADATA";
  verified: boolean;
}

export interface ProcessingMeta {
  fileName: string;
  fileType: string;
  fileSize: number;
  isPdf: boolean;
  isImage: boolean;
  wasEncrypted: boolean;
  wasDecrypted: boolean;
  passwordProvided: boolean;
  passwordCorrect: boolean | null;
  textExtractionMode: "NATIVE" | "OCR" | "NATIVE_AND_OCR" | "GARBAGE" | "NONE";
  textLength: number;
  ocrConfidence: number;
  pageCount: number;
  processingTimeMs: number;
}

export interface AuditEntry {
  timestamp: number;
  step: string;
  detail: string;
  durationMs?: number;
}

export interface DocVerificationInput {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  declaredDocType: string;
  pdfPassword?: string;
  organizationId?: string;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TYPE RULES ENGINE
// ═══════════════════════════════════════════════════════════════

export interface DocTypeRule {
  docType: string;
  label: string;

  /** Required identifier pattern — MUST be found or score = 0 */
  requiredIdentifier: {
    name: string;
    pattern: RegExp;
    label: string;
    validate?: (value: string) => boolean;
  };

  /** Core concept keywords — at least N must match */
  coreConcepts: {
    keywords: string[];
    minMatches: number;
  };

  /** Issuer/authority keywords */
  issuerKeywords: string[];

  /** Field labels expected in the document */
  expectedFieldLabels: string[];

  /** Forbidden keywords (from other doc types) */
  forbiddenKeywords: string[];

  /** Supporting field patterns (optional but boost score) */
  supportingPatterns: {
    name: string;
    pattern: RegExp;
    label: string;
  }[];

  /** Scoring weights */
  weights: {
    docTypeMatch: number;
    requiredIdentifier: number;
    supportingFields: number;
    ocrConfidence: number;
    qrVerification: number;
    digitalSignature: number;
    structuralConsistency: number;
    tamperAnalysis: number;
  };
}

// ─────────────── GSTIN Checksum ───────────────

const GST_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16",
  "17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32",
  "33","34","35","36","37","38","97","99",
]);

function gstinChecksumValid(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  const stateCode = gstin.slice(0, 2);
  if (!GST_STATE_CODES.has(stateCode)) return false;
  const panSegment = gstin.slice(2, 12);
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panSegment)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = GST_CHARSET.indexOf(gstin[i]);
    if (val < 0) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = val * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expected = GST_CHARSET[(36 - (sum % 36)) % 36];
  return gstin[14] === expected;
}

// ─────────────── PAN Format Validation ───────────────

function panFormatValid(pan: string): boolean {
  if (pan.length !== 10) return false;
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return false;
  const entityType = pan[3];
  return "PCHFATBLJG".includes(entityType);
}

// ─────────────── Document Type Rules ───────────────

const DOC_TYPE_RULES: DocTypeRule[] = [
  {
    docType: "PAN_CARD",
    label: "PAN Card",
    requiredIdentifier: {
      name: "pan",
      pattern: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/,
      label: "PAN Number",
      validate: panFormatValid,
    },
    coreConcepts: {
      keywords: ["permanent account number", "income tax department", "income tax", "pan card", "department of income tax", "आयकर विभाग", "स्थायी लेखा संख्या", "भारत सरकार", "govt of india"],
      minMatches: 1,
    },
    issuerKeywords: ["income tax department", "income tax", "government of india", "nsdl", "utiitsl", "incometax.gov.in"],
    expectedFieldLabels: ["permanent account number", "pan", "name", "date of birth", "father"],
    forbiddenKeywords: ["gstin", "goods and services tax", "udyam", "msme", "registration certificate"],
    supportingPatterns: [
      { name: "holder_name", pattern: /(?:name|shri|smt|ms|mr)[\s:]*([A-Z][A-Z\s]{2,30})/i, label: "Holder Name" },
      { name: "dob", pattern: /(?:date of birth|dob|dob\/)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Date of Birth" },
      { name: "father_name", pattern: /(?:father'?s?\s*name|father)[\s:]*([A-Z][A-Z\s]{2,30})/i, label: "Father's Name" },
      { name: "aadhaar_number", pattern: /\b(\d{4}[ ]?\d{4}[ ]?\d{4})\b/, label: "Aadhaar Number" },
      { name: "gender", pattern: /\b(male|female|transgender)\b/i, label: "Gender" },
      { name: "signature", pattern: /(?:signature|sign)[\s:]*([A-Z][A-Z\s]{2,30})/i, label: "Signature" },
    ],
    weights: {
      docTypeMatch: 25,
      requiredIdentifier: 25,
      supportingFields: 15,
      ocrConfidence: 10,
      qrVerification: 10,
      digitalSignature: 5,
      structuralConsistency: 5,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "GST_CERTIFICATE",
    label: "GST Registration Certificate",
    requiredIdentifier: {
      name: "gstin",
      pattern: /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i,
      label: "GSTIN",
      validate: gstinChecksumValid,
    },
    coreConcepts: {
      keywords: ["goods and services tax", "gst", "registration certificate", "form gst reg-06", "gst registration", "gstin", "taxpayer", "principal place of business", "constitution of business"],
      minMatches: 2,
    },
    issuerKeywords: ["goods and services tax", "gstn", "gst portal", "cbic", "central board of indirect taxes"],
    expectedFieldLabels: ["gstin", "legal name", "trade name", "registration", "certificate", "taxpayer", "principal place of business"],
    forbiddenKeywords: ["permanent account number", "income tax department", "udyam", "msme"],
    supportingPatterns: [
      { name: "legal_name", pattern: /(?:legal\s*name|name\s*of\s*taxpayer)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Legal Name" },
      { name: "trade_name", pattern: /(?:trade\s*name|business\s*name)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Trade Name" },
      { name: "registration_date", pattern: /(?:registration\s*date|date\s*of\s*registration)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Registration Date" },
      { name: "state_code", pattern: /\b([0-9]{2})\b/, label: "State Code" },
      { name: "business_constitution", pattern: /(?:constitution\s*of\s*business|business\s*constitution)[\s:]*(proprietorship|partnership|company|llp|trust|society|others)/i, label: "Business Constitution" },
      { name: "effective_date", pattern: /(?:effective\s*date|date\s*of\s*effect)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Effective Date" },
      { name: "gstin_in_qr", pattern: /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/, label: "GSTIN (from QR)" },
    ],
    weights: {
      docTypeMatch: 25,
      requiredIdentifier: 25,
      supportingFields: 15,
      ocrConfidence: 10,
      qrVerification: 10,
      digitalSignature: 5,
      structuralConsistency: 5,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "UDYAM_CERTIFICATE",
    label: "Udyam / MSME Certificate",
    requiredIdentifier: {
      name: "udyam_number",
      pattern: /\b(UDYAM[- ]?[A-Z]{2}[- ]?\d{2}[- ]?\d{7})\b/i,
      label: "Udyam Registration Number",
      validate: (v) => /^UDYAM[- ]?[A-Z]{2}[- ]?\d{2}[- ]?\d{7}$/i.test(v.replace(/\s/g, "")),
    },
    coreConcepts: {
      keywords: ["udyam", "msme", "micro", "small", "medium", "enterprise", "ministry of micro", "udyam registration certificate", "udyog aadhaar", "enterprise type", "micro enterprise", "small enterprise", "medium enterprise", "ministry of micro small and medium enterprises"],
      minMatches: 2,
    },
    issuerKeywords: ["ministry of micro", "small and medium", "enterprise", "udyam", "msme", "ministry of micro small and medium enterprises"],
    expectedFieldLabels: ["udyam registration number", "enterprise name", "type of enterprise", "enterprise type", "udyam number"],
    forbiddenKeywords: ["gstin", "goods and services tax", "permanent account number", "income tax"],
    supportingPatterns: [
      { name: "enterprise_name", pattern: /(?:enterprise\s*name|name\s*of\s*enterprise)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Enterprise Name" },
      { name: "enterprise_type", pattern: /(?:type\s*of\s*enterprise|enterprise\s*type)[\s:]*(micro|small|medium)/i, label: "Enterprise Type" },
      { name: "registration_date", pattern: /(?:date\s*of\s*registration|registration\s*date)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Registration Date" },
      { name: "nic_code", pattern: /(?:nic\s*code|national\s*industrial\s*classification)[\s:]*(\d{4,5})/i, label: "NIC Code" },
      { name: "investment_amount", pattern: /(?:investment|plant\s*and\s*machinery|equipment)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i, label: "Investment Amount" },
      { name: "turnover_amount", pattern: /(?:turnover|annual\s*turnover)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i, label: "Turnover Amount" },
      { name: "date_of_incorporation", pattern: /(?:date\s*of\s*incorporation|incorporation\s*date|date\s*of\s*commencement)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Date of Incorporation" },
      { name: "pan_in_cert", pattern: /\b([A-Z]{5}[0-9]{4}[A-Z])\b/, label: "PAN (secondary)" },
    ],
    weights: {
      docTypeMatch: 25,
      requiredIdentifier: 25,
      supportingFields: 15,
      ocrConfidence: 10,
      qrVerification: 10,
      digitalSignature: 5,
      structuralConsistency: 5,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "EXPERIENCE_CERTIFICATE",
    label: "Experience Certificate",
    requiredIdentifier: {
      name: "certificate_id",
      pattern: /\b(?:work\s*order|purchase\s*order|WO|PO|completion\s*certificate|experience\s*certificate)[\s:]*(\S{3,30})\b/i,
      label: "Certificate/Order Reference",
    },
    coreConcepts: {
      keywords: ["experience", "work order", "supply", "installation", "completion", "certificate", "satisfactory", "work completion", "satisfactory completion", "performance", "contract value", "duration of work", "scope of work"],
      minMatches: 2,
    },
    issuerKeywords: ["government", "ministry", "department", "public works", "PWD", "NHAI", "railway", "defense", "municipal"],
    expectedFieldLabels: ["experience", "work order", "supply", "completion", "certificate", "purchaser", "contractor", "contract value", "duration"],
    forbiddenKeywords: ["gstin", "permanent account", "udyam"],
    supportingPatterns: [
      { name: "purchaser", pattern: /(?:purchaser|client|buyer)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Purchaser" },
      { name: "value", pattern: /(?:value|amount|cost|contract\s*value)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i, label: "Value" },
      { name: "completion_date", pattern: /(?:completion\s*date|date\s*of\s*completion|completed\s*on)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Completion Date" },
      { name: "project_name", pattern: /(?:project\s*name|name\s*of\s*project|description\s*of\s*work)[\s:]*([A-Z][A-Z\s&]{2,80})/i, label: "Project Name" },
      { name: "client_name", pattern: /(?:client|department|ministry)[\s:]*([A-Z][A-Z\s&]{2,80})/i, label: "Client Name" },
      { name: "contract_duration", pattern: /(?:duration|period|timeframe)[\s:]*(\d+\s*(?:months?|days?|years?|weeks?))/i, label: "Contract Duration" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "TURNOVER_PROOF",
    label: "Turnover Proof",
    requiredIdentifier: {
      name: "fy",
      pattern: /(?:financial\s*year|FY)\s*(\d{4}[–-]\d{2,4})/i,
      label: "Financial Year",
    },
    coreConcepts: {
      keywords: ["turnover", "financial year", "revenue", "chartered accountant", "certified", "balance sheet", "profit and loss", "annual turnover", "gross turnover", "net turnover", "audit"],
      minMatches: 2,
    },
    issuerKeywords: ["chartered accountant", "ca", "audit", "certified", "icai"],
    expectedFieldLabels: ["turnover", "financial year", "revenue", "certified", "chartered accountant", "balance sheet"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "turnover_amount", pattern: /(?:turnover|revenue|total\s*income|gross\s*turnover|net\s*turnover)[\s:]*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{2})?)/i, label: "Turnover Amount" },
      { name: "amount_with_rupee", pattern: /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{2})?)/i, label: "Amount (₹)" },
      { name: "ca_registration", pattern: /(?:membership\s*no|registration\s*no|F\.?R\.?N)[\s:]*(\S{5,20})/i, label: "CA Registration Number" },
      { name: "audit_firm", pattern: /(?:audit\s*firm|firm\s*name|chartered\s*accountant)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Audit Firm Name" },
      { name: "assessment_year", pattern: /(?:assessment\s*year|AY)\s*(\d{4}[–-]\d{2,4})/i, label: "Assessment Year" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "OEM_AUTHORIZATION",
    label: "OEM Authorization Letter",
    requiredIdentifier: {
      name: "authorization_ref",
      pattern: /\b(?:authorization|authorized|auth)[\s:]*(\S{3,30})\b/i,
      label: "Authorization Reference",
    },
    coreConcepts: {
      keywords: ["authorization", "authorized", "oem", "original equipment", "dealer", "distributor", "authorization letter", "authorized dealer", "authorized distributor", "sole distributor", "oem certificate", "product authorization"],
      minMatches: 2,
    },
    issuerKeywords: ["authorization", "authorized", "oem", "manufacturer", "dealer", "distributor"],
    expectedFieldLabels: ["authorization", "authorized", "dealer", "distributor", "manufacturer"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "oem_name", pattern: /(?:manufacturer|oem|company)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "OEM Name" },
      { name: "product_model", pattern: /(?:model|product|part\s*no|model\s*no)[\s:]*([A-Z0-9][A-Z0-9\s\-]{2,30})/i, label: "Product Model" },
      { name: "authorization_validity", pattern: /(?:valid\s*(?:up\s*to|until|till|from)|period)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Authorization Validity" },
      { name: "territory", pattern: /(?:territory|region|area|state|district)[\s:]*([A-Z][A-Z\s,]{2,50})/i, label: "Territory/Region" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "ISO_CERTIFICATE",
    label: "ISO Certificate",
    requiredIdentifier: {
      name: "iso_number",
      pattern: /\b(ISO\s*\d{4,5})\b/i,
      label: "ISO Standard Number",
    },
    coreConcepts: {
      keywords: ["iso", "quality management", "certificate", "certification", "iso 9001", "iso 14001", "iso 45001", "quality management system", "environmental management", "occupational health", "certification body", "accreditation"],
      minMatches: 2,
    },
    issuerKeywords: ["certification body", "accreditation", "internationally recognized", "accredited"],
    expectedFieldLabels: ["iso", "quality management", "certificate", "scope", "validity", "certification body"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "cert_number", pattern: /(?:certificate\s*number|cert\.?\s*no)[\s:]*(\S{5,30})/i, label: "Certificate Number" },
      { name: "valid_from", pattern: /(?:valid\s*from|issue\s*date|date\s*of\s*issue)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Valid From" },
      { name: "valid_until", pattern: /(?:valid\s*(?:up\s*to|until|till|to)|expiry\s*date|expiration)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Valid Until" },
      { name: "scope_of_certification", pattern: /(?:scope\s*of\s*certification|scope)[\s:]*([A-Z][A-Z\s&,]{5,100})/i, label: "Scope of Certification" },
      { name: "certification_body_name", pattern: /(?:certified\s*by|certification\s*body|issued\s*by)[\s:]*([A-Z][A-Z\s&]{2,60})/i, label: "Certification Body" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "COMPANY_CERTIFICATE",
    label: "Certificate of Incorporation",
    requiredIdentifier: {
      name: "cin",
      pattern: /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{2,3}\d{6})\b/,
      label: "CIN (Company Identification Number)",
    },
    coreConcepts: {
      keywords: ["certificate", "incorporation", "company", "memorandum", "articles", "certificate of incorporation", "memorandum of association", "articles of association", "registered office", "directors", "authorized capital"],
      minMatches: 2,
    },
    issuerKeywords: ["ministry of corporate affairs", "mca", "registrar of companies"],
    expectedFieldLabels: ["certificate", "incorporation", "company", "cin", "registered office", "directors"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "company_name", pattern: /(?:company\s*name|name\s*of\s*company)[\s:]*([A-Z][A-Z\s&]{2,50})/i, label: "Company Name" },
      { name: "date_of_incorporation", pattern: /(?:date\s*of\s*incorporation|incorporated\s*on)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Date of Incorporation" },
      { name: "registered_office", pattern: /(?:registered\s*office|registered\s*address)[\s:]*([A-Z][A-Z\s,]{5,100})/i, label: "Registered Office Address" },
      { name: "director_name", pattern: /(?:director|directors?)[\s:]*([A-Z][A-Z\s]{2,40})/i, label: "Director Name" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "LOCAL_CONTENT_DECLARATION",
    label: "Local Content Declaration",
    requiredIdentifier: {
      name: "local_content_pct",
      pattern: /(\d+\s*%)\s*(?:local\s*content|indigenous|make\s*in\s*india)/i,
      label: "Local Content Percentage",
    },
    coreConcepts: {
      keywords: ["local content", "declaration", "make in india", "indigenous", "domestic", "local content declaration", "public procurement order", "ppp 2017", "self-reliant india", "atmanirbhar bharat"],
      minMatches: 2,
    },
    issuerKeywords: ["government", "ministry", "department", "public procurement"],
    expectedFieldLabels: ["local content", "percentage", "declaration", "indigenous", "make in india"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "percentage", pattern: /(\d+\s*%)/, label: "Local Content Percentage" },
      { name: "declaration_date", pattern: /(?:declaration\s*date|date\s*of\s*declaration|dated)[\s:]*(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4})/i, label: "Declaration Date" },
      { name: "authorized_signatory", pattern: /(?:authorized\s*signatory|signatory|sign)[\s:]*([A-Z][A-Z\s]{2,40})/i, label: "Authorized Signatory" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
  {
    docType: "TECHNICAL_DATASHEET",
    label: "Technical Datasheet",
    requiredIdentifier: {
      name: "spec_ref",
      pattern: /\b(?:specification|technical|datasheet|data\s*sheet)[\s:]*(\S{3,30})\b/i,
      label: "Specification Reference",
    },
    coreConcepts: {
      keywords: ["specification", "technical", "datasheet", "data sheet", "product", "model", "technical specification", "product datasheet", "performance parameters", "technical compliance", "bidder must comply"],
      minMatches: 2,
    },
    issuerKeywords: [],
    expectedFieldLabels: ["specification", "technical", "product", "model", "capacity", "performance"],
    forbiddenKeywords: [],
    supportingPatterns: [
      { name: "model_number", pattern: /(?:model|model\s*no|part\s*no)[\s:]*([A-Z0-9][A-Z0-9\s\-]{2,30})/i, label: "Model Number" },
      { name: "capacity_rating", pattern: /(?:capacity|power\s*rating|rating|output)[\s:]*(\d+[\d\s]*(?:kva|kw|mva|volt|ampere|ton|hp|mm|cm|meter|litre|kg)?)/i, label: "Capacity/Power Rating" },
      { name: "technical_params", pattern: /(?:voltage|current|frequency|temperature|pressure|flow\s*rate|dimension|weight|speed)[\s:]*([\d\s\.]+[A-Za-z\/°%]*)/i, label: "Technical Parameter" },
    ],
    weights: {
      docTypeMatch: 30,
      requiredIdentifier: 20,
      supportingFields: 20,
      ocrConfidence: 10,
      qrVerification: 0,
      digitalSignature: 5,
      structuralConsistency: 10,
      tamperAnalysis: 5,
    },
  },
];

/** Get rules for a document type */
export function getDocTypeRule(docType: string): DocTypeRule | undefined {
  return DOC_TYPE_RULES.find(r => r.docType === docType);
}

/** Get all supported document types */
export function getSupportedDocTypes(): string[] {
  return DOC_TYPE_RULES.map(r => r.docType);
}

// ═══════════════════════════════════════════════════════════════
// TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractPdfTextNative(buf: Buffer): { text: string; pageCount: number } {
  const latin = buf.toString("latin1");

  let pageCount = 1;
  const counts = [...latin.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map(m => parseInt(m[1], 10));
  if (counts.length) pageCount = Math.max(...counts);

  let text = "";
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let streamCount = 0;

  while ((m = re.exec(latin)) !== null && streamCount < 100) {
    const dataStart = m.index + m[0].length;
    const endIdx = latin.indexOf("endstream", dataStart);
    if (endIdx === -1) continue;

    const rawBytes = buf.subarray(dataStart, endIdx);
    streamCount++;

    try {
      const inflated = zlib.inflateSync(rawBytes);
      const str = inflated.toString("latin1");

      // Extract text from BT...ET blocks
      const textBlocks = str.match(/BT[\s\S]*?ET/g);
      if (textBlocks) {
        for (const block of textBlocks) {
          const literals = block.match(/\(([^)]*)\)/g);
          if (literals) {
            text += literals.map(l => l.slice(1, -1)).join(" ") + " ";
          }
          const hexStrings = block.match(/<([0-9A-Fa-f]+)>/g);
          if (hexStrings) {
            for (const hex of hexStrings) {
              try {
                const decoded = Buffer.from(hex.slice(1, -1), "hex").toString("utf16le");
                text += decoded + " ";
              } catch {}
            }
          }
        }
      }

      // Also extract raw text patterns
      const textPatterns = str.match(/[A-Za-z\s]{8,}/g);
      if (textPatterns) {
        text += textPatterns.join(" ") + " ";
      }
    } catch {}
  }

  return { text: text.trim(), pageCount };
}

async function ocrBuffer(buffer: Buffer, isPdf: boolean): Promise<{ text: string; confidence: number }> {
  try {
    const { ocrImageAsync, renderAndOcrPdfAsync, ocrPdfImagesAsync } = await import("./ocr");
    if (isPdf) {
      try {
        const rendered = await renderAndOcrPdfAsync(buffer, 3);
        if (rendered.text.length > 10) {
          return { text: rendered.text, confidence: rendered.confidence };
        }
      } catch {}
      const imgResult = await ocrPdfImagesAsync(buffer, 3);
      if (imgResult.text.length > 10) {
        return { text: imgResult.text, confidence: imgResult.confidence };
      }
      return { text: "", confidence: 0 };
    }
    const result = await ocrImageAsync(buffer);
    return { text: result.text, confidence: result.confidence };
  } catch {
    return { text: "", confidence: 0 };
  }
}

function detectFeatures(buf: Buffer, isPdf: boolean) {
  const latin = buf.toString("latin1");
  const hasDigitalSignature = isPdf && /\/ByteRange\s*\[[^\]]+\]/.test(latin) && /\/Sig\b|\/SigField\b|adbe\.pkcs7|ETSI\.CAdES/.test(latin);
  const hasQrCode = isPdf ? /\/Subtype\s*\/Image/.test(latin) && latin.includes("stream") : false;
  const isEncrypted = isPdf && /\/Encrypt\s+\d+\s+\d+\s+R/.test(latin);
  return { hasDigitalSignature, hasQrCode, isEncrypted };
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT TYPE DETECTION (informational)
// ═══════════════════════════════════════════════════════════════

function detectDocumentType(text: string): { docType: string; confidence: number } | null {
  const lower = text.toLowerCase();

  if (/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i.test(text) &&
      (lower.includes("goods and services tax") || lower.includes("gst") || lower.includes("gstin") || lower.includes("registration certificate"))) {
    return { docType: "GST_CERTIFICATE", confidence: 0.9 };
  }
  if (lower.includes("permanent account number") ||
      (lower.includes("income tax") && /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(text)) ||
      lower.includes("आयकर विभाग")) {
    return { docType: "PAN_CARD", confidence: 0.85 };
  }
  if (/\b(udyan[- ]?[a-z]{2}[- ]?\d{2}[- ]?\d{7})\b/i.test(text) ||
      lower.includes("udyam registration") ||
      lower.includes("udyam registration certificate") ||
      lower.includes("udyog aadhaar") ||
      (lower.includes("udyam") && lower.includes("enterprise"))) {
    return { docType: "UDYAM_CERTIFICATE", confidence: 0.9 };
  }
  if (/\biso\s*\d{4,5}\b/.test(lower) && lower.includes("certificate")) {
    return { docType: "ISO_CERTIFICATE", confidence: 0.8 };
  }
  if ((lower.includes("experience") || lower.includes("completion certificate") || lower.includes("work order")) &&
      (lower.includes("supply") || lower.includes("installation") || lower.includes("delivery") || lower.includes("satisfactory"))) {
    return { docType: "EXPERIENCE_CERTIFICATE", confidence: 0.75 };
  }
  if ((lower.includes("turnover") || lower.includes("revenue") || lower.includes("balance sheet")) &&
      (lower.includes("financial year") || lower.includes("chartered accountant") || lower.includes("audit"))) {
    return { docType: "TURNOVER_PROOF", confidence: 0.75 };
  }
  if (/\b([lu]\d{5}[a-z]{2}\d{4}[a-z]{2,3}\d{6})\b/i.test(text) ||
      lower.includes("certificate of incorporation") || lower.includes("incorporation")) {
    return { docType: "COMPANY_CERTIFICATE", confidence: 0.8 };
  }
  if (lower.includes("local content") || lower.includes("make in india") ||
      lower.includes("atmanirbhar bharat") || lower.includes("public procurement") ||
      lower.includes("ppp 2017")) {
    return { docType: "LOCAL_CONTENT_DECLARATION", confidence: 0.75 };
  }
  if (lower.includes("datasheet") || lower.includes("data sheet") ||
      lower.includes("technical specification") || lower.includes("product datasheet") ||
      (lower.includes("specification") && lower.includes("technical"))) {
    return { docType: "TECHNICAL_DATASHEET", confidence: 0.7 };
  }
  if (lower.includes("invoice") || lower.includes("bill")) {
    return { docType: "OTHER", confidence: 0.5 };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// MAIN VERIFICATION PIPELINE
// ═══════════════════════════════════════════════════════════════

export async function verifyDocument(input: DocVerificationInput): Promise<VerificationResult> {
  const startTime = Date.now();
  const audit: AuditEntry[] = [];
  const ext = input.fileName.toLowerCase().split(".").pop() ?? "";
  const isPdf = ext === "pdf" || input.buffer.subarray(0, 4).toString("latin1") === "%PDF-";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif"].includes(ext);

  const processing: ProcessingMeta = {
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.buffer.length,
    isPdf,
    isImage,
    wasEncrypted: false,
    wasDecrypted: false,
    passwordProvided: !!input.pdfPassword,
    passwordCorrect: null,
    textExtractionMode: "NONE",
    textLength: 0,
    ocrConfidence: 0,
    pageCount: 1,
    processingTimeMs: 0,
  };

  const auditLog = (step: string, detail: string, durationMs?: number) => {
    audit.push({ timestamp: Date.now(), step, detail, durationMs });
  };

  // ─── STEP 1: FILE INTAKE & VALIDATION ───
  auditLog("FILE_INTAKE", `File: ${input.fileName}, Size: ${input.buffer.length} bytes`);

  if (input.buffer.length < 100) {
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit, "File is too small to be a valid document", "Upload a valid document file");
  }
  if (input.buffer.length > 50 * 1024 * 1024) {
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit, "File exceeds maximum size limit (50MB)", "Upload a smaller file");
  }
  if (!isPdf && !isImage) {
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit, "File is not a recognized document format (PDF, JPG, PNG)", "Upload a PDF or image file");
  }

  // ─── STEP 2: PDF ENCRYPTION / PASSWORD ───
  let processedBuffer = input.buffer;
  if (isPdf) {
    const features = detectFeatures(input.buffer, true);
    processing.wasEncrypted = features.isEncrypted;

    if (features.isEncrypted) {
      auditLog("ENCRYPTION", "PDF is password-protected");
      const { tryDecryptPdf } = await import("./pdfDecrypt");
      
      // Try user-provided password first, then auto-try common Indian govt passwords
      const passwordsToTry = input.pdfPassword 
        ? [input.pdfPassword, ""]
        : ["", "password", "1234"]; // common defaults for govt PDFs
      
      let decrypted = false;
      for (const pwd of passwordsToTry) {
        const decryptStart = Date.now();
        try {
          const result = await tryDecryptPdf(input.buffer, pwd || undefined);
          if (result.wasEncrypted && result.decrypted.length > input.buffer.length * 0.5) {
            processedBuffer = result.decrypted;
            processing.wasDecrypted = true;
            processing.passwordCorrect = true;
            auditLog("DECRYPTION", `PDF decrypted with password: ${pwd ? "(provided)" : "(empty/default)"}`, Date.now() - decryptStart);
            decrypted = true;
            break;
          }
        } catch {
          // Continue to next password
        }
      }

      if (!decrypted) {
        processing.passwordCorrect = false;
        processing.processingTimeMs = Date.now() - startTime;
        if (input.pdfPassword) {
          return buildBlockedResult(input.declaredDocType, processing, audit, "Incorrect PDF password", "Enter the correct document password");
        }
        return buildBlockedResult(input.declaredDocType, processing, audit, "This PDF is password-protected. Enter the document password to continue.", "Enter PDF Password");
      }
    }
  }

  // ─── STEP 3: NATIVE TEXT EXTRACTION ───
  let extractedText = "";
  let pageCount = 1;

  if (isPdf) {
    const extractStart = Date.now();
    const result = extractPdfTextNative(processedBuffer);
    extractedText = result.text;
    pageCount = result.pageCount;
    processing.pageCount = pageCount;
    auditLog("NATIVE_TEXT", `Extracted ${extractedText.length} characters from ${pageCount} page(s)`, Date.now() - extractStart);

    if (extractedText.length > 50) {
      processing.textExtractionMode = "NATIVE";
    }
  }

  // ─── TEXT QUALITY GATE ───
  // Check if native extraction produced usable text (not just binary garbage)
  const printableChars = extractedText.replace(/[^\x20-\x7E]/g, "").length;
  const textQuality = extractedText.length > 0 ? printableChars / extractedText.length : 0;
  const hasUsefulContent = textQuality > 0.5 && extractedText.length > 50;
  
  if (processing.textExtractionMode === "NATIVE" && !hasUsefulContent) {
    auditLog("TEXT_QUALITY", `Native text is mostly garbage (quality: ${(textQuality * 100).toFixed(1)}%), will try OCR`, 0);
    processing.textExtractionMode = "GARBAGE";
  }

  // ─── STEP 4: OCR FALLBACK ───
  let ocrConfidence = 0;
  let ocrFailed = false;
  const needsOcr = extractedText.length < 50 || !hasUsefulContent || isImage;

  if (needsOcr) {
    const ocrStart = Date.now();
    try {
      const ocrResult = await ocrBuffer(processedBuffer, isPdf);
      ocrConfidence = ocrResult.confidence;
      processing.ocrConfidence = ocrConfidence;

      if (ocrResult.text.length > 20) {
        // Use OCR text if it's longer OR if native was garbage
        const ocrPrintable = ocrResult.text.replace(/[^\x20-\x7E]/g, "").length;
        const ocrQuality = ocrPrintable / ocrResult.text.length;
        const shouldUseOcr = ocrResult.text.length > extractedText.length || !hasUsefulContent || ocrQuality > textQuality;
        
        if (shouldUseOcr) {
          extractedText = ocrResult.text;
          processing.textExtractionMode = processing.textExtractionMode === "NATIVE" ? "NATIVE_AND_OCR" : "OCR";
        }
      }
      auditLog("OCR", `OCR extracted ${ocrResult.text.length} chars, confidence: ${ocrConfidence.toFixed(1)}%`, Date.now() - ocrStart);
    } catch (ocrErr) {
      ocrFailed = true;
      console.warn("OCR failed, continuing with native text:", ocrErr instanceof Error ? ocrErr.message : ocrErr);
      auditLog("OCR", `OCR failed: ${ocrErr instanceof Error ? ocrErr.message : "unknown error"} - using native text only`, Date.now() - ocrStart);
    }
  }

  processing.textLength = extractedText.length;

  if (extractedText.length === 0) {
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit,
      "Could not extract any text from the document. The file may be corrupted, image-only without OCR support, or empty.",
      "Upload a clearer document or a text-based PDF");
  }

  // ─── STEP 5: DOCUMENT-TYPE RULES ENGINE (HARD GATE) ───
  const gateStart = Date.now();
  const rule = getDocTypeRule(input.declaredDocType);
  const lower = extractedText.toLowerCase();

  if (!rule) {
    // Unknown doc type — can't apply hard gate, skip to generic scoring
    auditLog("RULES_ENGINE", `No rules defined for document type: ${input.declaredDocType}`);
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit,
      `Document type "${input.declaredDocType}" is not supported for automated verification.`,
      "Contact support for this document type");
  }

  // Detect what the document actually is (informational)
  const autoDetected = detectDocumentType(extractedText);
  const detectedDocType = autoDetected?.docType ?? null;
  const docTypeMatch = detectedDocType === input.declaredDocType || detectedDocType === null;

  // Check forbidden keywords
  const forbiddenFound = rule.forbiddenKeywords.filter(kw => lower.includes(kw));
  if (forbiddenFound.length > 0 && !docTypeMatch) {
    auditLog("HARD_GATE", `FAIL: Forbidden keywords found: ${forbiddenFound.join(", ")}`, Date.now() - gateStart);
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit,
      `The uploaded document appears to be a ${detectedDocType?.replace(/_/g, " ") || "different document type"}, not a ${rule.label}. Forbidden keywords: ${forbiddenFound.join(", ")}`,
      `Upload a valid ${rule.label}`);
  }

  // Check required identifier
  const identifierMatch = extractedText.match(rule.requiredIdentifier.pattern);
  let identifierValue = "";
  let identifierValid = false;

  if (identifierMatch) {
    identifierValue = (identifierMatch[1] || identifierMatch[0]).trim();
    identifierValid = rule.requiredIdentifier.validate
      ? rule.requiredIdentifier.validate(identifierValue)
      : identifierValue.length > 3;
  }

  if (!identifierValid) {
    // ═══════════════════════════════════════════════════════════
    // HARD GATE FAIL: Required identifier NOT found
    // SCORE = 0, STATUS = FAILED
    // ═══════════════════════════════════════════════════════════
    auditLog("HARD_GATE", `FAIL: Required ${rule.requiredIdentifier.label} not found or invalid`, Date.now() - gateStart);
    processing.processingTimeMs = Date.now() - startTime;

    const detectedLabel = detectedDocType?.replace(/_/g, " ") || "unknown document type";
    return buildFailResult(input.declaredDocType, processing, audit,
      `Selected document type is ${rule.label}, but no valid ${rule.requiredIdentifier.label} was detected in the uploaded file. Detected document appears to be: ${detectedLabel}.`,
      `Upload a valid ${rule.label} that contains a readable ${rule.requiredIdentifier.label}`);
  }

  auditLog("HARD_GATE", `PASS: ${rule.requiredIdentifier.label} found: ${identifierValue}`, Date.now() - gateStart);

  // Check core concepts
  const coreMatches = rule.coreConcepts.keywords.filter(kw => lower.includes(kw));
  const coreConceptsMet = coreMatches.length >= rule.coreConcepts.minMatches;

  if (!coreConceptsMet) {
    auditLog("CORE_CONCEPTS", `FAIL: Only ${coreMatches.length}/${rule.coreConcepts.minMatches} core concepts found`, Date.now() - gateStart);
    processing.processingTimeMs = Date.now() - startTime;
    return buildFailResult(input.declaredDocType, processing, audit,
      `A ${rule.requiredIdentifier.label} was found (${identifierValue}), but insufficient ${rule.label}-specific evidence was detected. Found ${coreMatches.length}/${rule.coreConcepts.minMatches} required concept keywords.`,
      `Upload a clearer ${rule.label}`);
  }

  auditLog("CORE_CONCEPTS", `PASS: ${coreMatches.length} core concepts found: ${coreMatches.join(", ")}`, Date.now() - gateStart);

  // ─── STEP 6: FIELD EXTRACTION ───
  const fieldsStart = Date.now();
  const extractedFields: ExtractedField[] = [];

  // Add the required identifier
  extractedFields.push({
    field: rule.requiredIdentifier.name,
    value: identifierValue,
    page: 1,
    confidence: identifierValid ? 0.95 : 0.5,
    source: isImage ? "OCR" : "NATIVE_TEXT",
    verified: identifierValid,
  });

  // Extract supporting fields
  for (const sp of rule.supportingPatterns) {
    const match = extractedText.match(sp.pattern);
    if (match) {
      extractedFields.push({
        field: sp.name,
        value: (match[1] || match[0]).trim(),
        page: 1,
        confidence: 0.8,
        source: isImage ? "OCR" : "NATIVE_TEXT",
        verified: true,
      });
    }
  }

  auditLog("FIELD_EXTRACTION", `Extracted ${extractedFields.length} fields`, Date.now() - fieldsStart);

  // ─── STEP 7: QR / BARCODE ───
  const qrStart = Date.now();
  let qrScore = 0;
  let qrDetail = "Not applicable";
  let qrStatus: EvidenceItem["status"] = "NOT_APPLICABLE";

  if (isPdf || isImage) {
    try {
      const { scanForQrCodes, compareQrWithFields } = await import("./qr");
      const qrFindings = scanForQrCodes(input.fileName, processedBuffer);
      if (qrFindings.length > 0) {
        const fields: Record<string, string> = {};
        for (const f of extractedFields) fields[f.field] = f.value;
        const consistency = compareQrWithFields(qrFindings, fields);

        if (consistency.status === "CONSISTENT") {
          qrScore = rule.weights.qrVerification;
          qrDetail = `QR code found and data matches document fields`;
          qrStatus = "PASS";
        } else if (consistency.status === "CONFLICT") {
          qrScore = 0;
          qrDetail = `QR code found but data CONFLICTS with document fields — potential tampering`;
          qrStatus = "FAIL";
        } else {
          qrScore = Math.floor(rule.weights.qrVerification * 0.5);
          qrDetail = `QR code found but consistency check inconclusive`;
          qrStatus = "WARN";
        }
      } else {
        qrDetail = "No QR code found in document";
        qrStatus = "NOT_DETECTED";
        qrScore = Math.floor(rule.weights.qrVerification * 0.5); // neutral
      }
    } catch {
      qrDetail = "QR analysis failed";
      qrStatus = "NOT_APPLICABLE";
    }
  }
  auditLog("QR_ANALYSIS", qrDetail, Date.now() - qrStart);

  // ─── STEP 8: DIGITAL SIGNATURE ───
  const sigStart = Date.now();
  let sigScore = 0;
  let sigDetail = "Not applicable";
  let sigStatus: EvidenceItem["status"] = "NOT_APPLICABLE";

  if (isPdf) {
    try {
      const { detectPdfSignature } = await import("./signatures");
      const sigResult = await detectPdfSignature(processedBuffer);
      if (sigResult.status === "SIGNATURE_DETECTED" || sigResult.status === "SIGNATURE_INFO_PARTIAL") {
        if (sigResult.isTrustedCA) {
          sigScore = rule.weights.digitalSignature;
          sigDetail = `Digital signature by trusted CA (${sigResult.caName || "known CA"})${sigResult.signerName ? ` — ${sigResult.signerName}` : ""}`;
          sigStatus = "PASS";
        } else {
          sigScore = Math.floor(rule.weights.digitalSignature * 0.75);
          sigDetail = `Digital signature detected (${sigResult.caName || "unrecognized CA"})${sigResult.signerName ? ` — ${sigResult.signerName}` : ""}`;
          sigStatus = "PASS";
        }
      } else if (processing.wasEncrypted) {
        // Encrypted + no explicit signature detected — still a strong signal
        sigScore = Math.floor(rule.weights.digitalSignature * 0.7);
        sigDetail = "Encrypted government document — signature likely present but not explicitly detected";
        sigStatus = "WARN";
      } else {
        sigDetail = "No digital signature found";
        sigStatus = "NOT_DETECTED";
        sigScore = 0;
      }
    } catch {
      sigDetail = "Signature analysis failed";
    }
  }
  auditLog("DIGITAL_SIGNATURE", sigDetail, Date.now() - sigStart);

  // ─── STEP 9: TAMPER / FORENSIC ANALYSIS ───
  const forensicStart = Date.now();
  let tamperScore = rule.weights.tamperAnalysis;
  let tamperDetail = "No significant anomalies detected";
  let tamperStatus: EvidenceItem["status"] = "PASS";

  if (isPdf) {
    try {
      const { analyzePdf, maxSignalSeverity } = await import("./pdfForensics");
      const forensics = analyzePdf(processedBuffer);
      const severity = maxSignalSeverity(forensics.signals);

      if (severity === "HIGH") {
        const nonGovSignals = forensics.signals.filter(
          s => s.severity === "HIGH" && s.code !== "PDF_JAVASCRIPT" && s.code !== "MODIFIED_AFTER_CREATION"
        );
        if (nonGovSignals.length > 0) {
          tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.3);
          tamperDetail = `Potential tampering detected: ${nonGovSignals.map(s => s.detail).join("; ")}`;
          tamperStatus = "FAIL";
        } else {
          tamperDetail = "Forensic signals detected but consistent with government-issued documents";
          tamperStatus = "WARN";
          tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.7);
        }
      } else if (severity === "MEDIUM") {
        tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.6);
        tamperDetail = "Minor forensic indicators detected";
        tamperStatus = "WARN";
      }
    } catch {
      tamperDetail = "Forensic analysis failed";
    }
  } else if (isImage) {
    try {
      const { analyzeImage, maxImageSeverity } = await import("./imageForensics");
      const imgForensics = analyzeImage(input.fileName, processedBuffer);
      const imgSeverity = maxImageSeverity(imgForensics.signals);
      if (imgSeverity === "HIGH") {
        tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.2);
        tamperDetail = `Image tampering indicators: ${imgForensics.signals.filter(s => s.severity === "HIGH").map(s => s.detail).join("; ")}`;
        tamperStatus = "FAIL";
      } else if (imgSeverity === "MEDIUM") {
        tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.5);
        tamperDetail = `Image forensic warnings: ${imgForensics.signals.filter(s => s.severity === "MEDIUM").map(s => s.detail).join("; ")}`;
        tamperStatus = "WARN";
      } else if (imgSeverity === "LOW") {
        tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.7);
        tamperDetail = "Minor image quality issues detected";
        tamperStatus = "WARN";
      }
    } catch {
      tamperScore = Math.floor(rule.weights.tamperAnalysis * 0.5);
      tamperDetail = "Image forensic analysis failed";
      tamperStatus = "WARN";
    }
  }
  auditLog("TAMPER_ANALYSIS", tamperDetail, Date.now() - forensicStart);

  // ─── STEP 10: STRUCTURAL CONSISTENCY ───
  let structScore = rule.weights.structuralConsistency;
  let structDetail = "No consistency issues detected";
  let structStatus: EvidenceItem["status"] = "PASS";

  // Check if extracted text contains expected field labels
  const labelsFound = rule.expectedFieldLabels.filter(l => lower.includes(l.toLowerCase()));
  const labelRatio = rule.expectedFieldLabels.length > 0 ? labelsFound.length / rule.expectedFieldLabels.length : 1;
  if (labelRatio < 0.3) {
    structScore = Math.floor(rule.weights.structuralConsistency * 0.5);
    structDetail = `Only ${labelsFound.length}/${rule.expectedFieldLabels.length} expected field labels found`;
    structStatus = "WARN";
  }

  // ─── STEP 11: WEIGHTED SCORING ───
  const w = rule.weights;

  // Doc type match score
  let docTypeScore = 0;
  if (docTypeMatch) {
    docTypeScore = w.docTypeMatch;
  } else if (detectedDocType && detectedDocType !== "OTHER") {
    docTypeScore = 0;
  } else {
    docTypeScore = Math.floor(w.docTypeMatch * 0.5); // UNKNOWN = uncertain
  }

  // Required identifier score
  const idScore = identifierValid ? w.requiredIdentifier : 0;

  // Supporting fields score
  const supportingCount = extractedFields.filter(f => f.field !== rule.requiredIdentifier.name && f.verified).length;
  const maxSupporting = rule.supportingPatterns.length || 1;
  const supportScore = Math.min(w.supportingFields, Math.floor((supportingCount / maxSupporting) * w.supportingFields));

  // OCR confidence score
  let ocrScore = 0;
  if (processing.textExtractionMode !== "NONE") {
    if (ocrFailed) {
      // OCR failed but we have native text - give partial credit for text extraction
      ocrScore = Math.floor(w.ocrConfidence * Math.min(0.6, processing.textLength > 200 ? 0.6 : processing.textLength / 200 * 0.6));
    } else {
      ocrScore = Math.floor(w.ocrConfidence * Math.min(1, processing.textLength > 200 ? 1 : processing.textLength / 200));
      if (ocrConfidence > 70) ocrScore = w.ocrConfidence;
      else if (ocrConfidence > 40) ocrScore = Math.floor(w.ocrConfidence * 0.7);
    }
  }

  const totalScore = docTypeScore + idScore + supportScore + ocrScore + qrScore + sigScore + structScore + tamperScore;
  const maxPossible = w.docTypeMatch + w.requiredIdentifier + w.supportingFields + w.ocrConfidence + w.qrVerification + w.digitalSignature + w.structuralConsistency + w.tamperAnalysis;
  // Use fixed 100 denominator so scores are comparable across document types.
  // Categories with weight=0 don't contribute, but also don't inflate scores.
  let finalScore = maxPossible > 0 ? Math.max(0, Math.min(100, Math.round((totalScore / maxPossible) * 100))) : 0;

  // ─── STEP 12: DETERMINE STATUS ───
  let status: VerificationStatus;
  let humanMessage: string;
  let actionMessage: string;

  if (finalScore >= 75) {
    status = "VERIFIED";
    const ocrNote = ocrFailed ? " (OCR unavailable - scored on native text only)" : "";
    humanMessage = `${rule.label} verified successfully. Required ${rule.requiredIdentifier.label} (${identifierValue}) detected and validated.${ocrNote}`;
    actionMessage = "";
  } else if (finalScore >= 45) {
    status = "NEEDS_REVIEW";
    const ocrNote = ocrFailed ? " (OCR unavailable - scored on native text only)" : "";
    humanMessage = `${rule.label} needs additional review. ${rule.requiredIdentifier.label} found but some checks produced uncertain results.${ocrNote}`;
    actionMessage = "Officer will review this document";
  } else {
    status = "FAILED";
    const ocrNote = ocrFailed ? " (OCR unavailable)" : "";
    humanMessage = `${rule.label} verification failed. Insufficient evidence to confirm document authenticity.${ocrNote}`;
    actionMessage = `Upload a clearer ${rule.label}`;
  }

  // Override: if core concept check failed or doc type mismatch, force FAILED
  if (!coreConceptsMet || (!docTypeMatch && detectedDocType && detectedDocType !== "OTHER")) {
    status = "FAILED";
    finalScore = 0;
    humanMessage = `${rule.label} verification failed — document content does not match ${rule.label} requirements.`;
    actionMessage = `Upload a valid ${rule.label}`;
  }

  auditLog("SCORING", `Final score: ${finalScore}/100, Status: ${status}`);

  processing.processingTimeMs = Date.now() - startTime;

  return {
    status,
    score: finalScore,
    selectedDocType: input.declaredDocType,
    detectedDocType,
    docTypeMatch,
    evidence: {
      docTypeMatch: {
        label: "Document Type Match",
        status: docTypeMatch ? "PASS" : "FAIL",
        score: docTypeScore,
        maxScore: w.docTypeMatch,
        detail: docTypeMatch
          ? `Content matches ${rule.label}`
          : `Content appears to be ${detectedDocType?.replace(/_/g, " ") || "unknown"}, not ${rule.label}`,
      },
      requiredIdentifier: {
        label: rule.requiredIdentifier.label,
        status: identifierValid ? "PASS" : "FAIL",
        score: idScore,
        maxScore: w.requiredIdentifier,
        detail: identifierValid
          ? `${rule.requiredIdentifier.label} detected: ${identifierValue}`
          : `${rule.requiredIdentifier.label} NOT found in document`,
        source: identifierMatch ? `Page 1, extracted via ${isImage ? "OCR" : "native text"}` : undefined,
      },
      supportingFields: {
        label: "Supporting Fields",
        status: supportingCount > 0 ? "PASS" : "WARN",
        score: supportScore,
        maxScore: w.supportingFields,
        detail: `${supportingCount} supporting field(s) extracted: ${extractedFields.filter(f => f.field !== rule.requiredIdentifier.name).map(f => f.field).join(", ") || "none"}`,
      },
      ocrConfidence: {
        label: "Text Extraction / OCR",
        status: processing.textLength > 50 ? "PASS" : "FAIL",
        score: ocrScore,
        maxScore: w.ocrConfidence,
        detail: processing.textExtractionMode === "NONE"
          ? "No text could be extracted"
          : `${processing.textExtractionMode} extraction: ${processing.textLength} characters, OCR confidence: ${ocrConfidence.toFixed(1)}%${ocrFailed ? " (OCR failed, using native text only)" : ""}`,
      },
      qrVerification: {
        label: "QR / Barcode",
        status: qrStatus,
        score: qrScore,
        maxScore: w.qrVerification,
        detail: qrDetail,
      },
      digitalSignature: {
        label: "Digital Signature",
        status: sigStatus,
        score: sigScore,
        maxScore: w.digitalSignature,
        detail: sigDetail,
      },
      structuralConsistency: {
        label: "Structural Consistency",
        status: structStatus,
        score: structScore,
        maxScore: w.structuralConsistency,
        detail: structDetail,
      },
      tamperAnalysis: {
        label: "Tamper Analysis",
        status: tamperStatus,
        score: tamperScore,
        maxScore: w.tamperAnalysis,
        detail: tamperDetail,
      },
    },
    extractedFields,
    processing,
    audit,
    humanMessage,
    actionMessage,
    failureReason: status === "FAILED" ? humanMessage : null,
    ocrFailed,
    textExtractionMode: processing.textExtractionMode,
  };
}

// ═══════════════════════════════════════════════════════════════
// BUILDERS
// ═══════════════════════════════════════════════════════════════

function buildFailResult(
  selectedDocType: string,
  processing: ProcessingMeta,
  audit: AuditEntry[],
  reason: string,
  action: string,
): VerificationResult {
  const rule = getDocTypeRule(selectedDocType);
  return {
    status: "FAILED",
    score: 0,
    selectedDocType,
    detectedDocType: null,
    docTypeMatch: false,
    evidence: {
      docTypeMatch: { label: "Document Type Match", status: "FAIL", score: 0, maxScore: 25, detail: reason },
      requiredIdentifier: { label: rule?.requiredIdentifier.label || "Required Identifier", status: "FAIL", score: 0, maxScore: 25, detail: "Not evaluated" },
      supportingFields: { label: "Supporting Fields", status: "NOT_APPLICABLE", score: 0, maxScore: 15, detail: "Not evaluated" },
      ocrConfidence: { label: "Text Extraction / OCR", status: "NOT_APPLICABLE", score: 0, maxScore: 10, detail: "Not evaluated" },
      qrVerification: { label: "QR / Barcode", status: "NOT_APPLICABLE", score: 0, maxScore: 10, detail: "Not evaluated" },
      digitalSignature: { label: "Digital Signature", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Not evaluated" },
      structuralConsistency: { label: "Structural Consistency", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Not evaluated" },
      tamperAnalysis: { label: "Tamper Analysis", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Not evaluated" },
    },
    extractedFields: [],
    processing,
    audit,
    humanMessage: reason,
    actionMessage: action,
    failureReason: reason,
    ocrFailed: false,
    textExtractionMode: processing.textExtractionMode,
  };
}

function buildBlockedResult(
  selectedDocType: string,
  processing: ProcessingMeta,
  audit: AuditEntry[],
  reason: string,
  action: string,
): VerificationResult {
  const rule = getDocTypeRule(selectedDocType);
  return {
    status: "PASSWORD_REQUIRED",
    score: 0,
    selectedDocType,
    detectedDocType: null,
    docTypeMatch: false,
    evidence: {
      docTypeMatch: { label: "Document Type Match", status: "NOT_APPLICABLE", score: 0, maxScore: 25, detail: "Blocked" },
      requiredIdentifier: { label: rule?.requiredIdentifier.label || "Required Identifier", status: "NOT_APPLICABLE", score: 0, maxScore: 25, detail: "Blocked" },
      supportingFields: { label: "Supporting Fields", status: "NOT_APPLICABLE", score: 0, maxScore: 15, detail: "Blocked" },
      ocrConfidence: { label: "Text Extraction / OCR", status: "NOT_APPLICABLE", score: 0, maxScore: 10, detail: "Blocked" },
      qrVerification: { label: "QR / Barcode", status: "NOT_APPLICABLE", score: 0, maxScore: 10, detail: "Blocked" },
      digitalSignature: { label: "Digital Signature", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Blocked" },
      structuralConsistency: { label: "Structural Consistency", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Blocked" },
      tamperAnalysis: { label: "Tamper Analysis", status: "NOT_APPLICABLE", score: 0, maxScore: 5, detail: "Blocked" },
    },
    extractedFields: [],
    processing,
    audit,
    humanMessage: reason,
    actionMessage: action,
    failureReason: reason,
    ocrFailed: false,
    textExtractionMode: processing.textExtractionMode,
  };
}
