// Standalone OCR runner — called as child process from ocr.ts
// Usage: node ocrRunner.js <image_path>
const fs = require('fs');
const Tesseract = require('tesseract.js');

const imgPath = process.argv[2];
if (!imgPath) { process.exit(1); }

const buf = fs.readFileSync(imgPath);

async function run() {
  try {
    // Try new API first (v7)
    const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });
    const result = await worker.recognize(buf);
    await worker.terminate();
    console.log(JSON.stringify({ text: result.data.text, confidence: result.data.confidence }));
  } catch {
    try {
      // Fallback to old API
      const result = await Tesseract.recognize(buf, 'eng', {});
      console.log(JSON.stringify({ text: result.data.text, confidence: result.data.confidence }));
    } catch {
      console.log(JSON.stringify({ text: '', confidence: 0 }));
    }
  }
  process.exit(0);
}

run();
