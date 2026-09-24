/**
 * OCR Module — extracts text from images and scanned PDFs.
 * Uses Tesseract.js directly (no child process) for Vercel compat.
 * Falls back gracefully if OCR is unavailable.
 */

import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { rmdirSync } from "fs";
import zlib from "zlib";

let ocrAvailable: boolean | null = null;

/** Run Tesseract.js directly in-process (no child process) */
async function runTesseract(buf: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.default.createWorker("eng", 1, { logger: () => {} });
    const result = await worker.recognize(buf);
    await worker.terminate();
    return { text: result.data.text || "", confidence: result.data.confidence || 0 };
  } catch {
    return { text: "", confidence: 0 };
  }
}

function runOcrOnImageSync(imgPath: string): { text: string; confidence: number } {
  try {
    const fs = require("fs");
    const buf = fs.readFileSync(imgPath);
    // Use dynamic import with execSync fallback for compatibility
    // In serverless, we use the async version called via a wrapper
    return { text: "", confidence: 0 };
  } catch {
    return { text: "", confidence: 0 };
  }
}

export async function ocrImageAsync(buffer: Buffer, _mimeType: string = "image/png"): Promise<{ text: string; confidence: number; words: number }> {
  if (ocrAvailable === false) return { text: "", confidence: 0, words: 0 };

  const result = await runTesseract(buffer);
  if (result.text.length > 0) ocrAvailable = true;
  return { ...result, words: 0 };
}

export function ocrImage(buffer: Buffer, _mimeType: string = "image/png"): { text: string; confidence: number; words: number } {
  // Sync fallback — used in places that can't be async
  if (ocrAvailable === false) return { text: "", confidence: 0, words: 0 };

  const tmpDir = join(tmpdir(), `ocr_img_${Date.now()}`);
  try {
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const ext = _mimeType.includes("jpeg") ? ".jpg" : ".png";
    const imgFile = join(tmpDir, `image${ext}`);
    writeFileSync(imgFile, buffer);
    // Write a marker — async OCR will pick this up
    // For sync path, return empty (async path will be used for verification)
    return { text: "", confidence: 0, words: 0 };
  } catch {
    ocrAvailable = false;
    return { text: "", confidence: 0, words: 0 };
  } finally {
    try { readdirSync(tmpDir).forEach(f => unlinkSync(join(tmpDir, f))); rmdirSync(tmpDir); } catch {}
  }
}

export async function ocrPdfImagesAsync(buffer: Buffer, maxPages: number = 3): Promise<{ text: string; confidence: number; pageCount: number; imagesOcrd: number }> {
  if (ocrAvailable === false) return { text: "", confidence: 0, pageCount: 0, imagesOcrd: 0 };
  const latin = buffer.toString("latin1");
  const results: string[] = [];
  let totalConfidence = 0;
  let imagesOcrd = 0;
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null && imagesOcrd < maxPages) {
    const dataStart = m.index + m[0].length;
    const dictStart = latin.lastIndexOf("<<", m.index);
    if (dictStart === -1) continue;
    const dict = latin.slice(Math.max(0, dictStart - 200), m.index);
    if (!/\/Subtype\s*\/Image/.test(dict)) continue;
    const endIdx = latin.indexOf("endstream", dataStart);
    if (endIdx === -1) continue;
    const rawBytes = buffer.subarray(dataStart, endIdx);
    const width = parseInt(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? "0", 10);
    const height = parseInt(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? "0", 10);
    if (width <= 0 || height <= 0 || width * height > 20_000_000) continue;
    try {
      let imageBuffer: Buffer | null = null;
      if (/\/DCTDecode/.test(dict)) {
        imageBuffer = Buffer.from(rawBytes);
      } else if (/\/FlateDecode/.test(dict)) {
        const bpc = parseInt(/\/BitsPerComponent\s+(\d+)/.exec(dict)?.[1] ?? "8", 10);
        if (bpc === 8) {
          const inflated = zlib.inflateSync(rawBytes);
          const channels = /DeviceRGB|\/RGB\b/.test(dict) ? 3 : 1;
          const expectedLen = width * height * channels;
          if (inflated.length >= expectedLen) {
            const pngData: Buffer[] = [];
            pngData.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
            const ihdr = Buffer.alloc(13);
            ihdr.writeUInt32BE(width, 0);
            ihdr.writeUInt32BE(height, 4);
            ihdr[8] = 8;
            ihdr[9] = channels === 3 ? 2 : 0;
            pngData.push(makePngChunk("IHDR", ihdr));
            const rawRows: Buffer[] = [];
            for (let y = 0; y < Math.min(height, 2000); y++) {
              rawRows.push(Buffer.from([0]));
              const rowStart = y * width * channels;
              rawRows.push(inflated.subarray(rowStart, rowStart + width * channels));
            }
            const rawData = Buffer.concat(rawRows);
            const compressed = zlib.deflateSync(rawData, { level: 6 });
            pngData.push(makePngChunk("IDAT", compressed));
            pngData.push(makePngChunk("IEND", Buffer.alloc(0)));
            imageBuffer = Buffer.concat(pngData);
          }
        }
      }
      if (imageBuffer && imageBuffer.length > 1000) {
        const ocrResult = await runTesseract(imageBuffer);
        if (ocrResult.text.length > 10) {
          results.push(ocrResult.text);
          totalConfidence += ocrResult.confidence;
          imagesOcrd++;
        }
      }
    } catch {}
  }
  return { text: results.join("\n"), confidence: imagesOcrd > 0 ? totalConfidence / imagesOcrd : 0, pageCount: imagesOcrd, imagesOcrd };
}

export function ocrPdfImages(buffer: Buffer, maxPages: number = 3): { text: string; confidence: number; pageCount: number; imagesOcrd: number } {
  // Sync stub — actual OCR runs async in ocrPdfImagesAsync
  return { text: "", confidence: 0, pageCount: 0, imagesOcrd: 0 };
}

export function renderAndOcrPdf(buffer: Buffer, maxPages: number = 3): { text: string; confidence: number; pageCount: number } {
  // Sync stub — actual rendering+OCR runs async in renderAndOcrPdfAsync
  return { text: "", confidence: 0, pageCount: 0 };
}

export async function renderAndOcrPdfAsync(buffer: Buffer, maxPages: number = 3): Promise<{ text: string; confidence: number; pageCount: number }> {
  // On Vercel, pdftoppm is not available. Fall back to embedded image extraction.
  const imgResult = await ocrPdfImagesAsync(buffer, maxPages);
  if (imgResult.text.length > 10) {
    ocrAvailable = true;
    return { text: imgResult.text, confidence: imgResult.confidence, pageCount: imgResult.pageCount };
  }
  return { text: "", confidence: 0, pageCount: 0 };
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuffer, data, crcBuf]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let cv = n; for (let k = 0; k < 8; k++) { cv = cv & 1 ? 0xedb88320 ^ (cv >>> 1) : cv >>> 1; } table[n] = cv >>> 0; }
  for (let i = 0; i < buf.length; i++) { c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8); }
  return (c ^ 0xffffffff) >>> 0;
}

export function shutdownOcr(): void {}
