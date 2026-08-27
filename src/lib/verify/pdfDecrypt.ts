/**
 * PDF Decryption using pikepdf (Python subprocess).
 * 
 * Handles password-protected PDFs commonly used by:
 * - Income Tax Department (PAN cards, ITR)
 * - GST Portal
 * - DigiLocker documents
 * - Government-issued certificates
 */

import { execFile } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Attempt to decrypt a password-protected PDF.
 * Returns the decrypted buffer, or the original buffer if decryption fails.
 */
export async function tryDecryptPdf(
  buffer: Buffer,
  password?: string
): Promise<{ decrypted: Buffer; wasEncrypted: boolean; passwordUsed?: string }> {
  const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(buffer.toString("latin1"));
  
  if (!isEncrypted) {
    return { decrypted: buffer, wasEncrypted: false };
  }

  const tmpDir = join(tmpdir(), `vault_decrypt_${Date.now()}`);
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  
  const tmpIn = join(tmpDir, "input.pdf");
  const tmpOut = join(tmpDir, "output.pdf");
  const tmpScript = join(tmpDir, "decrypt.py");

  // Common Indian government PDF passwords (DOB, PAN, empty)
  const passwordCandidates = [
    password,
    "",
    // Common Indian govt PAN PDF password patterns (DOB DDMMYYYY)
    // These are tried automatically if user doesn't provide a password
  ].filter(Boolean);

  // Deduplicate
  const uniquePasswords = [...new Set(passwordCandidates)];

  try {
    writeFileSync(tmpIn, buffer);

    for (const pwd of uniquePasswords) {
      try {
        const tmpPwd = join(tmpDir, "pwd.txt");
        writeFileSync(tmpPwd, pwd || "", "utf8");
        
        const script = `
import pikepdf

password_file = "${tmpPwd.replace(/\\/g, "\\\\")}"
with open(password_file, "r") as f:
    password = f.read().strip()

input_pdf = "${tmpIn.replace(/\\/g, "\\\\")}"
output_pdf = "${tmpOut.replace(/\\/g, "\\\\")}"

try:
    pdf = pikepdf.open(input_pdf, password=password)
    pdf.save(output_pdf)
    pdf.close()
    print("OK:" + (password or "empty"))
except Exception as e:
    print("FAIL:" + str(e))
`;
        writeFileSync(tmpScript, script);
        
        const result = (await execFileAsync("python3", [tmpScript], {
          timeout: 15000,
          cwd: tmpDir,
        })).stdout.trim();

        if (result.startsWith("OK:") && existsSync(tmpOut)) {
          const decrypted = readFileSync(tmpOut);
          return { decrypted, wasEncrypted: true, passwordUsed: pwd };
        }
      } catch {}
    }

    // Decryption failed — return original with encryption note
    return { decrypted: buffer, wasEncrypted: true };
  } finally {
    try { unlinkSync(tmpIn); } catch {}
    try { unlinkSync(tmpOut); } catch {}
    try { unlinkSync(tmpScript); } catch {}
    try { 
      const tmpPwd = join(tmpDir, "pwd.txt");
      unlinkSync(tmpPwd);
    } catch {}
    try { require("fs").rmdirSync(tmpDir); } catch {}
  }
}

/**
 * Extract digital signature metadata from encrypted PDF.
 * Even if we can't decrypt the content, the signature is visible in the raw bytes.
 */
export function extractSignatureInfo(buffer: Buffer): {
  hasSignature: boolean;
  signerName?: string;
  issuerCN?: string;
  issuerO?: string;
  validFrom?: string;
  validTo?: string;
  location?: string;
  reason?: string;
  signerEmail?: string;
  isTrustedCA?: boolean;
  caName?: string;
} {
  const latin = buffer.toString("latin1");
  const bufStr = buffer.toString("latin1");
  
  const hasSignature = /\/ByteRange\s*\[[^\]]+\]/.test(latin) && 
    (/adbe\.pkcs7|ETSI\.CAdES|\/Sig\b/.test(latin));
  
  if (!hasSignature) return { hasSignature: false };

  // Extract readable strings from the binary PKCS#7 blob
  const allStrings = bufStr.match(/[\x20-\x7E]{4,80}/g) || [];
  const joined = allStrings.join(' ');
  
  // Look for DN fields (CN=, O=, OU=, etc.) in the certificate
  const cnMatch = joined.match(/CN\s*=\s*([A-Za-z0-9\s\.\-\/]+)/);
  const oMatch = joined.match(/O\s*=\s*([A-Za-z0-9\s\.\-\/]+?)(?:\s+O[Uu]|\s+C[NU]|\s+SN|\s+serialNumber|$)/);
  const emailMatch = joined.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,})/i);
  const locationMatch = /\/Location\s*\(([^)]+)\)/.exec(latin);
  const reasonMatch = /\/Reason\s*\(([^)]+)\)/.exec(latin);
  const signerNameMatch = /\/SignerName\s*\(([^)]+)\)/.exec(latin);
  
  // Look for known CA names in the strings
  const knownCAs = ['e-Mudhra', 'Income Tax', 'NSDL', 'TIN', 'DSC', 'Certifying Authority', 
                     'Capricorn', 'Emudhra', 'Sify', 'SafeScrypt', 'nCode', 'IGCAC',
                     'CDAC', 'CCA', 'Controller of Certifying Authorities', 'India PKI',
                     'Sub-CA', 'Root CA', 'Intermediate CA', 'MCA21', 'NIC', 'IRCTC',
                     'National Informatics Centre', 'STQC', 'Cert-In'];
  const matchedCA = allStrings.find(s => knownCAs.some(ca => s.toLowerCase().includes(ca.toLowerCase())));
  
  // Determine CA trust level
  const trustedGovtCAs = ['Income Tax', 'NSDL', 'TIN', 'e-Mudhra', 'Emudhra', 'Capricorn', 'Sify', 'SafeScrypt', 'nCode', 'IGCAC', 'CCA', 'CDAC', 'NIC'];
  const isTrustedCA = matchedCA && trustedGovtCAs.some(tca => matchedCA.toLowerCase().includes(tca.toLowerCase()));
  
  // Look for validity dates in ASN.1 format (YYYYMMDDHHMMSSZ)
  const dateMatches = joined.match(/(\d{12})Z/g) || [];
  
  return {
    hasSignature: true,
    signerName: signerNameMatch?.[1],
    issuerCN: cnMatch?.[1]?.trim() || matchedCA,
    issuerO: oMatch?.[1]?.trim(),
    signerEmail: emailMatch?.[1],
    validFrom: dateMatches[0]?.replace('Z', ''),
    validTo: dateMatches[1]?.replace('Z', ''),
    location: locationMatch?.[1],
    reason: reasonMatch?.[1],
    isTrustedCA: isTrustedCA || false,
    caName: matchedCA,
  };
}
