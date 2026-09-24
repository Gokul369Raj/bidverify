/**
 * PDF Decryption — handles password-protected PDFs.
 * 
 * On Vercel (no Python/pikepdf), returns encrypted buffer with status note.
 * The verification pipeline handles PASSWORD_REQUIRED gracefully.
 * 
 * Common encrypted PDF sources:
 * - Income Tax Department (PAN cards, ITR)
 * - GST Portal
 * - DigiLocker documents
 * - Government-issued certificates
 */

/**
 * Attempt to decrypt a password-protected PDF.
 * On serverless (Vercel), gracefully returns original buffer if decryption unavailable.
 */
export async function tryDecryptPdf(
  buffer: Buffer,
  password?: string
): Promise<{ decrypted: Buffer; wasEncrypted: boolean; passwordUsed?: string }> {
  const isEncrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(buffer.toString("latin1"));
  
  if (!isEncrypted) {
    return { decrypted: buffer, wasEncrypted: false };
  }

  // On Vercel serverless, Python/pikepdf is not available.
  // Return original encrypted buffer — verification will mark as PASSWORD_REQUIRED.
  // The officer can download and decrypt locally if needed.
  return { decrypted: buffer, wasEncrypted: true };
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

  const allStrings = bufStr.match(/[\x20-\x7E]{4,80}/g) || [];
  const joined = allStrings.join(' ');
  
  const cnMatch = joined.match(/CN\s*=\s*([A-Za-z0-9\s\.\-\/]+)/);
  const oMatch = joined.match(/O\s*=\s*([A-Za-z0-9\s\.\-\/]+?)(?:\s+O[Uu]|\s+C[NU]|\s+SN|\s+serialNumber|$)/);
  const emailMatch = joined.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,})/i);
  const locationMatch = /\/Location\s*\(([^)]+)\)/.exec(latin);
  const reasonMatch = /\/Reason\s*\(([^)]+)\)/.exec(latin);
  const signerNameMatch = /\/SignerName\s*\(([^)]+)\)/.exec(latin);
  
  const knownCAs = ['e-Mudhra', 'Income Tax', 'NSDL', 'TIN', 'DSC', 'Certifying Authority', 
                     'Capricorn', 'Emudhra', 'Sify', 'SafeScrypt', 'nCode', 'IGCAC',
                     'CDAC', 'CCA', 'Controller of Certifying Authorities', 'India PKI',
                     'Sub-CA', 'Root CA', 'Intermediate CA', 'MCA21', 'NIC', 'IRCTC',
                     'National Informatics Centre', 'STQC', 'Cert-In'];
  const matchedCA = allStrings.find(s => knownCAs.some(ca => s.toLowerCase().includes(ca.toLowerCase())));
  
  const trustedGovtCAs = ['Income Tax', 'NSDL', 'TIN', 'e-Mudhra', 'Emudhra', 'Capricorn', 'Sify', 'SafeScrypt', 'nCode', 'IGCAC', 'CCA', 'CDAC', 'NIC'];
  const isTrustedCA = matchedCA && trustedGovtCAs.some(tca => matchedCA.toLowerCase().includes(tca.toLowerCase()));
  
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
