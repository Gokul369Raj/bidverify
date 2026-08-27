/**
 * OCR Module — extracts text from images and scanned PDFs.
 * Uses Tesseract.js via child process to avoid Next.js worker issues.
 * Falls back gracefully if OCR is unavailable.
 */

import { execSync } from "child_process";
import { writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { rmdirSync } from "fs";
import zlib from "zlib";

let ocrAvailable: boolean | null = null;

function runOcrOnImage(imgPath: string): { text: string; confidence: number } {
  try {
    const runnerPath = join(process.cwd(), "src/lib/verify/ocrRunner.js");
    const result = execSync(`node "${runnerPath}" "${imgPath}"`, {
      timeout: 30000,
      stdio: "pipe",
      encoding: "utf8",
    });
    const parsed = JSON.parse(result.trim());
    return { text: parsed.text || "", confidence: parsed.confidence || 0 };
  } catch {
    return { text: "", confidence: 0 };
  }
}

export function ocrImage(buffer: Buffer, _mimeType: string = "image/png"): { text: string; confidence: number; words: number } {
  if (ocrAvailable === false) return { text: "", confidence: 0, words: 0 };

  const tmpDir = join(tmpdir(), `ocr_img_${Date.now()}`);
  try {
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const ext = _mimeType.includes("jpeg") ? ".jpg" : ".png";
    const imgFile = join(tmpDir, `image${ext}`);
    writeFileSync(imgFile, buffer);
    const result = runOcrOnImage(imgFile);
    if (result.text.length > 0) ocrAvailable = true;
    return { ...result, words: 0 };
  } catch {
    ocrAvailable = false;
    return { text: "", confidence: 0, words: 0 };
  } finally {
    try { readdirSync(tmpDir).forEach(f => unlinkSync(join(tmpDir, f))); rmdirSync(tmpDir); } catch {}
  }
}

export function ocrPdfImages(buffer: Buffer, maxPages: number = 3): { text: string; confidence: number; pageCount: number; imagesOcrd: number } {
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
        const tmpDir = join(tmpdir(), `ocr_pdf_${Date.now()}_${imagesOcrd}`);
        if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
        const ext = /\/DCTDecode/.test(dict) ? ".jpg" : ".png";
        const imgFile = join(tmpDir, `page${ext}`);
        writeFileSync(imgFile, imageBuffer);
        const ocrResult = runOcrOnImage(imgFile);
        try { readdirSync(tmpDir).forEach(f => unlinkSync(join(tmpDir, f))); rmdirSync(tmpDir); } catch {}
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

export function renderAndOcrPdf(buffer: Buffer, maxPages: number = 3): { text: string; confidence: number; pageCount: number } {
  const tmpDir = join(tmpdir(), `ocr_render_${Date.now()}`);
  const tmpPdf = join(tmpDir, "input.pdf");
  const tmpPrefix = join(tmpDir, "page");
  try {
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    writeFileSync(tmpPdf, buffer);
    execSync(`pdftoppm -png -r 200 -f 1 -l ${maxPages} "${tmpPdf}" "${tmpPrefix}"`, { timeout: 30000, stdio: "pipe" });
    const files = readdirSync(tmpDir).filter((f: string) => f.startsWith("page") && f.endsWith(".png")).sort();
    if (files.length === 0) return { text: "", confidence: 0, pageCount: 0 };
    const texts: string[] = [];
    let totalConfidence = 0;
    for (const file of files) {
      const imgPath = join(tmpDir, file);
      const ocrResult = runOcrOnImage(imgPath);
      if (ocrResult.text && ocrResult.text.length > 5) {
        texts.push(ocrResult.text);
        totalConfidence += ocrResult.confidence;
      }
    }
    ocrAvailable = true;
    return { text: texts.join("\n"), confidence: files.length > 0 ? totalConfidence / files.length : 0, pageCount: files.length };
  } catch (err) {
    console.warn("renderAndOcrPdf failed:", (err as Error).message?.slice(0, 100));
    ocrAvailable = false;
    return { text: "", confidence: 0, pageCount: 0 };
  } finally {
    try { readdirSync(tmpDir).forEach(f => unlinkSync(join(tmpDir, f))); require("fs").rmdirSync(tmpDir); } catch {}
  }
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
