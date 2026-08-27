/**
 * LAYER-BY-LAYER VERIFICATION PIPELINE
 * 
 * Orchestrates 16 verification layers, each producing structured evidence.
 * Layers run in dependency order — if an early layer fails critically,
 * later layers are marked BLOCKED (not FAILED).
 * 
 * The pipeline is document-type-aware: it uses the schema registry to
 * determine which layers are applicable and what rules to apply.
 */

import { getDocSchema, identifyDocumentType, evaluateDeclaredTypeIdentity, type DocumentTypeSchema, type DocSchemaRuleResult } from "./schemas";
import { analyzePdf, maxSignalSeverity } from "./pdfForensics";
import { detectPdfSignature } from "./signatures";
import { scanForQrCodes, compareQrWithFields } from "./qr";
import { validateExtractedIdentifiers } from "./identifiers";
import { extractSignatureInfo } from "./pdfDecrypt";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type LayerStatus = 
  | "NOT_STARTED"
  | "IN_PROGRESS" 
  | "PASSED"
  | "FAILED"
  | "WARNING"
  | "NOT_APPLICABLE"
  | "BLOCKED"
  | "SKIPPED"
  | "WAITING_FOR_USER";

export type PipelineDecision = "ACCEPTED" | "NEEDS_REVIEW" | "REJECTED" | "PASSWORD_REQUIRED" | "PROCESSING";

export interface VerificationLayer {
  id: string;
  name: string;
  description: string;
  status: LayerStatus;
  score: number;       // 0-100 for this layer
  maxScore: number;
  details: string[];
  evidence: Record<string, any>;
  durationMs: number;
  blockedReason?: string;
}

export interface PipelineResult {
  layers: VerificationLayer[];
  decision: PipelineDecision;
  overallScore: number;
  classificationConfidence: number;
  identifiedDocType: string | null;
  identifiedDocTypeConfidence: number;
  schemaUsed: string | null;
  textExtractionMode: "NATIVE_TEXT_ONLY" | "OCR_ONLY" | "NATIVE_TEXT_PLUS_OCR" | "NOT_ATTEMPTED" | "BLOCKED";
  passwordRequired: boolean;
  passwordIncorrect: boolean;
  processingTimeMs: number;
  reasonCodes: string[];
  humanMessage: string;
  actionMessage: string;
}

export interface PipelineInput {
  buffer: Buffer;
  fileName: string;
  declaredDocType: string;
  organizationId: string;
  organizationData?: {
    legalName?: string;
    tradeName?: string;
    pan?: string;
    gstin?: string;
    udyamNumber?: string;
    cin?: string;
    registeredAddress?: string;
  };
  pdfPassword?: string;
}

// ═══════════════════════════════════════════════════════════════
// LAYER DEFINITIONS
// ═══════════════════════════════════════════════════════════════

function createLayer(id: string, name: string, description: string): VerificationLayer {
  return { id, name, description, status: "NOT_STARTED", score: 0, maxScore: 100, details: [], evidence: {}, durationMs: 0 };
}

function blockLaterLayers(layers: VerificationLayer[], blockedAt: number, reason: string) {
  for (let i = blockedAt + 1; i < layers.length; i++) {
    if (layers[i].status === "NOT_STARTED") {
      layers[i].status = "BLOCKED";
      layers[i].blockedReason = reason;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════

export async function runVerificationPipeline(input: PipelineInput): Promise<PipelineResult> {
  const startTime = Date.now();
  const layers: VerificationLayer[] = [];
  const reasonCodes: string[] = [];
  let blocked = false;
  let blockReason = "";
  
  // Track extracted state across layers
  let extractedText = "";
  let isPdf = false;
  let isImage = false;
  let isEncrypted = false;
  let wasDecrypted = false;
  let processedBuffer = input.buffer;
  let textExtractionMode: PipelineResult["textExtractionMode"] = "NOT_ATTEMPTED";
  let classificationConfidence = 0;
  let identifiedType = input.declaredDocType;
  let identifiedDocTypeConfidence = 0;
  let schema: DocumentTypeSchema | undefined;
  const extractedFields: Record<string, string> = {};
  let hasDigitalSignature = false;
  let tamperSeverity = "NONE" as string;
  
  const ext = input.fileName.toLowerCase().split(".").pop() ?? "";
  isPdf = ext === "pdf" || input.buffer.subarray(0, 4).toString("latin1") === "%PDF-";
  isImage = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif"].includes(ext);
  
  // ─── LAYER 1: FILE VALIDATION ───
  const L1 = createLayer("FILE_VALIDATION", "Layer 1 — File Validation", "Checking file integrity, format, and safety");
  layers.push(L1);
  const l1Start = Date.now();
  L1.status = "IN_PROGRESS";
  
  if (input.buffer.length < 100) {
    L1.status = "FAILED";
    L1.score = 0;
    L1.details.push("File is too small to be a valid document");
    reasonCodes.push("FILE_TOO_SMALL");
    blocked = true;
    blockReason = "File is too small to process";
  } else if (input.buffer.length > 50 * 1024 * 1024) {
    L1.status = "FAILED";
    L1.score = 0;
    L1.details.push("File exceeds maximum size limit");
    reasonCodes.push("FILE_TOO_LARGE");
    blocked = true;
    blockReason = "File exceeds size limit";
  } else if (!isPdf && !isImage) {
    // Check if it's a valid file despite wrong extension
    const head = input.buffer.subarray(0, 8).toString("latin1");
    if (head.startsWith("%PDF")) {
      isPdf = true;
      L1.details.push("PDF detected despite file extension");
    } else if ([0x89, 0xFF, 0xD8, 0x50].includes(input.buffer[0])) {
      isImage = true;
      L1.details.push("Image detected despite file extension");
    } else {
      L1.status = "FAILED";
      L1.score = 0;
      L1.details.push("File is not a recognized document or image format");
      reasonCodes.push("UNSUPPORTED_FORMAT");
      blocked = true;
      blockReason = "Unsupported file format";
    }
  } else {
    L1.score = 100;
    L1.details.push(`Valid ${isPdf ? "PDF" : "image"} file (${(input.buffer.length / 1024).toFixed(1)} KB)`);
  }
  L1.status = blocked ? "FAILED" : "PASSED";
  L1.durationMs = Date.now() - l1Start;
  L1.evidence = { size: input.buffer.length, ext, isPdf, isImage };
  
  if (blocked) {
    blockLaterLayers(layers, 0, blockReason);
    return buildResult(layers, reasonCodes, startTime);
  }
  
  // ─── LAYER 2: FILE ACCESS / DECRYPTION ───
  const L2 = createLayer("FILE_ACCESS", "Layer 2 — File Access & Decryption", "Checking if document is accessible and decrypting if needed");
  layers.push(L2);
  const l2Start = Date.now();
  L2.status = "IN_PROGRESS";
  
  if (isPdf) {
    const latin = processedBuffer.toString("latin1");
    isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(latin) || !!input.pdfPassword;
    
    if (isEncrypted) {
      // Check for digital signature before decryption
      const sigInfo = extractSignatureInfo(processedBuffer);
      hasDigitalSignature = sigInfo.hasSignature;
      
      if (input.pdfPassword) {
        try {
          const { tryDecryptPdf } = await import("@/lib/verify/pdfDecrypt");
          const result = await tryDecryptPdf(processedBuffer, input.pdfPassword);
          if (result.wasEncrypted && result.decrypted.length > processedBuffer.length * 0.5) {
            processedBuffer = result.decrypted;
            wasDecrypted = true;
            L2.score = 100;
            L2.details.push("PDF decrypted successfully with provided password");
          } else {
            L2.status = "WAITING_FOR_USER";
            L2.score = 0;
            L2.details.push("PDF is password-protected and the provided password did not unlock usable content.");
            L2.evidence = { encrypted: true, passwordProvided: true, digitalSignature: hasDigitalSignature };
            L2.durationMs = Date.now() - l2Start;
            return {
              layers,
              decision: "PASSWORD_REQUIRED",
              overallScore: 0,
              classificationConfidence: 0,
              identifiedDocType: null,
              identifiedDocTypeConfidence: 0,
              schemaUsed: null,
              textExtractionMode: "BLOCKED",
              passwordRequired: true,
              passwordIncorrect: true,
              processingTimeMs: Date.now() - startTime,
              reasonCodes: ["PASSWORD_INCORRECT"],
              humanMessage: "The PDF password is incorrect. Enter the correct document password to continue verification.",
              actionMessage: "Enter Correct Password",
            };
          }
        } catch {
          L2.status = "WAITING_FOR_USER";
          L2.score = 0;
          L2.details.push("PDF decryption failed — password may be incorrect.");
          L2.evidence = { encrypted: true, passwordProvided: true, digitalSignature: hasDigitalSignature };
          L2.durationMs = Date.now() - l2Start;
          return {
            layers,
            decision: "PASSWORD_REQUIRED",
            overallScore: 0,
            classificationConfidence: 0,
            identifiedDocType: null,
            identifiedDocTypeConfidence: 0,
            schemaUsed: null,
            textExtractionMode: "BLOCKED",
            passwordRequired: true,
            passwordIncorrect: true,
            processingTimeMs: Date.now() - startTime,
            reasonCodes: ["PASSWORD_INCORRECT"],
            humanMessage: "The PDF password is incorrect. Enter the correct document password to continue verification.",
            actionMessage: "Enter Correct Password",
          };
        }
      } else {
        // Password not provided — document is encrypted
        L2.status = "WAITING_FOR_USER";
        L2.score = 0;
        L2.details.push("PDF is password-protected. Password is required before OCR and verification.");
        L2.evidence = { encrypted: true, passwordProvided: false, digitalSignature: hasDigitalSignature };
        L2.durationMs = Date.now() - l2Start;
        return {
          layers,
          decision: "PASSWORD_REQUIRED",
          overallScore: 0,
          classificationConfidence: 0,
          identifiedDocType: null,
          identifiedDocTypeConfidence: 0,
          schemaUsed: null,
          textExtractionMode: "BLOCKED",
          passwordRequired: true,
          passwordIncorrect: false,
          processingTimeMs: Date.now() - startTime,
          reasonCodes: ["PASSWORD_REQUIRED"],
          humanMessage: "This PDF is password-protected. Enter the document password to continue OCR and verification.",
          actionMessage: "Enter Password",
        };
      }
    } else {
      L2.score = 100;
      L2.details.push("PDF is not encrypted — full access available");
      // Still check for digital signature on non-encrypted PDFs
      const sigInfo = extractSignatureInfo(processedBuffer);
      hasDigitalSignature = sigInfo.hasSignature;
    }
  } else {
    L2.score = 100;
    L2.details.push(isImage ? "Image file — no encryption possible" : "Non-PDF file — access check passed");
  }
  L2.status = "PASSED";
  L2.durationMs = Date.now() - l2Start;
  L2.evidence = { encrypted: isEncrypted, decrypted: wasDecrypted, digitalSignature: hasDigitalSignature };
  
  // ─── LAYER 3: DOCUMENT INTEGRITY ───
  const L3 = createLayer("DOCUMENT_INTEGRITY", "Layer 3 — Document Integrity", "Analyzing PDF structure and document health");
  layers.push(L3);
  const l3Start = Date.now();
  L3.status = "IN_PROGRESS";
  
  if (isPdf) {
    const forensics = analyzePdf(processedBuffer);
    L3.evidence = {
      version: forensics.version,
      pageCount: forensics.pageCount,
      encrypted: forensics.encrypted,
      javascript: forensics.javascript,
      openAction: forensics.openAction,
      embeddedFiles: forensics.embeddedFiles,
      textLayerDetected: forensics.textLayerDetected,
      producer: forensics.producer,
      imageCount: forensics.imageCount,
      fontCount: forensics.fontCount,
      incrementalUpdates: forensics.incrementalUpdates,
    };
    
    if (forensics.pageCount === 0) {
      L3.status = "FAILED";
      L3.score = 0;
      L3.details.push("PDF has no pages — file may be corrupted");
      reasonCodes.push("CORRUPTED_PDF");
      blockLaterLayers(layers, 2, "PDF has no pages");
    } else {
      L3.score = 80;
      L3.details.push(`PDF v${forensics.version || "?"}, ${forensics.pageCount} page(s)`);
      if (forensics.textLayerDetected) {
        L3.score = 100;
        L3.details.push("Text layer detected");
      } else if (forensics.imageCount > 0) {
        L3.score = 70;
        L3.details.push(`No text layer — ${forensics.imageCount} image(s) detected (scanned PDF)`);
        textExtractionMode = "OCR_ONLY";
      }
      if (forensics.javascript) {
        L3.score = Math.max(L3.score - 5, 30);
        L3.details.push("⚠ JavaScript detected in PDF (may be normal for government forms)");
      }
      if (forensics.embeddedFiles) {
        L3.score = Math.max(L3.score - 10, 30);
        L3.details.push("⚠ Embedded files detected");
      }
      L3.status = "PASSED";
    }
  } else if (isImage) {
    L3.score = 80;
    L3.details.push("Image file — integrity check passed");
    L3.evidence = { isImage: true, size: processedBuffer.length };
    L3.status = "PASSED";
  } else {
    L3.score = 50;
    L3.details.push("Non-PDF, non-image file — limited integrity checks");
    L3.status = "PASSED";
  }
  L3.durationMs = Date.now() - l3Start;
  
  if (blocked) {
    return buildResult(layers, reasonCodes, startTime);
  }
  
  // ─── LAYER 4: TEXT EXTRACTION / OCR ───
  const L4 = createLayer("TEXT_EXTRACTION", "Layer 4 — Text Extraction & OCR", "Extracting text from document");
  layers.push(L4);
  const l4Start = Date.now();
  L4.status = "IN_PROGRESS";
  
  if (isPdf || isImage) {
    const { validateDocumentContentWithOcr } = await import("@/lib/verify/contentValidator");
    
    const contentResult = await validateDocumentContentWithOcr(processedBuffer, input.declaredDocType, input.fileName);
    // If no text extracted, try pdftoppm render + tesseract.js OCR as fallback
    if ((!contentResult.extractedText || contentResult.extractedText.length < 10) && isPdf) {
      try {
        const { renderAndOcrPdf } = await import("@/lib/verify/ocr");
        const rendered = await renderAndOcrPdf(processedBuffer, 3);
        if (rendered.text.length > 10) {
          contentResult.extractedText = rendered.text;
          contentResult.hasTextContent = true;
          (contentResult as any).contentConfidence = rendered.confidence / 100;
        }
      } catch {}
    }
    extractedText = (contentResult as any).extractedText || contentResult.extractedText || "";
    const hasText = (contentResult as any).hasTextContent || contentResult.hasTextContent;
    
    if (hasText && extractedText.length > 50) {
      textExtractionMode = isImage ? "OCR_ONLY" : "NATIVE_TEXT_ONLY";
      L4.score = 100;
      L4.details.push(`Extracted ${extractedText.length} characters via ${isImage ? "OCR" : "native text extraction"}`);
    } else if (extractedText.length > 50) {
      textExtractionMode = "OCR_ONLY";
      L4.score = 80;
      L4.details.push(`Extracted ${extractedText.length} characters via OCR`);
      if (contentResult.contentConfidence < 0.5) {
        L4.score = 60;
        L4.details.push("⚠ Low OCR confidence — document may be blurry or low quality");
        reasonCodes.push("LOW_OCR_CONFIDENCE");
      }
    } else {
      textExtractionMode = "NATIVE_TEXT_ONLY";
      L4.score = 20;
      L4.details.push("Could not extract meaningful text from document");
      reasonCodes.push("LOW_TEXT_CONTENT");
    }
    L4.status = "PASSED";
  } else {
    L4.score = 0;
    L4.details.push("Text extraction not applicable for this file type");
    L4.status = "NOT_APPLICABLE";
  }
  L4.durationMs = Date.now() - l4Start;
  L4.evidence = { textLength: extractedText.length, mode: textExtractionMode };
  
  // ═══════════════════════════════════════════════════════════
  // LAYER 5: STRICT DOCUMENT IDENTITY GATE ← CRITICAL HARD GATE
  // ═══════════════════════════════════════════════════════════
  // This is the MOST IMPORTANT layer.
  // It evaluates whether the uploaded content contains sufficient
  // evidence to be the SELECTED document type.
  // If this fails → score = 0, REJECTED, all downstream BLOCKED.
  // ═══════════════════════════════════════════════════════════
  const L5 = createLayer("IDENTITY_GATE", "Layer 5 — Document Identity Gate", "Evaluating whether content matches the selected document type");
  layers.push(L5);
  const l5Start = Date.now();
  L5.status = "IN_PROGRESS";
  
  // First: auto-identify what the document actually is (informational)
  const autoIdentification = identifyDocumentType(extractedText);
  if (autoIdentification) {
    identifiedType = autoIdentification.docType;
    identifiedDocTypeConfidence = autoIdentification.confidence;
    classificationConfidence = autoIdentification.confidence;
    schema = autoIdentification.schema;
  } else {
    // Fallback to declared type's schema for the gate
    schema = getDocSchema(input.declaredDocType) || undefined;
    identifiedType = input.declaredDocType;
    identifiedDocTypeConfidence = 0;
    classificationConfidence = 0;
  }
  
  // STRICT GATE: Evaluate DECLARED document type against content
  const identityResult = evaluateDeclaredTypeIdentity(extractedText, input.declaredDocType);
  
  const encryptedSignedGovBypass = false;
  
  L5.evidence = {
    declaredType: input.declaredDocType,
    autoIdentifiedType: identifiedType,
    autoConfidence: identifiedDocTypeConfidence,
    identityGate: identityResult.passed ? "PASSED" : "FAILED",
    identityScore: identityResult.score,
    identityThreshold: identityResult.evidence.identityThreshold,
    matchedConcepts: identityResult.evidence.matchedConcepts,
    identifierFound: identityResult.evidence.identifierFound,
    matchedIssuer: identityResult.evidence.matchedIssuer,
    fieldLabelsFound: identityResult.evidence.fieldLabelsFound,
    encryptedSignedGovBypass,
  };
  
  if (identityResult.passed) {
    // IDENTITY GATE: PASS
    L5.score = Math.min(100, identityResult.score);
    L5.details.push(`✓ Document identity established as ${schema?.label || input.declaredDocType}`);
    L5.details.push(`Identity score: ${identityResult.score}/100 (threshold: ${schema?.identityEvidence.identityThreshold || 40})`);
    if (identityResult.evidence.matchedConcepts.length > 0) {
      L5.details.push(`Core concepts found: ${identityResult.evidence.matchedConcepts.join(", ")}`);
    }
    if (identityResult.evidence.identifierFound) {
      L5.details.push(`✓ Identifier pattern found in document`);
    }
    if (identifiedDocTypeConfidence > 0 && identifiedType !== input.declaredDocType) {
      L5.details.push(`ℹ Auto-identified as "${identifiedType}" (${identifiedDocTypeConfidence}%) but declared type "${input.declaredDocType}" also matched`);
    }
    L5.status = "PASSED";
  } else {
    // ═══════════════════════════════════════════════════════
    // IDENTITY GATE: FAIL → SCORE 0, REJECT, BLOCK ALL
    // ═══════════════════════════════════════════════════════
    L5.score = 0;
    const declaredLabel = input.declaredDocType.replace(/_/g, " ");
    
    if (identityResult.reason === "WRONG_DOCUMENT_TYPE" && identifiedType) {
      const detectedLabel = identifiedType.replace(/_/g, " ");
      L5.details.push(`✗ Content does not match selected type "${declaredLabel}"`);
      L5.details.push(`✗ Document appears to be a ${detectedLabel}, not a ${declaredLabel}`);
      reasonCodes.push("WRONG_DOCUMENT_TYPE");
    } else if (identityResult.reason === "CORE_DOCUMENT_EVIDENCE_MISSING") {
      L5.details.push(`✗ No ${declaredLabel} evidence found in the uploaded content`);
      L5.details.push(`✗ Required core concepts/identifiers for ${declaredLabel} were not detected`);
      reasonCodes.push("CORE_DOCUMENT_EVIDENCE_MISSING");
    } else {
      L5.details.push(`✗ Insufficient evidence to establish document identity as ${declaredLabel}`);
      reasonCodes.push("DOCUMENT_TYPE_NOT_ESTABLISHED");
    }
    
    if (identityResult.evidence.matchedConcepts.length > 0) {
      L5.details.push(`  Found concepts: ${identityResult.evidence.matchedConcepts.join(", ")}`);
    }
    if (identifiedDocTypeConfidence > 0 && identifiedType !== input.declaredDocType) {
      L5.details.push(`  Detected type: ${identifiedType.replace(/_/g, " ")} (${identifiedDocTypeConfidence}%)`);
    }
    
    L5.status = "FAILED";
    blocked = true;
    blockReason = `Document identity could not be established as ${declaredLabel}`;
  }
  L5.durationMs = Date.now() - l5Start;
  
  // IF IDENTITY GATE FAILED → BLOCK ALL DOWNSTREAM LAYERS AND RETURN
  if (blocked) {
    blockLaterLayers(layers, 4, blockReason);
    return buildResult(layers, reasonCodes, startTime);
  }
  
  // ─── LAYER 6: FIELD EXTRACTION ───
  const L6 = createLayer("FIELD_EXTRACTION", "Layer 6 — Field Extraction", "Extracting document-specific fields and identifiers");
  layers.push(L6);
  const l6Start = Date.now();
  L6.status = "IN_PROGRESS";
  
  if (schema && extractedText.length > 20) {
    // Extract fields using regex patterns from schema
    const textLower = extractedText.toLowerCase();
    let fieldsFound = 0;
    const fieldsRequired = schema.requiredFields.length;
    
    for (const field of schema.extractableFields) {
      if (field.pattern) {
        const match = extractedText.match(field.pattern);
        if (match) {
          extractedFields[field.name] = match[1] || match[0];
          fieldsFound++;
          L6.details.push(`✓ ${field.label}: ${match[1] || match[0]}`);
        } else if (field.required) {
          L6.details.push(`✗ ${field.label}: Not found (required)`);
        }
      } else {
        // Try keyword-based extraction
        const fieldLower = field.label.toLowerCase();
        if (textLower.includes(fieldLower)) {
          fieldsFound++;
          L6.details.push(`✓ ${field.label}: Present in document`);
        } else if (field.required) {
          L6.details.push(`✗ ${field.label}: Not found (required)`);
        }
      }
    }
    
    // Fallback: use content validator's format validation results
    try {
      const { validateDocumentContent } = await import("@/lib/verify/contentValidator");
      const cvResult = validateDocumentContent(processedBuffer, input.declaredDocType, input.fileName);
      if (cvResult.formatValidations) {
        for (const fv of cvResult.formatValidations) {
          if (fv.valid && fv.field && fv.value && !extractedFields[fv.field]) {
            extractedFields[fv.field] = fv.value;
            fieldsFound++;
            L6.details.push(`✓ ${fv.field} (from content validation): ${fv.value}`);
          }
        }
      }
      if (!extractedText && cvResult.extractedText) {
        extractedText = cvResult.extractedText;
      }
    } catch {}
    
    // Also run identifier validators from existing module
    const validators = validateExtractedIdentifiers(extractedFields);
    for (const v of validators) {
      if (v.valid) {
        L6.details.push(`✓ ${v.field} validated: ${v.value}`);
      }
    }
    
    if (fieldsRequired > 0) {
      L6.score = Math.min(100, (fieldsFound / Math.max(fieldsRequired, 1)) * 100);
    } else {
      L6.score = fieldsFound > 0 ? 80 : 50;
    }
    L6.status = L6.score >= 50 ? "PASSED" : "WARNING";
  } else if (!schema) {
    L6.score = 50;
    L6.details.push("No schema available for this document type — using generic extraction");
    L6.status = "PASSED";
  } else if (isEncrypted && hasDigitalSignature) {
    // Encrypted+signed government PDF — fields may not be extractable but signature proves origin
    L6.score = 70;
    L6.details.push("Encrypted+signed government PDF — field extraction limited but signature confirms government origin");
    L6.status = "PASSED";
  } else {
    L6.score = 20;
    L6.details.push("Insufficient text for field extraction");
    L6.status = "WARNING";
    reasonCodes.push("INSUFFICIENT_TEXT_FOR_EXTRACTION");
  }
  L6.durationMs = Date.now() - l6Start;
  L6.evidence = { fieldsExtracted: Object.keys(extractedFields).length, extractedFields };
  
  // ─── LAYER 7: IDENTIFIER VALIDATION ───
  const L7 = createLayer("IDENTIFIER_VALIDATION", "Layer 7 — Identifier Validation", "Validating extracted identifiers (GSTIN checksum, PAN format, etc.)");
  layers.push(L7);
  const l7Start = Date.now();
  L7.status = "IN_PROGRESS";
  
  const validators = validateExtractedIdentifiers(extractedFields);
  let validCount = 0;
  const totalCount = validators.length;
  
  for (const v of validators) {
    if (v.valid) {
      validCount++;
      L7.details.push(`✓ ${v.field} (${v.value}): Valid — ${v.checks?.join(", ") || "passed"}`);
    } else {
      L7.details.push(`✗ ${v.field} (${v.value}): Invalid — ${v.errors?.join(", ") || "failed"}`);
      if (v.field === "gstin" || v.field === "pan") {
        reasonCodes.push(`INVALID_${v.field.toUpperCase()}`);
      }
    }
  }
  
  // Encrypted+signed government PDF — identifiers may be in images, signature confirms origin
  if (totalCount === 0 && isEncrypted && hasDigitalSignature) {
    L7.score = 65;
    L7.details.push("Encrypted+signed government PDF — identifiers in images, signature confirms origin");
  } else {
    L7.score = totalCount > 0 ? Math.min(100, (validCount / totalCount) * 100) : 50;
  }
  L7.status = L7.score >= 50 ? "PASSED" : "WARNING";
  L7.durationMs = Date.now() - l7Start;
  L7.evidence = { validators: validators.map(v => ({ field: v.field, valid: v.valid, confidence: v.confidence })) };
  
  // ─── LAYER 8: SCHEMA-SPECIFIC RULES ───
  const L8 = createLayer("SCHEMA_RULES", "Layer 8 — Document-Specific Validation", "Running document-type-specific validation rules");
  layers.push(L8);
  const l8Start = Date.now();
  L8.status = "IN_PROGRESS";
  
  if (schema && schema.validationRules.length > 0) {
    const ruleResults: DocSchemaRuleResult[] = [];
    for (const rule of schema.validationRules) {
      const result = rule.check(extractedText, extractedFields, L3.evidence);
      ruleResults.push(result);
      if (result.passed) {
        L8.details.push(`✓ ${rule.name}: ${result.detail}`);
      } else {
        L8.details.push(`✗ ${rule.name} [${rule.severity}]: ${result.detail}`);
        if (rule.severity === "CRITICAL") {
          reasonCodes.push(`RULE_FAILED_${rule.name.toUpperCase()}`);
        }
      }
    }
    
    const passedRules = ruleResults.filter(r => r.passed).length;
    L8.score = Math.min(100, (passedRules / Math.max(ruleResults.length, 1)) * 100);
    L8.status = L8.score >= 50 ? "PASSED" : "WARNING";
  } else if (schema) {
    L8.score = 70;
    L8.details.push("No schema-specific rules defined for this document type");
    L8.status = "PASSED";
  } else {
    L8.score = 50;
    L8.details.push("No schema available — skipping document-specific rules");
    L8.status = "NOT_APPLICABLE";
  }
  L8.durationMs = Date.now() - l8Start;
  
  // ─── LAYER 9: QR/BARCODE ANALYSIS ───
  const L9 = createLayer("QR_BARCODE", "Layer 9 — QR/Barcode Analysis", "Detecting and analyzing QR codes and barcodes");
  layers.push(L9);
  const l9Start = Date.now();
  L9.status = "IN_PROGRESS";
  
  if (isPdf || isImage) {
    const qrFindings = scanForQrCodes(input.fileName, processedBuffer);
    
    if (qrFindings.length > 0) {
      L9.details.push(`Found ${qrFindings.length} QR/barcode candidate(s), ${qrFindings.filter(f => f.found).length} decoded`);
      for (const f of qrFindings) {
        if (f.found && f.payload) {
          L9.details.push(`QR payload: ${f.payload.slice(0, 100)}...`);
        }
      }
      
      // Check QR consistency with extracted fields
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(extractedFields)) {
        fields[k] = v;
      }
      const consistency = compareQrWithFields(qrFindings, fields);
      if (consistency.status === "CONSISTENT") {
        L9.score = 100;
        L9.details.push("✓ QR data consistent with document fields");
      } else if (consistency.status === "CONFLICT") {
        L9.score = 30;
        L9.details.push("⚠ QR data conflicts with document fields");
        reasonCodes.push("QR_MISMATCH");
      } else {
        L9.score = 70;
        L9.details.push("QR consistency: inconclusive");
      }
      L9.evidence = { consistency: consistency.status, findings: qrFindings.length };
    } else {
      // No QR found
      if (schema?.supportingSignals.some(s => s.type === "qr" && s.expected)) {
        L9.score = 50;
        L9.details.push("No QR code found (may be expected for this document type/version)");
      } else {
        L9.score = 80;
        L9.details.push("No QR code found (not expected for this document type)");
      }
      L9.evidence = { found: false, expected: schema?.supportingSignals.some(s => s.type === "qr" && s.expected) ?? false };
    }
    L9.status = "PASSED";
  } else {
    L9.score = 0;
    L9.details.push("QR/Barcode analysis not applicable for this file type");
    L9.status = "NOT_APPLICABLE";
  }
  L9.durationMs = Date.now() - l9Start;
  
  // ─── LAYER 10: DIGITAL SIGNATURE ANALYSIS ───
  const L10 = createLayer("DIGITAL_SIGNATURE", "Layer 10 — Digital Signature Analysis", "Analyzing digital signatures and certificates");
  layers.push(L10);
  const l10Start = Date.now();
  L10.status = "IN_PROGRESS";
  
  if (isPdf) {
    const sigResult = await detectPdfSignature(processedBuffer);
    L10.evidence = { status: sigResult.status, signerName: sigResult.signerName, limitation: sigResult.limitation };
    
    if (sigResult.status === "SIGNATURE_DETECTED") {
      hasDigitalSignature = true;
      L10.score = 90;
      L10.details.push(`✓ Digital signature detected: ${sigResult.signerName || "Unknown signer"}`);
      if (sigResult.signingTime) L10.details.push(`Signing time: ${sigResult.signingTime}`);
    } else {
      if (isEncrypted && hasDigitalSignature) {
        // Encrypted+signed — signature was detected earlier in Layer 2
        L10.score = 90;
        L10.details.push("✓ Digital signature confirmed (detected in encrypted PDF)");
      } else if (schema?.supportingSignals.some(s => s.type === "signature" && s.expected)) {
        L10.score = 40;
        L10.details.push("No digital signature found (may be expected for this document type)");
      } else {
        L10.score = 70;
        L10.details.push("No digital signature found (not required for this document type)");
      }
    }
    L10.status = "PASSED";
  } else {
    L10.score = 0;
    L10.details.push("Digital signature analysis not applicable for non-PDF files");
    L10.status = "NOT_APPLICABLE";
  }
  L10.durationMs = Date.now() - l10Start;
  
  // ─── LAYER 11: TAMPER/FORENSIC ANALYSIS ───
  const L11 = createLayer("FORENSICS", "Layer 11 — Tamper & Forensic Analysis", "Analyzing document for tampering indicators");
  layers.push(L11);
  const l11Start = Date.now();
  L11.status = "IN_PROGRESS";
  
  if (isPdf) {
    const forensics = analyzePdf(processedBuffer);
    const signals = forensics.signals;
    tamperSeverity = maxSignalSeverity(signals);
    
    L11.evidence = { signals: signals.map(s => ({ code: s.code, severity: s.severity })), tamperSeverity };
    
    const highSignals = signals.filter(s => s.severity === "HIGH");
    const medSignals = signals.filter(s => s.severity === "MEDIUM");
    
    if (tamperSeverity === "HIGH") {
      // Government docs with JS are common — don't auto-reject
      const nonGovHigh = highSignals.filter(s => s.code !== "PDF_JAVASCRIPT" && s.code !== "MODIFIED_AFTER_CREATION");
      if (nonGovHigh.length > 0) {
        L11.score = 30;
        L11.details.push(`⚠ ${nonGovHigh.length} high-severity forensic signal(s) detected`);
        for (const s of nonGovHigh) L11.details.push(`  - ${s.detail}`);
        reasonCodes.push("FORENSIC_WARNING");
      } else {
        L11.score = 70;
        L11.details.push("Forensic signals detected but consistent with government-issued documents");
      }
    } else if (tamperSeverity === "MEDIUM") {
      L11.score = 60;
      L11.details.push(`⚠ ${medSignals.length} medium-severity signal(s) detected`);
    } else {
      L11.score = 100;
      L11.details.push("✓ No significant forensic indicators detected");
    }
    L11.status = "PASSED";
  } else if (isImage) {
    L11.score = 60;
    L11.details.push("Image file — limited forensic analysis available");
    L11.status = "PASSED";
  } else {
    L11.score = 0;
    L11.details.push("Forensic analysis not applicable for this file type");
    L11.status = "NOT_APPLICABLE";
  }
  L11.durationMs = Date.now() - l11Start;
  
  // ─── LAYER 12: INTERNAL CONSISTENCY ───
  const L12 = createLayer("INTERNAL_CONSISTENCY", "Layer 12 — Internal Consistency", "Checking field consistency within the document");
  layers.push(L12);
  const l12Start = Date.now();
  L12.status = "IN_PROGRESS";
  
  {
    let consistencyScore = 100;
    // Check if PAN embedded in GSTIN matches
    if (extractedFields.gstin && extractedFields.pan) {
      const embeddedPan = extractedFields.gstin.slice(2, 12);
      if (embeddedPan !== extractedFields.pan) {
        consistencyScore -= 30;
        L12.details.push(`⚠ GSTIN embedded PAN (${embeddedPan}) differs from PAN field (${extractedFields.pan})`);
        reasonCodes.push("INTERNAL_MISMATCH");
      } else {
        L12.details.push("✓ GSTIN embedded PAN matches PAN field");
      }
    }
    // Check if organization name matches
    if (input.organizationData) {
      if (extractedFields.holder_name || extractedFields.enterprise_name || extractedFields.company_name) {
        const docName = (extractedFields.holder_name || extractedFields.enterprise_name || extractedFields.company_name || "").toLowerCase();
        const orgName = (input.organizationData.legalName || "").toLowerCase();
        if (orgName && docName && !orgName.includes(docName) && !docName.includes(orgName)) {
          consistencyScore -= 20;
          L12.details.push(`⚠ Document organization ("${docName}") differs from vault org ("${orgName}")`);
        } else if (orgName && docName) {
          L12.details.push("✓ Document organization matches vault organization");
        }
      }
    }
    
    L12.score = Math.max(0, consistencyScore);
    L12.status = L12.score >= 70 ? "PASSED" : "WARNING";
    if (L12.details.length === 0) L12.details.push("No consistency issues detected");
  }
  L12.durationMs = Date.now() - l12Start;
  
  // ─── LAYER 13: CONTENT TYPE MATCH (vs declared) ───
  const L13 = createLayer("TYPE_MATCH", "Layer 13 — Declared Type Match", "Additional type consistency check");
  layers.push(L13);
  const l13Start = Date.now();
  L13.status = "IN_PROGRESS";
  
  // Identity gate already passed in Layer 5, so this is informational
  // Check for forbidden keywords that might indicate tampering
  if (schema) {
    const lower = extractedText.toLowerCase();
    const forbiddenFound = schema.forbiddenKeywords.filter(kw => lower.includes(kw));
    
    if (forbiddenFound.length > 0) {
      L13.score = 40;
      L13.details.push(`⚠ Document contains keywords from other document types: ${forbiddenFound.join(", ")}`);
      L13.details.push("  (Identity gate passed, but cross-type keywords detected — flagged for review)");
      reasonCodes.push("CROSS_TYPE_KEYWORDS");
    } else {
      L13.score = 100;
      L13.details.push("✓ No conflicting document type keywords detected");
    }
  } else {
    L13.score = 80;
    L13.details.push("No schema available for keyword cross-check");
  }
  L13.status = "PASSED";
  L13.durationMs = Date.now() - l13Start;
  
  // ─── LAYER 14: CROSS-DOCUMENT CONSISTENCY ───
  const L14 = createLayer("CROSS_DOC", "Layer 14 — Cross-Document Consistency", "Checking consistency with other vault documents");
  layers.push(L14);
  const l14Start = Date.now();
  L14.status = "IN_PROGRESS";
  
  {
    let consistencyScore = 100;
    try {
      // Import prisma lazily to avoid circular deps
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      
      // Get other documents in the same organization
      const otherDocs = await prisma.documentVault.findMany({
        where: { 
          organizationId: input.organizationId,
          isActive: true,
          id: { not: "" } // exclude self (we don't have the ID here, but we can filter by doc type)
        },
        select: { docType: true, pan: true, gstin: true, issuingOrg: true, documentNumber: true },
        take: 50,
      });
      
      await prisma.$disconnect();
      
      if (otherDocs.length > 0) {
        // Check PAN consistency across documents
        const pans = otherDocs.filter(d => d.pan).map(d => d.pan!.toUpperCase());
        if (extractedFields.pan) {
          const myPan = extractedFields.pan.toUpperCase();
          const matchingPans = pans.filter(p => p === myPan);
          if (pans.length > 0 && matchingPans.length === 0) {
            consistencyScore -= 25;
            L14.details.push(`⚠ PAN ${myPan} not found in ${pans.length} other vault document(s)`);
            reasonCodes.push("CROSS_DOC_PAN_MISMATCH");
          } else if (matchingPans.length > 0) {
            L14.details.push(`✓ PAN matches ${matchingPans.length} other vault document(s)`);
          }
        }
        
        // Check GSTIN-PAN consistency
        if (extractedFields.gstin && extractedFields.pan) {
          const embeddedPan = extractedFields.gstin.slice(2, 12).toUpperCase();
          if (embeddedPan !== extractedFields.pan.toUpperCase()) {
            consistencyScore -= 20;
            L14.details.push(`⚠ GSTIN embedded PAN (${embeddedPan}) differs from document PAN (${extractedFields.pan})`);
          }
        }
        
        // Check organization name consistency
        if (input.organizationData?.legalName) {
          // No conflict — just informational
          L14.details.push(`Checked against ${otherDocs.length} other vault document(s)`);
        }
      } else {
        L14.details.push("No other documents in vault to compare against");
      }
    } catch {
      L14.details.push("Cross-document check skipped (error)");
    }
    
    L14.score = Math.max(0, consistencyScore);
    L14.status = L14.score >= 70 ? "PASSED" : "WARNING";
  }
  L14.durationMs = Date.now() - l14Start;
  
  // ─── LAYER 15: RISK SCORING ───
  const L15 = createLayer("RISK_SCORING", "Layer 15 — Risk & Confidence Scoring", "Calculating weighted risk score");
  layers.push(L15);
  const l15Start = Date.now();
  L15.status = "IN_PROGRESS";
  
  {
    const w = schema?.weights || { classification: 30, structure: 10, extraction: 10, identifiers: 15, qrBarcode: 10, signature: 5, forensics: 10, consistency: 10 };
    const totalWeight = w.classification + w.structure + w.extraction + w.identifiers + w.qrBarcode + w.signature + w.forensics + w.consistency;
    
    const overallScore = Math.round(
      (L5.score * w.classification +
       L3.score * w.structure +
       L6.score * w.extraction +
       L7.score * w.identifiers +
       L9.score * w.qrBarcode +
       L10.score * w.signature +
       L11.score * w.forensics +
       L12.score * w.consistency) / totalWeight
    );
    
    L15.score = Math.max(0, Math.min(100, overallScore));
    L15.details.push(`Weighted score: ${L15.score}/100`);
    L15.evidence = { weights: w, totalWeight };
    L15.status = "PASSED";
  }
  L15.durationMs = Date.now() - l15Start;
  
  // ─── LAYER 16: FINAL DECISION ───
  const L16 = createLayer("FINAL_DECISION", "Layer 16 — Final Decision", "Making accept/reject/review decision");
  layers.push(L16);
  const l16Start = Date.now();
  L16.status = "IN_PROGRESS";
  
  const score = L15.score;
  let decision: PipelineDecision;
  let humanMessage = "";
  let actionMessage = "";
  
  // Hard reject rules
  if (reasonCodes.includes("FILE_TOO_SMALL") || reasonCodes.includes("FILE_TOO_LARGE") || reasonCodes.includes("UNSUPPORTED_FORMAT")) {
    decision = "REJECTED";
    humanMessage = "The uploaded file could not be safely processed.";
    actionMessage = "Upload a valid document file";
  } else if (reasonCodes.includes("CORRUPTED_PDF")) {
    decision = "REJECTED";
    humanMessage = "The uploaded PDF could not be read. Please upload the original PDF again.";
    actionMessage = "Upload Again";
  } else if (reasonCodes.includes("WRONG_DOCUMENT_TYPE") && identifiedDocTypeConfidence > 60) {
    decision = "REJECTED";
    humanMessage = `The uploaded document appears to be a ${identifiedType?.replace(/_/g, " ")} but you declared it as ${input.declaredDocType.replace(/_/g, " ")}.`;
    actionMessage = "Upload Correct Document";
  } else if (reasonCodes.includes("RAW_IMAGE_AS_DOCUMENT")) {
    decision = "REJECTED";
    humanMessage = "Raw image files cannot be verified as government documents. Please upload the original PDF.";
    actionMessage = "Upload Original PDF";
  } else if (score >= 70) {
    decision = "ACCEPTED";
    humanMessage = "Document passed all applicable verification checks.";
    actionMessage = "";
  } else if (score >= 40) {
    decision = "NEEDS_REVIEW";
    humanMessage = "Document requires additional review. Some verification checks produced uncertain results.";
    actionMessage = "Officer will review this document";
  } else {
    decision = "REJECTED";
    humanMessage = "Document could not be validated. Required document information could not be reliably detected.";
    actionMessage = "Upload a clearer scan or original PDF";
  }
  
  L16.score = score;
  L16.details.push(`Decision: ${decision} (Score: ${score}/100)`);
  L16.status = "PASSED";
  L16.durationMs = Date.now() - l16Start;
  
  return {
    layers,
    decision,
    overallScore: score,
    classificationConfidence,
    identifiedDocType: identifiedType,
    identifiedDocTypeConfidence,
    schemaUsed: schema?.docType || null,
    textExtractionMode,
    passwordRequired: false,
    passwordIncorrect: false,
    processingTimeMs: Date.now() - startTime,
    reasonCodes,
    humanMessage,
    actionMessage,
  };
}

function buildResult(layers: VerificationLayer[], reasonCodes: string[], startTime: number): PipelineResult {
  return {
    layers,
    decision: "REJECTED",
    overallScore: 0,
    classificationConfidence: 0,
    identifiedDocType: null,
    identifiedDocTypeConfidence: 0,
    schemaUsed: null,
    textExtractionMode: "BLOCKED",
    passwordRequired: false,
    passwordIncorrect: false,
    processingTimeMs: Date.now() - startTime,
    reasonCodes,
    humanMessage: "Document could not be processed due to a critical error in an early verification layer.",
    actionMessage: "Upload a different file",
  };
}
