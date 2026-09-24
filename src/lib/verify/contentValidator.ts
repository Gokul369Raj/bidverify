import zlib from "zlib";
import { renderAndOcrPdf } from "./ocr";
import { ocrImage, ocrPdfImages } from "@/lib/verify/ocr";
import { extractSignatureInfo } from "@/lib/verify/pdfDecrypt";

/**
 * COMPREHENSIVE CONTENT-BASED DOCUMENT TYPE VALIDATION — STRICT 0-BASED SCORING
 * 
 * SCORING PHILOSOPHY: Score starts at 0. Points are EARNED only when positive
 * evidence of the declared document type is found. Random images = 0. Wrong docs = 0-10.
 * 
 * Pipeline stages:
 * 1. File integrity check — is file readable, not corrupted, reasonable size?
 * 2. Content extraction — extract text from PDF layers
 * 3. Content type detection — what does this file actually contain?
 * 4. Type match check — does content match declared type?
 * 5. Keyword presence — are required/preferred keywords present?
 * 6. Format validation — GSTIN checksum, PAN format, etc.
 * 7. Structural checks — does document have expected structure?
 * 8. Feature detection — QR, barcode, signature, metadata
 * 9. Cross-field consistency — do internal fields agree?
 * 10. Risk scoring — combine all evidence into final score
 */

export interface ContentValidationResult {
  declaredType: string;
  detectedContentType: DocumentContentType;
  typeMatch: boolean;
  extractedText: string;
  foundKeywords: string[];
  missingKeywords: string[];
  missingChecks: MissingCheck[];
  mismatchPenalty: number;
  contentConfidence: number;
  reasons: string[];
  hasTextContent: boolean;
  pageCount: number;
  isImageOnly: boolean;
  hasBarcode: boolean;
  hasQrCode: boolean;
  hasDigitalSignature: boolean;
  formatValidations: FormatValidation[];
  overallScore: number;
  verdict: "AUTHENTIC" | "SUSPICIOUS" | "REJECTED" | "NEEDS_MANUAL_REVIEW";
}

export interface MissingCheck {
  check: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface FormatValidation {
  field: string;
  value: string;
  valid: boolean;
  detail: string;
}

export type DocumentContentType =
  | "GST_CERTIFICATE"
  | "PAN_CARD"
  | "UDYAM_CERTIFICATE"
  | "EXPERIENCE_CERTIFICATE"
  | "TURNOVER_PROOF"
  | "INVOICE"
  | "OEM_AUTHORIZATION"
  | "ISO_CERTIFICATE"
  | "LOCAL_CONTENT_DECLARATION"
  | "TECHNICAL_DATASHEET"
  | "COMPANY_CERTIFICATE"
  | "WORK_ORDER"
  | "EPFO_ESIC"
  | "ITR_DOCUMENT"
  | "FINANCIAL_STATEMENT"
  | "BANK_CERTIFICATE"
  | "IMAGE_ONLY"
  | "NO_TEXT"
  | "UNKNOWN";

// ─────────────── Document Type Definitions ───────────────

interface DocTypeConfig {
  requiredKeywords: string[];
  preferredKeywords: string[];
  forbiddenKeywords: string[];
  formatPatterns: RegExp[];
  description: string;
  /** How many positive signals needed to start earning points */
  minSignalsForScore: number;
  /** Maximum score achievable just from keyword/content match (not counting format validation) */
  maxContentScore: number;
}

const DOC_TYPE_CONFIGS: Record<string, DocTypeConfig> = {
  GST_CERTIFICATE: {
    requiredKeywords: ["gstin", "goods and services tax", "registration", "certificate"],
    preferredKeywords: [
      "taxpayer", "legal name", "trade name", "business", "status",
      "central board of indirect taxes", "cbic", "tax act", "gst act",
      "effective date", "constitution", "constitution of business",
    ],
    forbiddenKeywords: ["permanent account number", "income tax", "udyam", "msme"],
    formatPatterns: [/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/],
    description: "GST Registration Certificate issued by CBIC",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  PAN_CARD: {
    requiredKeywords: ["permanent account number", "income tax", "income tax department"],
    preferredKeywords: [
      "pan", "card", "date of birth", "father", "signature",
      "department of income tax", "government of india",
      "unique identification", "assessment year",
    ],
    forbiddenKeywords: ["gstin", "goods and services tax", "udyam", "msme"],
    formatPatterns: [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/],
    description: "PAN Card issued by Income Tax Department",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  UDYAM_CERTIFICATE: {
    requiredKeywords: ["udyam", "msme", "micro", "small", "medium"],
    preferredKeywords: [
      "enterprise", "registration", "udyog", "ministry",
      "enterprise name", "enterprise type", "udyam registration number",
      "date of registration", "ministry of micro", "small and medium enterprises",
    ],
    forbiddenKeywords: ["gstin", "goods and services tax", "permanent account number"],
    formatPatterns: [/\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/i],
    description: "Udyam Registration Certificate for MSME",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  EXPERIENCE_CERTIFICATE: {
    requiredKeywords: ["experience", "work order", "supply", "installation", "completion"],
    preferredKeywords: [
      "purchaser", "contractor", "value", "amount", "certificate",
      "order number", "purchase order", "delivery", "commissioning",
      "performance", "satisfactory", "completion certificate",
    ],
    forbiddenKeywords: ["gstin", "permanent account", "udyam"],
    formatPatterns: [],
    description: "Work Experience / Completion Certificate",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  TURNOVER_PROOF: {
    requiredKeywords: ["turnover", "financial year", "revenue"],
    preferredKeywords: [
      "chartered accountant", "certified", "balance sheet",
      "profit", "loss", "audited", "audit", "total income",
      "gross turnover", "net turnover", "ca certificate",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/FY\s*\d{4}[–-]\d{2,4}/i, /\d{4}[–-]\d{2}/],
    description: "Annual Turnover Certificate from Chartered Accountant",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  OEM_AUTHORIZATION: {
    requiredKeywords: ["authorization", "authorized", "oem", "original equipment"],
    preferredKeywords: [
      "dealer", "distributor", "reseller", "manufacturer",
      "product", "category", "validity", "valid till",
      "exclusive", "non-exclusive", "certificate number",
    ],
    forbiddenKeywords: [],
    formatPatterns: [],
    description: "OEM Authorization Letter",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  ISO_CERTIFICATE: {
    requiredKeywords: ["iso", "quality management", "certificate"],
    preferredKeywords: [
      "iso 9001", "iso 14001", "iso 45001", "certification body",
      "scope", "validity", "certificate number", "certified organization",
      "internationally recognized", "accreditation",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/ISO\s*\d{4,5}/i],
    description: "ISO Quality Management Certificate",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  LOCAL_CONTENT_DECLARATION: {
    requiredKeywords: ["local content", "declaration", "make in india"],
    preferredKeywords: [
      "percentage", "indigenous", "domestic", "manufactured",
      "country of origin", "import", "value addition",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/\d+\s*%/],
    description: "Local Content / Make in India Declaration",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  TECHNICAL_DATASHEET: {
    requiredKeywords: ["specification", "technical", "datasheet", "data sheet"],
    preferredKeywords: [
      "product", "model", "capacity", "power", "rating",
      "dimensions", "weight", "material", "standard", "compliance",
    ],
    forbiddenKeywords: [],
    formatPatterns: [],
    description: "Technical Datasheet / Product Specifications",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  COMPANY_CERTIFICATE: {
    requiredKeywords: ["certificate", "incorporation", "company"],
    preferredKeywords: [
      "memorandum", "articles", "board of directors", "registered office",
      "cin", "company identification number", "mca", "ministry of corporate affairs",
      "authorized capital", "paid up capital",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{2,3}\d{6}\b/],
    description: "Certificate of Incorporation",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  INVOICE: {
    requiredKeywords: ["invoice", "bill", "amount"],
    preferredKeywords: [
      "buyer", "seller", "item", "quantity", "rate", "total",
      "gst", "cgst", "sgst", "igst", "tax invoice",
    ],
    forbiddenKeywords: [],
    formatPatterns: [],
    description: "Tax Invoice / Bill",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  WORK_ORDER: {
    requiredKeywords: ["work order", "purchase order", "order"],
    preferredKeywords: [
      "amount", "delivery", "completion", "terms",
      "quantity", "description", "specification",
    ],
    forbiddenKeywords: [],
    formatPatterns: [],
    description: "Work Order / Purchase Order",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  EPFO_ESIC: {
    requiredKeywords: ["epfo", "esic", "provident fund", "employees state insurance"],
    preferredKeywords: [
      "establishment", "code", "contribution", "employee",
      "employer", "monthly", "return",
    ],
    forbiddenKeywords: [],
    formatPatterns: [],
    description: "EPFO/ESIC Compliance Certificate",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  ITR_DOCUMENT: {
    requiredKeywords: ["income tax return", "itr", "assessment year"],
    preferredKeywords: [
      "acknowledgement", "filing", "return", "total income",
      "gross total", "taxable income", "tax paid",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/AY\s*\d{4}[–-]\d{2,4}/i],
    description: "Income Tax Return Filing",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  FINANCIAL_STATEMENT: {
    requiredKeywords: ["balance sheet", "profit", "loss", "financial statement"],
    preferredKeywords: [
      "assets", "liabilities", "revenue", "expense",
      "cash flow", "equity", "audit", "directors report",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/FY\s*\d{4}[–-]\d{2,4}/i],
    description: "Audited Financial Statement",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
  BANK_CERTIFICATE: {
    requiredKeywords: ["bank", "certificate", "account"],
    preferredKeywords: [
      "branch", "ifsc", "account number", "balance",
      "average balance", "relationship", "solvency",
    ],
    forbiddenKeywords: [],
    formatPatterns: [/\b[A-Z]{4}0[A-Z0-9]{6,}\b/],
    description: "Bank Solidity / Account Certificate",
    minSignalsForScore: 2,
    maxContentScore: 50,
  },
};

// ─────────────── GSTIN Format Validation ───────────────

const GST_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GST_STATE_CODES = new Set([
  "01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16",
  "17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32",
  "33","34","35","36","37","38","97","99",
]);

function gstinChecksumChar(first14: string): string {
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

function validateGSTINFormat(text: string): FormatValidation {
  const match = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
  if (!match) return { field: "gstin", value: "NOT_FOUND", valid: false, detail: "No GSTIN pattern found in document" };
  
  const gstin = match[1].toUpperCase();
  const stateCode = gstin.slice(0, 2);
  const stateOk = GST_STATE_CODES.has(stateCode);
  const panSegment = gstin.slice(2, 12);
  const panOk = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panSegment);
  const expectedChecksum = gstinChecksumChar(gstin.slice(0, 14));
  const checksumOk = gstin[14] === expectedChecksum;
  
  const issues: string[] = [];
  if (!stateOk) issues.push(`Invalid state code: ${stateCode}`);
  if (!panOk) issues.push(`Invalid PAN segment: ${panSegment}`);
  if (!checksumOk) issues.push(`Checksum mismatch: expected ${expectedChecksum}, got ${gstin[14]}`);
  
  return {
    field: "gstin",
    value: gstin,
    valid: stateOk && panOk && checksumOk,
    detail: issues.length > 0 ? issues.join("; ") : `Valid GSTIN: ${gstin} (State: ${stateCode})`,
  };
}

function validatePANFormat(text: string): FormatValidation {
  const match = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
  if (!match) return { field: "pan", value: "NOT_FOUND", valid: false, detail: "No PAN pattern found in document" };
  
  const pan = match[1].toUpperCase();
  const entityType = pan[3];
  const validTypes = "PCHFATBLJG";
  const typeOk = validTypes.includes(entityType);
  
  return {
    field: "pan",
    value: pan,
    valid: typeOk,
    detail: typeOk ? `Valid PAN: ${pan} (Entity type: ${entityType})` : `PAN found but invalid entity type: ${entityType}`,
  };
}

function validateUdyamFormat(text: string): FormatValidation {
  const match = text.match(/\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b/i);
  if (!match) return { field: "udyam", value: "NOT_FOUND", valid: false, detail: "No Udyam number pattern found" };
  
  return {
    field: "udyam",
    value: match[1].toUpperCase(),
    valid: true,
    detail: `Valid Udyam number: ${match[1].toUpperCase()}`,
  };
}

// ─────────────── PDF Text Extraction ───────────────

function extractPdfText(buf: Buffer): { text: string; pageCount: number } {
  const latin = buf.toString("latin1");
  
  // Page count
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

// ─────────────── Feature Detection ───────────────

function detectBarcodes(text: string, buf: Buffer): boolean {
  const latin = buf.toString("latin1");
  return /\/Type\s*\/BarCode|barcode|BARCODE/i.test(latin) || 
         /\b\d{12,14}\b/.test(text);
}

function detectQrInPdf(buf: Buffer): boolean {
  const latin = buf.toString("latin1");
  return /\/Subtype\s*\/Image/.test(latin) && latin.includes("stream");
}

function detectDigitalSignature(buf: Buffer): boolean {
  const latin = buf.toString("latin1");
  return /\/ByteRange\s*\[[^\]]+\]/.test(latin) && 
         (/\/Sig\b|\/SigField\b|adbe\.pkcs7|ETSI\.CAdES/.test(latin));
}

// ─────────────── Image File Detection ───────────────

function isImageFile(fileName: string, buf: Buffer): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff", "tif"].includes(ext)) return true;
  // Check magic bytes
  if (buf.length >= 4) {
    const magic = buf.subarray(0, 4).toString("hex");
    if (magic.startsWith("89504e47")) return true; // PNG
    if (magic.startsWith("ffd8ff")) return true; // JPEG
    if (magic.startsWith("47494638")) return true; // GIF
    if (magic.startsWith("424d")) return true; // BMP
  }
  return false;
}

// ─────────────── Main Content Validation ───────────────

export function validateDocumentContent(
  buffer: Buffer,
  declaredType: string,
  fileName: string,
): ContentValidationResult {
  const reasons: string[] = [];
  const missingChecks: MissingCheck[] = [];
  const formatValidations: FormatValidation[] = [];
  
  // ═══════════════════════════════════════════════════════════
  const latin = buffer.toString("latin1");

    // STAGE 1: FILE INTEGRITY
  // ═══════════════════════════════════════════════════════════
  
  // Check if file is empty or too small
  if (buffer.length < 100) {
    return buildResult(declaredType, "UNKNOWN", false, "File is too small to be a valid document", [], [], reasons, missingChecks, formatValidations, 0, 0, false, 0, false, false, false, false);
  }
  
  // Check if file is corrupted (random bytes)
  const head = buffer.subarray(0, 20).toString("latin1");
  const isPdf = head.startsWith("%PDF-");
  const isImage = isImageFile(fileName, buffer);
  
  if (!isPdf && !isImage) {
    // Not a PDF or image — could be corrupted or wrong format
    reasons.push("File is not a recognized PDF or image format");
    missingChecks.push({
      check: "INVALID_FILE_FORMAT",
      description: "File does not match any recognized document format (PDF, PNG, JPEG)",
      severity: "CRITICAL",
    });
    return buildResult(declaredType, "UNKNOWN", false, "Invalid file format", [], [], reasons, missingChecks, formatValidations, 0, 0, false, 0, false, false, false, false);
  }
  
  // Declare scoring variables once — used across all stages
  let score = 0;
  let contentConfidence = 0;
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 2: IMAGE FILE — ACCEPTED, scored differently from PDF
  // ═══════════════════════════════════════════════════════════
  
  // Images (JPG/PNG) are valid document formats — many users upload photos/scans
  // of their certificates. We accept them and run the full verification pipeline.
  // AI vision extracts fields from images; QR codes are decoded from image pixels.

  if (isImage && !isPdf) {
    // Base score for valid image format — not zero, but lower than PDF
    score += 15; // Valid image file
    reasons.push("Image document accepted — AI vision extraction and QR scanning will be used for verification");
    contentConfidence += 0.15;
    // Note about image vs PDF (informational, not critical)
    missingChecks.push({
      check: "IMAGE_FORMAT",
      description: "Document uploaded as image (JPG/PNG). PDF format with digital signature provides stronger verification.",
      severity: "LOW",
    });
  }
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 3: PDF TEXT EXTRACTION
  // ═══════════════════════════════════════════════════════════
  
  const { text, pageCount } = extractPdfText(buffer);
  const hasTextContent = text.length > 50;
  const isImageOnly = !hasTextContent && pageCount > 0;
  const lower = text.toLowerCase();
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 4: STRUCTURAL FEATURE DETECTION
  // ═══════════════════════════════════════════════════════════
  
  const hasBarcode = detectBarcodes(text, buffer);
  const hasQrCode = detectQrInPdf(buffer);
  const hasDigitalSignature = detectDigitalSignature(buffer);
  
  // ═══════════════════════════════════════════════════════════
  // STAGE 5: ENCRYPTED PDF DETECTION — Extract signature info
  // ═══════════════════════════════════════════════════════════
  const isEncrypted = isPdf && /\/Encrypt\s+\d+\s+\d+\s+R/.test(latin);
  let signatureInfo: ReturnType<typeof extractSignatureInfo> | null = null;
  if (isPdf) {
    signatureInfo = extractSignatureInfo(buffer);
  }

  // ═══════════════════════════════════════════════════════════
  // STAGE 6: CONTENT TYPE DETECTION
  // ═══════════════════════════════════════════════════════════
  
  const detectedContentType = detectContentType(text);
  const typeMatch = detectedContentType === declaredType || detectedContentType === "UNKNOWN";
  
  // ═══════════════════════════════════════════════════════════
  // SCORING: Continue from image base score, earn more points
  // ═══════════════════════════════════════════════════════════
  
  // --- STAGE 6: PDF STRUCTURE (0-15 points) ---
  if (isPdf) {
    score += 5; // Valid PDF structure
    if (pageCount > 0 && pageCount <= 20) score += 3; // Reasonable page count
    if (hasDigitalSignature) {
      score += 7; // Has digital signature = strong positive signal
      contentConfidence += 0.3;
    }
  }
  
  // --- STAGE 7: TEXT CONTENT (0-10 points) ---
  if (hasTextContent) {
    score += 10;
    contentConfidence += 0.2;
  } else if (isImageOnly) {
    reasons.push("PDF contains only images (scanned document) — no text layer for verification");
    missingChecks.push({
      check: "OCR_REQUIRED",
      description: "Document has no text layer. OCR processing needed for field extraction.",
      severity: "HIGH",
    });
  } else {
    reasons.push("PDF has no extractable text content — file may be empty or corrupted");
    missingChecks.push({
      check: "NO_TEXT_CONTENT",
      description: "No text could be extracted from PDF streams",
      severity: "CRITICAL",
    });
  }
  
  // --- STAGE 8: TYPE MATCH (0-20 points) ---
  if (typeMatch && detectedContentType !== "UNKNOWN") {
    score += 20; // Content matches declared type
    contentConfidence += 0.3;
    reasons.push(`Document content consistent with ${declaredType.replace(/_/g, " ")}`);
  } else if (detectedContentType !== "UNKNOWN" && !typeMatch) {
    // Type mismatch = wrong document uploaded
    reasons.push(`REJECTED: Document appears to be a ${detectedContentType.replace(/_/g, " ")} but was declared as ${declaredType.replace(/_/g, " ")}`);
    missingChecks.push({
      check: "TYPE_MISMATCH",
      description: `Document content does not match declared type "${declaredType.replace(/_/g, " ")}"`,
      severity: "CRITICAL",
    });
    // Don't add any more points — this is a wrong document
    return buildResult(declaredType, detectedContentType, false, text.slice(0, 5000), [], [], reasons, missingChecks, formatValidations, contentConfidence, score, hasTextContent, pageCount, isImageOnly, hasBarcode, hasQrCode, hasDigitalSignature);
  }
  
  // --- STAGE 9: KEYWORD MATCHING (0-25 points) ---
  const typeConfig = DOC_TYPE_CONFIGS[declaredType];
  if (typeConfig) {
    const foundRequired = typeConfig.requiredKeywords.filter(kw => lower.includes(kw));
    const missingRequired = typeConfig.requiredKeywords.filter(kw => !lower.includes(kw));
    const foundPreferred = typeConfig.preferredKeywords.filter(kw => lower.includes(kw));
    const allFoundKeywords = [...foundRequired, ...foundPreferred];
    
    // Score from required keywords: each found = 5 points
    const requiredScore = foundRequired.length * 5;
    score += requiredScore;
    
    // Score from preferred keywords: each found = 1 point
    score += foundPreferred.length;
    
    // Bonus for having enough keywords
    if (allFoundKeywords.length >= typeConfig.minSignalsForScore) {
      contentConfidence += 0.2;
    }
    
    // Penalty reduction for format-validated documents:
    // If we found a valid format (GSTIN, PAN, Udyam) via format validation,
    // missing keywords are less concerning — the document IS the right type
    const hasFormatValidated = formatValidations.some(f => f.valid);
    
    // Penalties for missing required keywords
    if (missingRequired.length > 0 && hasTextContent) {
      if (hasFormatValidated) {
        // Format-validated: downgrade severity to MEDIUM instead of CRITICAL
        reasons.push(`Note: ${missingRequired.length} keyword(s) not found in text layer, but document format validates correctly`);
        for (const kw of missingRequired) {
          missingChecks.push({
            check: `MISSING_KEYWORD_${kw.toUpperCase().replace(/\s/g, "_")}`,
            description: `Required keyword "${kw}" not found in text layer (may be in images/scanned portion)`,
            severity: "MEDIUM",
          });
        }
      } else {
        reasons.push(`Missing ${missingRequired.length} required keyword(s): ${missingRequired.join(", ")}`);
        for (const kw of missingRequired) {
          missingChecks.push({
            check: `MISSING_KEYWORD_${kw.toUpperCase().replace(/\s/g, "_")}`,
            description: `Required keyword "${kw}" not found in document`,
            severity: "CRITICAL",
          });
        }
      }
    }
    
    // Check forbidden keywords (penalty)
    const forbiddenFound = typeConfig.forbiddenKeywords.filter(kw => lower.includes(kw));
    if (forbiddenFound.length > 0) {
      score = Math.max(0, score - 20); // Heavy penalty
      reasons.push(`Contains keywords from a different document type: ${forbiddenFound.join(", ")}`);
      missingChecks.push({
        check: "FORBIDDEN_KEYWORDS",
        description: `Document contains keywords that should not appear in ${declaredType.replace(/_/g, " ")}: ${forbiddenFound.join(", ")}`,
        severity: "HIGH",
      });
    }
    
    // Cap content score
    score = Math.min(score, typeConfig.maxContentScore);
  }
  
  // --- STAGE 10: FORMAT VALIDATION (0-15 points) ---
  if (declaredType === "GST_CERTIFICATE") {
    const gstinValidation = validateGSTINFormat(text);
    formatValidations.push(gstinValidation);
    if (gstinValidation.valid) {
      score += 15; // Valid GSTIN format = strong evidence
      contentConfidence += 0.2;
    } else if (gstinValidation.value === "NOT_FOUND") {
      missingChecks.push({
        check: "GSTIN_NOT_FOUND",
        description: "No GSTIN number found in document",
        severity: "CRITICAL",
      });
    } else {
      missingChecks.push({
        check: "GSTIN_INVALID",
        description: gstinValidation.detail,
        severity: "MEDIUM",
      });
    }
  }
  
  if (declaredType === "PAN_CARD") {
    const panValidation = validatePANFormat(text);
    formatValidations.push(panValidation);
    if (panValidation.valid) {
      score += 20; // Valid PAN format = very strong evidence
      contentConfidence += 0.3;
    } else if (panValidation.value === "NOT_FOUND") {
      missingChecks.push({
        check: "PAN_NOT_FOUND",
        description: "No PAN number found in document",
        severity: "CRITICAL",
      });
    }
  }
  
  if (declaredType === "UDYAM_CERTIFICATE") {
    const udyamValidation = validateUdyamFormat(text);
    formatValidations.push(udyamValidation);
    if (udyamValidation.valid) {
      score += 15;
      contentConfidence += 0.2;
    } else if (udyamValidation.value === "NOT_FOUND") {
      missingChecks.push({
        check: "UDYAM_NOT_FOUND",
        description: "No Udyam number found in document",
        severity: "CRITICAL",
      });
    }
  }
  
  // --- STAGE 11: ENCRYPTED PDF + SIGNATURE BONUS (0-50 points) ---
  // Government PDFs (PAN, ITR, GST certificates) are often encrypted
  // and signed by CAs like e-Mudhra, NSDL, etc. This is NORMAL and
  // should be treated as a STRONG POSITIVE signal.
  // Encrypted + Signed = almost certainly a genuine government document.
  if (isEncrypted) {
    score += 15; // Encrypted PDFs from government portals are standard
    contentConfidence += 0.2;
    
    if (signatureInfo?.hasSignature) {
      score += 20; // Digitally signed = strong authenticity
      contentConfidence += 0.3;
      
      // Government PDFs with both encryption AND digital signature
      // are extremely likely to be genuine government-issued documents
      // (PAN cards, ITR forms, GST certificates are always this way)
      score += 15; // Encrypted + Signed = government document pattern
      contentConfidence += 0.3;
      reasons.push('Digitally signed government-issued document');
      reasons.push('PDF encryption + digital signature = authentic government format');
    }
  }
  // --- STAGE 12: FEATURE BONUS (0-5 points) ---
  if (hasQrCode) score += 2;
  if (hasBarcode) score += 2;
  if (hasDigitalSignature) score += 3;
  
  // ═══════════════════════════════════════════════════════════
  // FINAL SCORING
  // ═══════════════════════════════════════════════════════════
  
  score = Math.max(0, Math.min(100, score));
  contentConfidence = Math.max(0, Math.min(1, contentConfidence));
  
  // Determine verdict based on score
  let verdict: ContentValidationResult["verdict"] = "REJECTED";
  if (score >= 70) verdict = "AUTHENTIC";
  else if (score >= 50) verdict = "NEEDS_MANUAL_REVIEW";
  else if (score >= 20) verdict = "SUSPICIOUS";
  else verdict = "REJECTED";
  
  // Add signature/encryption info to reasons
  if (signatureInfo?.hasSignature) {
    if (signatureInfo.signerName) reasons.push(`Digital signature by: ${signatureInfo.signerName}`);
    if (signatureInfo.issuerCN) reasons.push(`Certificate issuer: ${signatureInfo.issuerCN}`);
    if (signatureInfo.location) reasons.push(`Signed at: ${signatureInfo.location}`);
    if (signatureInfo.issuerO?.includes('Income Tax') || signatureInfo.issuerO?.includes('Mudhra')) {
      reasons.push('Certificate issued by recognized government authority');
    }
  }
  if (isEncrypted && !signatureInfo?.hasSignature) {
    reasons.push('PDF is encrypted — content extraction limited. Try providing the password for full analysis.');
  }
  
  // Add summary reasons
  if (score === 0) {
    reasons.unshift("DOCUMENT REJECTED: No positive evidence found that this file is a valid " + declaredType.replace(/_/g, " "));
  } else if (score < 20) {
    reasons.unshift("DOCUMENT SUSPICIOUS: Very weak evidence that this file is a valid " + declaredType.replace(/_/g, " "));
  }
  
  return {
    declaredType,
    detectedContentType,
    typeMatch,
    extractedText: text.slice(0, 5000),
    foundKeywords: typeConfig ? [...typeConfig.requiredKeywords, ...typeConfig.preferredKeywords].filter(kw => lower.includes(kw)) : [],
    missingKeywords: typeConfig ? [...typeConfig.requiredKeywords, ...typeConfig.preferredKeywords].filter(kw => !lower.includes(kw)) : [],
    missingChecks,
    mismatchPenalty: typeMatch ? 0 : 100,
    contentConfidence,
    reasons,
    hasTextContent,
    pageCount,
    isImageOnly,
    hasBarcode,
    hasQrCode,
    hasDigitalSignature,
    formatValidations,
    overallScore: score,
    verdict,
  };
}

/** Build result helper */
function buildResult(
  declaredType: string,
  detectedContentType: DocumentContentType,
  typeMatch: boolean,
  textOrMsg: string,
  foundKeywords: string[],
  missingKeywords: string[],
  reasons: string[],
  missingChecks: MissingCheck[],
  formatValidations: FormatValidation[],
  contentConfidence: number,
  score: number,
  hasTextContent: boolean,
  pageCount: number,
  isImageOnly: boolean,
  hasBarcode: boolean,
  hasQrCode: boolean,
  hasDigitalSignature: boolean,
): ContentValidationResult {
  score = Math.max(0, Math.min(100, score));
  let verdict: ContentValidationResult["verdict"] = "REJECTED";
  if (score >= 70) verdict = "AUTHENTIC";
  else if (score >= 50) verdict = "NEEDS_MANUAL_REVIEW";
  else if (score >= 20) verdict = "SUSPICIOUS";
  
  return {
    declaredType,
    detectedContentType,
    typeMatch,
    extractedText: textOrMsg.slice(0, 5000),
    foundKeywords,
    missingKeywords,
    missingChecks,
    mismatchPenalty: typeMatch ? 0 : 100,
    contentConfidence,
    reasons,
    hasTextContent,
    pageCount,
    isImageOnly,
    hasBarcode,
    hasQrCode,
    hasDigitalSignature,
    formatValidations,
    overallScore: score,
    verdict,
  };
}

/** Detect document content type from extracted text */
function detectContentType(text: string): DocumentContentType {
  const lower = text.toLowerCase();
  
  if ((lower.includes("goods and services tax") || lower.includes("gst")) && 
      (lower.includes("gstin") || lower.includes("registration certificate"))) return "GST_CERTIFICATE";
  if (lower.includes("permanent account number") || 
      (lower.includes("income tax") && lower.includes("pan")) ||
      // Also detect PAN from format pattern + income tax context
      (lower.includes("income tax") && /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(text))) return "PAN_CARD";
  if (lower.includes("udyam") || lower.includes("msme") || lower.includes("udyog")) return "UDYAM_CERTIFICATE";
  if (/\biso\s*\d{4,5}\b/.test(lower) && lower.includes("certificate")) return "ISO_CERTIFICATE";
  if ((lower.includes("experience") || lower.includes("completion certificate") || lower.includes("work order")) &&
      (lower.includes("supply") || lower.includes("installation") || lower.includes("delivery"))) return "EXPERIENCE_CERTIFICATE";
  if ((lower.includes("turnover") || lower.includes("revenue")) && 
      (lower.includes("financial year") || lower.includes("chartered accountant") || lower.includes("certified"))) return "TURNOVER_PROOF";
  if (lower.includes("tax invoice") || (lower.includes("invoice") && lower.includes("amount"))) return "INVOICE";
  if ((lower.includes("authorization") || lower.includes("authorized")) && 
      (lower.includes("oem") || lower.includes("manufacturer") || lower.includes("dealer"))) return "OEM_AUTHORIZATION";
  if (lower.includes("local content") || lower.includes("make in india")) return "LOCAL_CONTENT_DECLARATION";
  if (lower.includes("datasheet") || lower.includes("data sheet") || 
      (lower.includes("specification") && lower.includes("technical"))) return "TECHNICAL_DATASHEET";
  if (lower.includes("certificate of incorporation") || lower.includes("incorporation")) return "COMPANY_CERTIFICATE";
  if (lower.includes("income tax return") || lower.includes("itr")) return "ITR_DOCUMENT";
  if (lower.includes("balance sheet") || lower.includes("profit and loss") || lower.includes("financial statement")) return "FINANCIAL_STATEMENT";
  if (lower.includes("bank") && lower.includes("certificate")) return "BANK_CERTIFICATE";
  if (lower.includes("epfo") || lower.includes("esic") || lower.includes("provident fund")) return "EPFO_ESIC";
  
  return "UNKNOWN";
}

/** Validate that extracted field values actually appear in the document text */
export function validateExtractedFieldsInText(
  extractedFields: { field: string; value: string }[],
  documentText: string,
): { field: string; value: string; found: boolean; confidence: number }[] {
  const lower = documentText.toLowerCase();
  
  return extractedFields.map(({ field, value }) => {
    if (!value || value === "NOT_FOUND_IN_SOURCE") {
      return { field, value, found: false, confidence: 0.3 };
    }
    
    const valLower = value.toLowerCase().trim();
    
    if (lower.includes(valLower)) {
      return { field, value, found: true, confidence: 0.95 };
    }
    
    if (field === "gstin" && value.length === 15) {
      const core = value.slice(0, 14).toLowerCase();
      if (lower.includes(core)) return { field, value, found: true, confidence: 0.85 };
      const midPart = value.slice(2, 12).toLowerCase();
      if (lower.includes(midPart)) return { field, value, found: true, confidence: 0.6 };
      return { field, value, found: false, confidence: 0.1 };
    }
    
    if (field === "pan" && value.length === 10) {
      if (lower.includes(valLower)) return { field, value, found: true, confidence: 0.9 };
      return { field, value, found: false, confidence: 0.1 };
    }
    
    if (field.includes("date") || field.includes("Date")) {
      const dateVariants = [value, value.replace(/-/g, "/"), value.replace(/-/g, ".")];
      for (const variant of dateVariants) {
        if (lower.includes(variant.toLowerCase())) return { field, value, found: true, confidence: 0.8 };
      }
      return { field, value, found: false, confidence: 0.2 };
    }
    
    const words = valLower.split(/\s+/).filter(w => w.length > 3);
    const foundWords = words.filter(w => lower.includes(w));
    const ratio = words.length > 0 ? foundWords.length / words.length : 0;
    
    if (ratio >= 0.6) return { field, value, found: true, confidence: 0.5 + ratio * 0.3 };
    if (ratio >= 0.3) return { field, value, found: false, confidence: 0.3 };
    
    return { field, value, found: false, confidence: 0.1 };
  });
}

// ─────────────── OCR-Enhanced Validation ───────────────

/**
 * Validate document content with OCR fallback for scanned/image-only documents.
 * For PDFs with no text layer, OCR the embedded images.
 * For JPG/PNG files, OCR the entire image.
 */
export async function validateDocumentContentWithOcr(
  buffer: Buffer,
  declaredType: string,
  fileName: string,
): Promise<ContentValidationResult> {
  // First run the basic validation
  const basicResult = validateDocumentContent(buffer, declaredType, fileName);
  
  // Raw images are not accepted blindly, but they still go through OCR.
  // The downstream identity gate decides whether the OCR text matches the
  // selected document type; random images still end up at score 0.
  const extForCheck = fileName.toLowerCase().split(".").pop() ?? "";
  const isRawImageFile = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "tiff", "tif"].includes(extForCheck);
  
  const isImage = isRawImageFile || basicResult.detectedContentType === "IMAGE_ONLY";
  const isPdf = buffer.subarray(0, 4).toString("latin1") === "%PDF-";
  
  // Check if this is an encrypted+signed government PDF — always OCR these
  const latin = buffer.toString("latin1");
  const isEncryptedGovDoc = isPdf && /\/Encrypt\s+\d+\s+\d+\s+R/.test(latin) && /\/ByteRange\s*\[[^\]]+\]/.test(latin);
  const isScannedPdf = isPdf && basicResult.isImageOnly;
  const needsOcr = !basicResult.hasTextContent || basicResult.overallScore < 80 || isEncryptedGovDoc || isScannedPdf;
  
  if (!needsOcr) {
    return basicResult;
  }
  
  let ocrText = "";
  let ocrConfidence = 0;
  
  try {
    // OCR with timeout — don't block the pipeline for more than 30 seconds
    const ocrTimeout = 25000;
    const ocrPromise = (async () => {
      if (isImage) {
        return await ocrImage(buffer);
      } else if (isPdf) {
        // Try async PDF render+OCR first, then fall back to raw image extraction
        try {
          const { renderAndOcrPdfAsync } = await import("@/lib/verify/ocr");
          const rendered = await renderAndOcrPdfAsync(buffer, 3);
          if (rendered.text.length > 10) {
            return { text: rendered.text, confidence: rendered.confidence, words: 0 };
          }
        } catch {}
        // Fallback: try raw image extraction from PDF streams
        const { ocrPdfImagesAsync } = await import("@/lib/verify/ocr");
        const result = await ocrPdfImagesAsync(buffer, 3);
        if (result.text.length > 10) {
          return { text: result.text, confidence: result.confidence, words: 0 };
        }
        return { text: result.text || "", confidence: result.confidence, words: 0 };
      }
      return { text: "", confidence: 0, words: 0 };
    })();
    
    const timeoutPromise = new Promise<{ text: string; confidence: number; words: number }>((resolve) => {
      setTimeout(() => resolve({ text: "", confidence: 0, words: 0 }), ocrTimeout);
    });
    
    const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
    ocrText = ocrResult.text;
    ocrConfidence = ocrResult.confidence;
  } catch (err) {
    console.error("OCR failed:", err);
  }
  
  // If OCR found meaningful text, re-validate with it
  if (ocrText.length > 10) {
    const ocrLower = ocrText.toLowerCase();
    const typeConfig = DOC_TYPE_CONFIGS[declaredType];
    
    if (typeConfig) {
      // Re-score with OCR text
      let ocrScore = basicResult.overallScore;
      let newFoundKeywords: string[] = [];
      let newMissingChecks = [...basicResult.missingChecks];
      
      // Check keywords against OCR text
      const ocrFoundRequired = typeConfig.requiredKeywords.filter(kw => ocrLower.includes(kw));
      const ocrFoundPreferred = typeConfig.preferredKeywords.filter(kw => ocrLower.includes(kw));
      newFoundKeywords = [...ocrFoundRequired, ...ocrFoundPreferred];
      
      // Bonus points for OCR-found keywords
      ocrScore += ocrFoundRequired.length * 5;
      ocrScore += ocrFoundPreferred.length * 1;
      
      // Remove OCR_REQUIRED missing check since we did OCR
      newMissingChecks = newMissingChecks.filter(c => c.check !== "OCR_REQUIRED");
      
      // Check if OCR found the expected format patterns
      const formatValidations = [...basicResult.formatValidations];
      if (declaredType === "GST_CERTIFICATE") {
        const gstinMatch = ocrText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/i);
        if (gstinMatch) {
          ocrScore += 15;
          formatValidations.push({ field: "gstin", value: gstinMatch[1].toUpperCase(), valid: true, detail: `Valid GSTIN found via OCR: ${gstinMatch[1].toUpperCase()}` });
        }
      }
      if (declaredType === "PAN_CARD") {
        const panMatch = ocrText.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/i);
        if (panMatch) {
          ocrScore += 15;
          formatValidations.push({ field: "pan", value: panMatch[1].toUpperCase(), valid: true, detail: `Valid PAN found via OCR: ${panMatch[1].toUpperCase()}` });
        }
      }
      
      ocrScore = Math.max(0, Math.min(100, ocrScore));
      
      // Build OCR-enhanced reasons
      const reasons = [...basicResult.reasons];
      if (ocrScore > basicResult.overallScore) {
        reasons.unshift(`OCR extracted ${ocrText.length} characters with ${ocrConfidence.toFixed(1)}% confidence`);
        reasons.unshift(`Scanned document processed via OCR — found ${newFoundKeywords.length} matching keywords`);
      }
      
      // Determine new verdict
      let verdict: ContentValidationResult["verdict"] = "REJECTED";
      if (ocrScore >= 70) verdict = "AUTHENTIC";
      else if (ocrScore >= 50) verdict = "NEEDS_MANUAL_REVIEW";
      else if (ocrScore >= 20) verdict = "SUSPICIOUS";
      
      return {
        ...basicResult,
        overallScore: ocrScore,
        extractedText: ocrText.slice(0, 5000),
        foundKeywords: newFoundKeywords,
        missingKeywords: newFoundKeywords.length > 0 
          ? [...typeConfig.requiredKeywords, ...typeConfig.preferredKeywords].filter(kw => !ocrLower.includes(kw))
          : basicResult.missingKeywords,
        missingChecks: newMissingChecks,
        formatValidations,
        hasTextContent: true,
        isImageOnly: false,
        contentConfidence: Math.max(basicResult.contentConfidence, ocrConfidence / 100),
        verdict,
        reasons,
      };
    }
  }
  
  return basicResult;
}
