import zlib from "zlib";

/**
 * PDF structural forensics — byte-level, dependency-free.
 *
 * Produces TAMPER SIGNALS, not verdicts. Per policy:
 *   "Potential alteration indicators detected. Procurement Officer review required."
 * Signals are review-prioritization evidence only and are never treated as proof of fraud.
 */

export type ForensicSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH";

export interface ForensicSignal {
  code: string;
  severity: Exclude<ForensicSeverity, "NONE">;
  detail: string;
}

export interface PdfForensics {
  isPdf: boolean;
  version?: string;
  pageCount?: number;
  encrypted: boolean;
  incrementalUpdates: number;   // extra %%EOF markers
  javascript: boolean;
  openAction: boolean;
  launchAction: boolean;
  embeddedFiles: boolean;
  acroForm: boolean;
  imageCount: number;
  fontCount: number;
  textLayerDetected: boolean;
  producer?: string;
  creator?: string;
  creationDate?: string;
  modDate?: string;
  signedDetection?: boolean;
  orphanObjectCount: number;
  shadowAttackRisk: boolean;
  fontNames: string[];
  objectNumberGaps: boolean;
  streamLengthMismatches: number;
  signals: ForensicSignal[];
  analyzedAt: string;
}

const SEVERITY_RANK: Record<ForensicSeverity, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

function matchCount(hay: string, needle: RegExp): number {
  const m = hay.match(needle);
  return m ? m.length : 0;
}

function extractDictValue(s: string, key: string): string | undefined {
  // /Key (literal) or /Key /Name — first occurrence
  const lit = new RegExp(`/${key}\\s*\\(([^)]{0,300})\\)`).exec(s);
  if (lit) return lit[1].trim();
  const name = new RegExp(`/${key}\\s*\\/([A-Za-z0-9+#\\-\\.]{1,120})`).exec(s);
  if (name) return name[1];
  return undefined;
}

/** Inflate a bounded sample of streams to check for real text operators. */
function detectTextLayer(buf: Buffer): boolean {
  const latin = buf.toString("latin1");
  let idx = 0;
  for (let i = 0; i < 24 && idx !== -1; i++) {
    idx = latin.indexOf("stream", idx + 6);
    if (idx === -1) break;
    const start = latin.indexOf("\n", idx);
    if (start === -1) break;
    const end = latin.indexOf("endstream", start);
    if (end === -1) break;
    const slice = buf.subarray(start + 1, Math.min(end, start + 400_000));
    try {
      const inflated = zlib.inflateSync(slice).toString("latin1");
      if (/BT[\s\S]{0,2000}?(Tj|TJ)/.test(inflated)) return true;
    } catch {
      /* not flate or truncated — ignore */
    }
  }
  return false;
}

export function analyzePdf(buf: Buffer): PdfForensics {
  const head = buf.subarray(0, 1024).toString("latin1");
  const isPdf = head.startsWith("%PDF-");
  const analyzedAt = new Date().toISOString();

  if (!isPdf) {
    return {
      isPdf: false, encrypted: false, incrementalUpdates: 0, javascript: false,
      openAction: false, launchAction: false, embeddedFiles: false, acroForm: false,
      imageCount: 0, fontCount: 0, textLayerDetected: false,
      orphanObjectCount: 0, shadowAttackRisk: false, fontNames: [], objectNumberGaps: false, streamLengthMismatches: 0,
      signals: [], analyzedAt,
    };
  }

  const version = /^%PDF-(\d\.\d)/.exec(head)?.[1];
  const latin = buf.toString("latin1");

  const eofCount = matchCount(latin, /%%EOF/g);
  const incrementalUpdates = Math.max(0, eofCount - 1);

  const encrypted = /\/Encrypt\b/.test(latin);
  const javascript = /\/JavaScript\b|\/JS\b(?![a-z])/.test(latin);
  const openAction = /\/OpenAction\b/.test(latin);
  const launchAction = /\/Launch\b/.test(latin);
  const embeddedFiles = /\/EmbeddedFile\b/.test(latin);
  const acroForm = /\/AcroForm\b/.test(latin);

  const imageCount = matchCount(latin, /\/Subtype\s*\/Image/g);
  const fontCount = matchCount(latin, /\/Type\s*\/Font\b/g);

  // Page count from the largest /Pages /Count, fallback: count of /Type /Page objects
  let pageCount: number | undefined;
  const counts = [...latin.matchAll(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/g)].map((m) => parseInt(m[1], 10));
  if (counts.length) pageCount = Math.max(...counts);
  else {
    const pageObjs = matchCount(latin, /\/Type\s*\/Page\b(?!s)/g);
    if (pageObjs > 0) pageCount = pageObjs;
  }

  const producer = extractDictValue(latin, "Producer") ?? /<xmp:CreatorTool>([^<]{0,200})<\/xmp:CreatorTool>/.exec(latin)?.[1];
  const creator = extractDictValue(latin, "Creator");
  const creationDate = extractDictValue(latin, "CreationDate");
  const modDate = extractDictValue(latin, "ModDate");

  const textLayerDetected = detectTextLayer(buf);
  const signedDetection = /\/ByteRange\s*\[[^\]]+\]/.test(latin) && /\/Sig\b|\/SigField\b|adbe\.pkcs7/.test(latin);

  const definedObjNums = new Set<number>();
  for (const m of latin.matchAll(/^(\d+)\s+\d+\s+obj\b/gm)) {
    definedObjNums.add(parseInt(m[1], 10));
  }

  const referencedObjNums = new Set<number>();
  for (const m of latin.matchAll(/\b(\d+)\s+\d+\s+R\b/g)) {
    referencedObjNums.add(parseInt(m[1], 10));
  }

  let orphanObjectCount = 0;
  for (const n of definedObjNums) {
    if (!referencedObjNums.has(n)) orphanObjectCount++;
  }

  let shadowAttackRisk = false;
  const pageObjRegex = /(\d+)\s+\d+\s+obj[^>]*?\/Type\s*\/Page\b(?!s)[\s\S]*?endstream\s*endobj/gi;
  let sm: RegExpExecArray | null;
  while ((sm = pageObjRegex.exec(latin)) !== null) {
    const block = sm[0];
    const contentsMatches = block.match(/\/Contents\s*\[[\s\S]*?\]/g);
    if (contentsMatches && contentsMatches.length > 0) {
      for (const cm of contentsMatches) {
        const refCount = (cm.match(/\d+\s+\d+\s+R/g) || []).length;
        if (refCount > 1) {
          shadowAttackRisk = true;
          break;
        }
      }
    }
    if (shadowAttackRisk) break;
  }

  const hasTraditionalXref = /(?:^|\n)\s*xref\s*\n/.test(latin);
  const hasXrefStream = /\/Type\s*\/XRef\b/.test(latin);
  const hybridXref = hasTraditionalXref && hasXrefStream;

  const rawFontNames = [...latin.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+#\-\.]+)/g)].map((m) => m[1]);
  const fontNames = [...new Set(rawFontNames)];

  let metadataDateInconsistent = false;
  if (creationDate && modDate) {
    try {
      const parseDate = (d: string): Date | null => {
        const cleaned = d.replace(/^D:/, "");
        const m = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(cleaned);
        if (!m) return null;
        return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
      };
      const created = parseDate(creationDate);
      const modified = parseDate(modDate);
      if (created && modified && modified.getTime() < created.getTime()) {
        metadataDateInconsistent = true;
      }
    } catch {
      /* date parse failure — skip */
    }
  }

  let streamLengthMismatches = 0;
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let srm: RegExpExecArray | null;
  while ((srm = streamRegex.exec(latin)) !== null) {
    const matchStart = srm.index;
    const preceding = latin.substring(Math.max(0, matchStart - 600), matchStart);
    const lenMatch = /\/Length\s+(\d+)/.exec(preceding);
    if (!lenMatch) continue;
    const declaredLen = parseInt(lenMatch[1], 10);
    const rawStream = srm[1];
    const actualLen = Buffer.from(rawStream, "latin1").length;
    if (declaredLen > 0 && actualLen > 0) {
      const diff = Math.abs(declaredLen - actualLen);
      const ratio = diff / Math.max(declaredLen, actualLen);
      if (ratio > 0.5) streamLengthMismatches++;
    }
  }

  const objNumsSorted = [...definedObjNums].sort((a, b) => a - b);
  let objectNumberGaps = false;
  for (let i = 1; i < objNumsSorted.length; i++) {
    if (objNumsSorted[i] - objNumsSorted[i - 1] > 50) {
      objectNumberGaps = true;
      break;
    }
  }

  // ── Signals ──
  const signals: ForensicSignal[] = [];
  if (javascript)
    signals.push({ code: "PDF_JAVASCRIPT", severity: "HIGH", detail: "Embedded JavaScript action detected in PDF structure." });
  if (launchAction)
    signals.push({ code: "PDF_LAUNCH_ACTION", severity: "HIGH", detail: "Launch action detected — document attempts to open an external resource." });
  if (openAction && !acroForm)
    signals.push({ code: "PDF_OPENACTION", severity: "MEDIUM", detail: "OpenAction present without AcroForm context — review auto-executed behaviour." });
  if (embeddedFiles)
    signals.push({ code: "PDF_EMBEDDED_FILES", severity: "MEDIUM", detail: "Attached/embedded files detected inside the PDF container." });
  if (incrementalUpdates >= 2)
    signals.push({ code: "PDF_INCREMENTAL_UPDATES", severity: incrementalUpdates >= 4 ? "HIGH" : "MEDIUM", detail: `${incrementalUpdates} incremental update(s) detected — the file was saved/modified after initial creation. Common with signature flows, but also consistent with post-creation edits.` });
  if (!textLayerDetected && imageCount > 0)
    signals.push({ code: "SCAN_IMAGE_ONLY", severity: "LOW", detail: "No digital text layer found while raster images are present — likely a scan. OCR-based extraction only; visual tampering cannot be ruled out by this system." });
  if (encrypted)
    signals.push({ code: "PDF_ENCRYPTED", severity: "LOW", detail: "Document is encrypted; deep content analysis was limited." });
  if (!producer && !creator)
    signals.push({ code: "METADATA_ABSENT", severity: "LOW", detail: "Producer/Creator metadata absent." });
  if (creationDate && modDate && creationDate.slice(0, 8) !== modDate.slice(0, 8))
    signals.push({ code: "MODIFIED_AFTER_CREATION", severity: "LOW", detail: `Modification date differs from creation date (${modDate} vs ${creationDate}).` });
  if (orphanObjectCount > 10)
    signals.push({ code: "ORPHAN_OBJECTS", severity: "MEDIUM", detail: `${orphanObjectCount} orphan object(s) found — objects defined but never referenced in the cross-reference table.` });
  if (shadowAttackRisk)
    signals.push({ code: "SHADOW_ATTACK_RISK", severity: "HIGH", detail: "Multiple content streams detected on a single page — potential shadow attack vector for hidden content." });
  if (hybridXref)
    signals.push({ code: "HYBRID_XREF", severity: "LOW", detail: "Hybrid cross-reference format detected (both traditional table and cross-reference stream)." });
  if (fontNames.length > 5)
    signals.push({ code: "FONT_COUNT_HIGH", severity: "LOW", detail: `${fontNames.length} unique font name(s) found — unusual for a government/procurement document.` });
  if (metadataDateInconsistent)
    signals.push({ code: "METADATA_DATE_INCONSISTENT", severity: "MEDIUM", detail: "Modification date precedes creation date — indicates metadata tampering or clock skew." });
  if (streamLengthMismatches > 0)
    signals.push({ code: "STREAM_LENGTH_MISMATCH", severity: "LOW", detail: `${streamLengthMismatches} stream(s) with declared /Length differing from actual content by >50%.` });
  if (objectNumberGaps)
    signals.push({ code: "OBJECT_NUMBER_GAPS", severity: "LOW", detail: "Large gaps detected in PDF object numbering — possible post-creation object insertion." });

  // ── Government font analysis ──
  const govtFonts = ["Dingbats", "NotoSans", "NotoSerif", "Lohit", "Mangal", "Aparajita", "Latha", "Vrinda", "Kalapi", "Shruti", "Raavi", "Utkal", "LilyUPC", "ancode", "FreeSans", "FreeSerif", "FreeMono", "Norasi", "Kinnari", "Sawasdee", "Garuda", "Tlwg", "Norasi"];
  const knownStandard = ["TimesNewRoman", "Times-Roman", "Helvetica", "Arial", "Courier", "CourierNew", "Calibri", "Cambria", "Verdana", "Georgia", "Tahoma", "Segoe"];
  const unrecognizedFonts = fontNames.filter(f => {
    const lower = f.toLowerCase();
    return !govtFonts.some(gf => lower.includes(gf.toLowerCase())) && !knownStandard.some(ks => lower.includes(ks.toLowerCase()));
  });
  if (unrecognizedFonts.length > 2) {
    signals.push({ code: "FONT_UNUSUAL", severity: "MEDIUM", detail: `${unrecognizedFonts.length} unusual font(s) detected: ${unrecognizedFonts.slice(0, 5).join(", ")} — government documents typically use standard fonts.` });
  }

  // ── Content stream redundancy check (potential hidden content) ──
  let contentStreamCount = 0;
  const csRegex = /\/Type\s*\/Page\b/g;
  let csMatch;
  while ((csMatch = csRegex.exec(latin)) !== null) contentStreamCount++;
  // Count actual stream objects in page content
  const pageStreamCount = (latin.match(/\/Contents\s+\d+\s+\d+\s+R/g) || []).length;
  if (pageStreamCount > contentStreamCount * 2 && contentStreamCount > 0) {
    signals.push({ code: "EXCESS_CONTENT_STREAMS", severity: "MEDIUM", detail: `Multiple content streams per page detected (${pageStreamCount} streams for ${contentStreamCount} pages) — may indicate hidden or overlay content.` });
  }

  // ── Duplicate text layer detection ──
  if (textLayerDetected && pageCount) {
    const btCount = (latin.match(/\bBT\b/g) || []).length;
    const streamWithBtCount = (latin.match(/stream\r?\n[\s\S]*?\bBT\b[\s\S]*?endstream/g) || []).length;
    if (streamWithBtCount > pageCount * 2) {
      signals.push({ code: "DUPLICATE_TEXT_LAYERS", severity: "MEDIUM", detail: `${streamWithBtCount} text streams found for ${pageCount} pages — possible duplicate/hidden text layers.` });
    }
  }

  return {
    isPdf: true, version, pageCount, encrypted, incrementalUpdates, javascript,
    openAction, launchAction, embeddedFiles, acroForm, imageCount, fontCount,
    textLayerDetected, producer, creator, creationDate, modDate, signedDetection,
    orphanObjectCount, shadowAttackRisk, fontNames, objectNumberGaps, streamLengthMismatches,
    signals, analyzedAt,
  };
}

export function maxSignalSeverity(signals: ForensicSignal[]): ForensicSeverity {
  return signals.reduce<ForensicSeverity>((acc, s) => (SEVERITY_RANK[s.severity] > SEVERITY_RANK[acc] ? s.severity : acc), "NONE");
}
