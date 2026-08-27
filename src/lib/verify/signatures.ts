/**
 * Digital signature DETECTION for PDFs.
 *
 * AUTHORITY LIMIT (deliberate, per policy):
 *   Detection proves the PDF container carries a signature dictionary with a
 *   ByteRange. It does NOT cryptographically validate the PKCS#7/CAdES blob.
 *   Therefore the only statuses we may ever emit are:
 *     SIGNATURE_DETECTED        — structure present
 *     SIGNATURE_INFO_PARTIAL    — signer metadata present, validation not performed
 *     NO_SIGNATURE_FOUND
 *     ANALYSIS_UNAVAILABLE      — not a PDF / unreadable
 *   The system MUST NOT emit "cryptographically verified" from this module.
 */

export type SignatureStatus =
  | "SIGNATURE_DETECTED"
  | "SIGNATURE_INFO_PARTIAL"
  | "NO_SIGNATURE_FOUND"
  | "ANALYSIS_UNAVAILABLE";

export interface SignatureInfo {
  status: SignatureStatus;
  subFilter?: string;
  signerName?: string;
  signingTime?: string;
  location?: string;
  reason?: string;
  byteRangePresent: boolean;
  limitation: string;
  isTrustedCA?: boolean;
  caName?: string;
}

const STANDARD_LIMITATION =
  "Signature presence detected structurally; cryptographic validation of the certificate chain and hash integrity was NOT performed by this system. Treat as an evidence signal only.";

export async function detectPdfSignature(buf: Buffer): Promise<SignatureInfo> {
  const latin = buf.toString("latin1");
  if (!latin.startsWith("%PDF-")) {
    return { status: "ANALYSIS_UNAVAILABLE", byteRangePresent: false, limitation: "Not a PDF document." };
  }

  const byteRangePresent = /\/ByteRange\s*\[[^\]]+\]/.test(latin);
  const sigDict = /\/SubFilter\s*\/([A-Za-z0-9\.]+)/.exec(latin)?.[1];
  const hasSigObject = /\/Sig\b|\/SigField\b|adbe\.pkcs7|ETSI\.CAdES/.test(latin);

  if (!hasSigObject && !byteRangePresent) {
    return { status: "NO_SIGNATURE_FOUND", byteRangePresent: false, limitation: "No digital-signature structures found in the PDF." };
  }

  const signerName = /\/SignerName\s*\(([^)]{1,150})\)/.exec(latin)?.[1];
  const signingTime = /\/M\s*\(D:([^)]{1,60})\)/.exec(latin)?.[1];
  const location = /\/Location\s*\(([^)]{1,200})\)/.exec(latin)?.[1];
  const reason = /\/Reason\s*\(([^)]{1,200})\)/.exec(latin)?.[1];

  const partialInfo = Boolean(signerName || signingTime || location || reason);

  // Get extended signature info (CA, trust level)
  let isTrustedCA: boolean | undefined;
  let caName: string | undefined;
  try {
    const { extractSignatureInfo } = await import("./pdfDecrypt");
    const extInfo = extractSignatureInfo(buf);
    if (extInfo.hasSignature) {
      isTrustedCA = extInfo.isTrustedCA;
      caName = extInfo.caName;
    }
  } catch {
    // extractSignatureInfo not available — skip
  }

  return {
    status: partialInfo ? "SIGNATURE_INFO_PARTIAL" : "SIGNATURE_DETECTED",
    subFilter: sigDict,
    signerName,
    signingTime,
    location,
    reason,
    byteRangePresent,
    limitation: STANDARD_LIMITATION,
    isTrustedCA,
    caName,
  };
}
