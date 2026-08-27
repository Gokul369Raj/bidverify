/**
 * Resolves the app's public origin deterministically.
 *
 * Google OAuth rejects any redirect_uri that is not registered verbatim in the
 * Google Cloud Console ("Error 400: redirect_uri_mismatch"). Deriving the URI
 * from the incoming request makes it drift whenever the dev server changes port
 * or is opened via a LAN IP — so we always prefer the configured env origin and
 * only fall back to the request when no configuration exists.
 */
export function getAppOrigin(requestOrigin?: string | null): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const origin = (configured || requestOrigin || "http://localhost:3000").replace(/\/+$/, "");
  return origin;
}

/** The exact redirect URI that must be registered in Google Cloud Console. */
export function googleRedirectUri(requestOrigin?: string | null): string {
  return `${getAppOrigin(requestOrigin)}/api/auth/google/callback`;
}
