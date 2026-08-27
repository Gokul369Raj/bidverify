import zlib from "zlib";
import jsQR from "jsqr";
import jpegJs from "jpeg-js";
import { PNG } from "pngjs";
import { MultiFormatReader, BarcodeFormat, DecodeHintType, RGBLuminanceSource, BinaryBitmap, HybridBinarizer } from "@zxing/library";

/**
 * QR code decoding for uploaded documents.
 *
 * AUTHORITY LIMIT: a decoded QR is an EVIDENCE SIGNAL. Consistency between the
 * QR payload and visible document fields strengthens authenticity evidence but
 * does NOT by itself prove the issuing registry record is genuine.
 *
 * Supported sources:
 *  - Uploaded PNG / JPEG raster images
 *  - Images embedded in PDFs (DCTDecode = JPEG, FlateDecode = raw RGB/Gray)
 */

export interface QrIdentifierBag {
  gstins: string[];
  pans: string[];
  udyams: string[];
  urls: string[];
}

export interface QrFinding {
  found: boolean;
  source: "IMAGE" | "PDF_IMAGE";
  imageIndex: number;
  payload?: string;
  identifiers?: QrIdentifierBag;
  barcodeFormat?: string;
  note?: string;
}

const GSTIN_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z])\b/g;
const PAN_RE = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g;
const UDYAM_RE = /\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b/gi;
const URL_RE = /(https?:\/\/[^\s"'<>]+)/gi;

function collectIdentifiers(payload: string): QrIdentifierBag {
  const up = payload.toUpperCase();
  const gstins = [...up.matchAll(GSTIN_RE)].map((m) => m[1]);
  const gstinPans = new Set(gstins.map((g) => g.slice(2, 12)));
  return {
    gstins,
    pans: [...up.matchAll(PAN_RE)].map((m) => m[1]).filter((p) => !gstinPans.has(p)),
    udyams: [...payload.matchAll(UDYAM_RE)].map((m) => m[1].toUpperCase()),
    urls: [...payload.matchAll(URL_RE)].map((m) => m[1]),
  };
}

interface Raster { data: Uint8ClampedArray; width: number; height: number }

function decodeRaster(buf: Buffer): Raster | null {
  if (buf.length > 3 && buf[0] === 0x89 && buf[1] === 0x50) {
    const png = PNG.sync.read(buf);
    return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
  }
  if (buf.length > 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    const img = jpegJs.decode(buf, { useTArray: true, formatAsRGBA: true });
    if (!img.width || !img.height) return null;
    return { data: new Uint8ClampedArray(img.data), width: img.width, height: img.height };
  }
  return null;
}

function decodeQrFromRaster(raster: Raster): string | null {
  let { data, width, height } = raster;
  const maxSide = Math.max(width, height);
  if (maxSide > 1400) {
    const scale = 1400 / maxSide;
    const w2 = Math.max(1, Math.floor(width * scale));
    const h2 = Math.max(1, Math.floor(height * scale));
    const small = new Uint8ClampedArray(w2 * h2 * 4);
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        const sx = Math.min(width - 1, Math.floor(x / scale));
        const sy = Math.min(height - 1, Math.floor(y / scale));
        const si = (sy * width + sx) * 4;
        const di = (y * w2 + x) * 4;
        small[di] = data[si]; small[di + 1] = data[si + 1]; small[di + 2] = data[si + 2]; small[di + 3] = 255;
      }
    }
    data = small; width = w2; height = h2;
  }
  const code = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return code?.data ?? null;
}

const BARCODE_FORMAT_MAP: Record<number, string> = {
  [BarcodeFormat.QR_CODE]: "QR_CODE",
  [BarcodeFormat.CODE_128]: "CODE_128",
  [BarcodeFormat.CODE_39]: "CODE_39",
  [BarcodeFormat.CODE_93]: "CODE_93",
  [BarcodeFormat.EAN_13]: "EAN_13",
  [BarcodeFormat.EAN_8]: "EAN_8",
  [BarcodeFormat.UPC_A]: "UPC_A",
  [BarcodeFormat.UPC_E]: "UPC_E",
  [BarcodeFormat.DATA_MATRIX]: "DATA_MATRIX",
  [BarcodeFormat.ITF]: "ITF",
  [BarcodeFormat.CODABAR]: "CODABAR",
  [BarcodeFormat.PDF_417]: "PDF_417",
  [BarcodeFormat.AZTEC]: "AZTEC",
};

function decodeBarcodeFromRaster(raster: Raster): { payload: string; format: string } | null {
  const qrPayload = decodeQrFromRaster(raster);
  if (qrPayload) return { payload: qrPayload, format: "QR_CODE" };

  const { data, width, height } = raster;
  try {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.PDF_417,
      BarcodeFormat.AZTEC,
    ]);
    const reader = new MultiFormatReader();
    reader.setHints(hints);
    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(data.buffer),
      width,
      height,
    );
    const binarizer = new HybridBinarizer(luminanceSource);
    const binaryBitmap = new BinaryBitmap(binarizer);
    const result = reader.decode(binaryBitmap);
    const formatName = BARCODE_FORMAT_MAP[result.getBarcodeFormat()] ?? "UNKNOWN";
    return { payload: result.getText(), format: formatName };
  } catch {
    return null;
  }
}

function decodePdfImages(buf: Buffer, limit = 12): QrFinding[] {
  const latin = buf.toString("latin1");
  const findings: QrFinding[] = [];
  let streamIdx = 0;

  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = re.exec(latin)) !== null && count < limit) {
    const dataStart = m.index + m[0].length;
    const dictStart = latin.lastIndexOf("<<", m.index);
    if (dictStart === -1) continue;
    const dict = latin.slice(Math.max(0, dictStart - 200), m.index);
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;

    streamIdx++;
    if (/CCITTFax|JBIG/i.test(dict)) {
      findings.push({ found: false, source: "PDF_IMAGE", imageIndex: streamIdx, note: "Unsupported codec (CCITT/JBIG) — QR not decodable." });
      continue;
    }

    const endIdx = latin.indexOf("endstream", dataStart);
    if (endIdx === -1) continue;
    const rawBytes = buf.subarray(dataStart, endIdx).subarray(0, 8_000_000);

    const width = parseInt(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? "0", 10);
    const height = parseInt(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? "0", 10);
    if (width <= 0 || height <= 0 || width * height > 40_000_000) continue;

    try {
      let raster: Raster | null = null;
      if (/\/DCTDecode/.test(dict)) {
        raster = decodeRaster(Buffer.from(rawBytes));
      } else if (/\/FlateDecode/.test(dict)) {
        const inflated = zlib.inflateSync(rawBytes);
        const bpc = parseInt(/\/BitsPerComponent\s+(\d+)/.exec(dict)?.[1] ?? "8", 10);
        if (bpc === 8) {
          const rgba = new Uint8ClampedArray(width * height * 4);
          if (/DeviceRGB|\/RGB\b/.test(dict) && inflated.length >= width * height * 3) {
            for (let i = 0; i < width * height; i++) {
              rgba[i * 4] = inflated[i * 3]; rgba[i * 4 + 1] = inflated[i * 3 + 1];
              rgba[i * 4 + 2] = inflated[i * 3 + 2]; rgba[i * 4 + 3] = 255;
            }
          } else if (inflated.length >= width * height) {
            for (let i = 0; i < width * height; i++) {
              rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = inflated[i]; rgba[i * 4 + 3] = 255;
            }
          }
          raster = { data: rgba, width, height };
        }
      }
      if (raster) {
        const decoded = decodeBarcodeFromRaster(raster);
        findings.push(
          decoded
            ? { found: true, source: "PDF_IMAGE", imageIndex: streamIdx, payload: decoded.payload, identifiers: collectIdentifiers(decoded.payload), barcodeFormat: decoded.format }
            : { found: false, source: "PDF_IMAGE", imageIndex: streamIdx, note: "Image extracted but no QR pattern recognized." },
        );
      }
    } catch {
      /* undecodable image — skip */
    }
    count++;
  }
  return findings;
}

/** Full QR sweep for one stored document buffer. */
export function scanForQrCodes(fileName: string, buf: Buffer): QrFinding[] {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  try {
    if (ext === "pdf" || buf.subarray(0, 4).toString("latin1") === "%PDF") {
      return decodePdfImages(buf);
    }
    if (["png", "jpg", "jpeg"].includes(ext)) {
      const raster = decodeRaster(buf);
      if (!raster) return [{ found: false, source: "IMAGE", imageIndex: 0, note: "Unsupported raster encoding." }];
      const decoded = decodeBarcodeFromRaster(raster);
      return [
        decoded
          ? { found: true, source: "IMAGE", imageIndex: 0, payload: decoded.payload, identifiers: collectIdentifiers(decoded.payload), barcodeFormat: decoded.format }
          : { found: false, source: "IMAGE", imageIndex: 0, note: "No QR pattern recognized in the image." },
      ];
    }
  } catch {
    return [{ found: false, source: "IMAGE", imageIndex: 0, note: "QR analysis failed on this file." }];
  }
  return [];
}

export interface QrConsistencyVerdict {
  status: "CONSISTENT" | "CONFLICT" | "INCONCLUSIVE";
  details: string[];
}

/** Compare identifiers embedded in QR payloads against OCR-extracted fields. */
export function compareQrWithFields(findings: QrFinding[], fields: Record<string, string>): QrConsistencyVerdict {
  const details: string[] = [];
  const qrPayloads = findings.filter((f) => f.found && f.identifiers);
  if (qrPayloads.length === 0) {
    return {
      status: "INCONCLUSIVE",
      details: [findings.length > 0 ? "No QR code found or decodable in this document." : "QR analysis was not applicable to this file type."],
    };
  }

  let conflict = false;
  let confirmedAny = false;
  const get = (k: string) => {
    const v = fields[k];
    return v && v !== "NOT_FOUND_IN_SOURCE" ? v.toUpperCase() : undefined;
  };

  for (const f of qrPayloads) {
    const ids = f.identifiers!;
    for (const g of ids.gstins) {
      const vis = get("gstin");
      if (!vis) { details.push(`QR GSTIN ${g} — no visible GSTIN field to compare.`); break; }
      if (vis === g) { confirmedAny = true; details.push(`QR GSTIN matches visible GSTIN (${g}).`); }
      else { conflict = true; details.push(`QR GSTIN ${g} ≠ visible GSTIN ${vis}.`); }
    }
    for (const p of ids.pans) {
      const visPan = get("pan");
      const panInGstin = get("gstin")?.slice(2, 12);
      if (visPan === p || panInGstin === p) { confirmedAny = true; details.push(`QR PAN ${p} consistent with document identity.`); }
      else if (visPan || panInGstin) { conflict = true; details.push(`QR PAN ${p} conflicts with document identity.`); }
    }
    for (const u of ids.udyams) {
      const visU = get("udyamNumber");
      if (visU && visU === u.toUpperCase()) { confirmedAny = true; details.push(`QR Udyam matches certificate (${u}).`); }
      else if (visU) { conflict = true; details.push(`QR Udyam ${u} ≠ visible ${visU}.`); }
    }
    if (ids.urls.length) {
      for (const url of ids.urls) {
        try {
          const parsed = new URL(url);
          const host = parsed.host.toLowerCase();
          const govtDomains = [".gov.in", ".gov", ".nic.in", ".nios.in", ".cbic.gov.in", ".incometax.gov.in", ".gst.gov.in", ".udyamregister.gov.in", ".msme.gov.in", ".epfindia.gov.in", ".esic.gov.in", ".mca.gov.in", ".indiapost.gov.in"];
          const isGovt = govtDomains.some(d => host.endsWith(d));
          details.push(`QR URL: ${host}${isGovt ? " [VERIFIED GOVT DOMAIN]" : " [NON-GOVERNMENT]"}`);
          if (isGovt) confirmedAny = true;
        } catch { /* malformed url */ }
      }
    }
  }

  if (conflict) return { status: "CONFLICT", details };
  if (confirmedAny) return { status: "CONSISTENT", details };
  return { status: "INCONCLUSIVE", details: [...details, "QR decoded but contained no comparable identifiers."] };
}
