import { ok, fail, handle } from "@/lib/api";

/**
 * POST — Scan a tender PDF, extract text, and return parsed fields.
 * Does NOT create anything — just returns extracted data for auto-fill.
 * Uses pdf-parse (JS) instead of pdftotext (system binary) for Vercel compat.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file || file.size === 0) return fail(400, "PDF file is required");

    const buffer = Buffer.from(await file.arrayBuffer());

    let ocrText = "";
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const pdfData = await pdfParse(buffer);
      ocrText = pdfData.text || "";
    } catch {
      // Fallback: try native PDF text extraction
      try {
        ocrText = extractNativePdfText(buffer);
      } catch { /* no text available */ }
    }

    // Parse fields from OCR text
    const fields = parseTenderFields(ocrText);

    return ok({
      ocrText: ocrText.slice(0, 3000),
      fields,
    });
  });
}

function parseTenderFields(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const full = text;

  // Tender Number — look for patterns like XX/XX/2026/NNN
  const tnMatch = full.match(/([A-Z]{2,}\/[A-Z]{2,}\/\d{4}\/\d{3,})/i);
  const tenderNumber = tnMatch ? tnMatch[1] : "";

  // Title — first substantial line after headers, skip known non-title lines
  let title = "";
  const skipWords = /^(request|tender|rfp|date|category|buyer|scope|section|step|issuing|authority|publication|closing|estimated|emd|amount|value|mandatory|optional)/i;
  for (const line of lines) {
    if (line.length > 15 && !skipWords.test(line) && !tenderNumber.includes(line) && !line.match(/^\d/) && !line.match(/^rs\.|^inr|^₹/i)) {
      title = line;
      break;
    }
  }

  // ── Positional key-value extraction ──
  // PDFs often have "Label:\nLabel:\n...\n\nValue1\nValue2\n..."
  // Find the block of labels (lines ending with ":") and the block of values after them
  const LABELS_ORDER = [
    "tender number", "issuing authority", "category", "publication date",
    "closing date", "estimated value", "emd amount",
  ];

  // Find label block: consecutive lines ending with ":"
  let labelBlockStart = -1;
  let labelBlockEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^[A-Za-z\s]+:$/)) {
      if (labelBlockStart === -1) labelBlockStart = i;
      labelBlockEnd = i;
    } else if (labelBlockStart !== -1) {
      break; // label block ended
    }
  }

  // Find value block: consecutive non-label lines after label block
  let valueBlockStart = -1;
  const valueLines: string[] = [];
  if (labelBlockStart !== -1) {
    for (let i = labelBlockEnd + 1; i < lines.length; i++) {
      if (lines[i].match(/^[A-Za-z\s]+:$/)) break; // hit next label block
      if (lines[i]) {
        if (valueBlockStart === -1) valueBlockStart = i;
        valueLines.push(lines[i]);
      }
    }
  }

  // Map labels to values by position
  const labelNames: string[] = [];
  if (labelBlockStart !== -1) {
    for (let i = labelBlockStart; i <= labelBlockEnd; i++) {
      labelNames.push(lines[i].toLowerCase().replace(/:$/, "").trim());
    }
  }

  const extracted: Record<string, string> = {};
  for (let i = 0; i < labelNames.length && i < valueLines.length; i++) {
    const key = labelNames[i];
    const val = valueLines[i].trim();
    if (key === "tender number") extracted.tenderNumber = val;
    else if (key === "issuing authority") extracted.buyerOrganization = val;
    else if (key === "category") extracted.category = val;
    else if (key === "closing date") extracted.closingDate = val;
    else if (key === "estimated value") extracted.estimatedValue = val;
    else if (key === "emd amount") extracted.emdAmount = val;
  }

  const buyerOrganization = extracted.buyerOrganization || "";
  let closingDate = extracted.closingDate || "";
  const category = extracted.category || "";

  // Closing Date — try full-text regex as fallback
  if (!closingDate) {
    const m = full.match(/(?:closing|deadline|last date)[:\s]+(\d{4}[-/.]\d{2}[-/.]\d{2})/i) || full.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) closingDate = m[1];
  }
  // Clean closing date: extract only YYYY-MM-DD
  const dateMatch = closingDate.match(/(\d{4}-\d{2}-\d{2})/);
  closingDate = dateMatch ? dateMatch[1] : "";

  // Estimated Value — convert to lakhs
  let estimatedValueLakh = "";
  const evRaw = extracted.estimatedValue || "";
  const evNumMatch = evRaw.match(/([\d,]+)/);
  if (evNumMatch) {
    const rawStr = evNumMatch[1].replace(/,/g, "");
    const rawNum = parseInt(rawStr, 10);
    // If it has "Rs." prefix, the number is always in rupees regardless of lakh/crore mention
    if (/rs\.|inr|₹/i.test(evRaw)) {
      estimatedValueLakh = String(Math.round(rawNum / 100000));
    } else if (/crore/i.test(evRaw)) {
      estimatedValueLakh = String(rawNum * 100);
    } else if (/lakh|lac/i.test(evRaw)) {
      estimatedValueLakh = String(rawNum);
    } else if (rawNum > 100000) {
      estimatedValueLakh = String(Math.round(rawNum / 100000));
    } else {
      estimatedValueLakh = String(rawNum);
    }
  }

  // EMD Amount
  let emdAmount = "";
  const emdRaw = extracted.emdAmount || "";
  const emdMatch = emdRaw.match(/([\d,]+)/);
  if (emdMatch) emdAmount = emdMatch[1].replace(/,/g, "");

  // State
  let state = "";
  const states = ["Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat", "Rajasthan", "Uttar Pradesh", "West Bengal", "Madhya Pradesh", "Andhra Pradesh", "Telangana", "Kerala", "Punjab", "Haryana", "Bihar", "Odisha", "Jharkhand", "Chhattisgarh", "Uttarakhand", "Himachal Pradesh", "Goa"];
  for (const s of states) {
    if (full.toLowerCase().includes(s.toLowerCase())) { state = s; break; }
  }

  // Detect required documents
  const requiredDocs: string[] = [];
  const docKeywords: [RegExp, string][] = [
    [/gst\s*(registration|certificate|registration certificate)/i, "GST_CERTIFICATE"],
    [/pan\s*(card|number)/i, "PAN_CARD"],
    [/udyam|msme/i, "UDYAM_CERTIFICATE"],
    [/experience\s*(certificate|proof)/i, "EXPERIENCE_CERTIFICATE"],
    [/turnover|financial\s*(statement|proof)/i, "TURNOVER_PROOF"],
    [/company\s*(certificate|incorporation)/i, "COMPANY_CERTIFICATE"],
    [/iso\s*9001/i, "COMPANY_CERTIFICATE"],
    [/oem\s*authorization/i, "OEM_AUTHORIZATION"],
    [/technical\s*(datasheet|specification|data sheet)/i, "TECHNICAL_DATASHEET"],
    [/local\s*content/i, "LOCAL_CONTENT_DECLARATION"],
    [/bis\s*(certification|certificate)/i, "BIS_CERTIFICATION"],
    [/emd|earnest\s*money/i, "EMD"],
  ];
  for (const [regex, docType] of docKeywords) {
    if (regex.test(full) && !requiredDocs.includes(docType)) {
      requiredDocs.push(docType);
    }
  }

  return {
    tenderNumber,
    title,
    buyerOrganization: buyerOrganization.slice(0, 200),
    closingDate,
    estimatedValueLakh,
    emdAmount,
    category: category.slice(0, 100),
    state,
    requiredDocs,
  };
}

/** Native PDF text extraction — reads BT...ET text blocks from raw PDF bytes */
function extractNativePdfText(buffer: Buffer): string {
  const text = buffer.toString("latin1");
  const texts: string[] = [];
  const btEtRegex = /BT\b([\s\S]*?)ET\b/g;
  let match;
  while ((match = btEtRegex.exec(text)) !== null) {
    const block = match[1];
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      texts.push(tjMatch[1]);
    }
  }
  return texts.join(" ");
}
