import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAppOrigin, googleRedirectUri } from "@/lib/appUrl";

/**
 * Real Google OAuth / OpenID Connect (authorization code flow).
 * Active when GOOGLE_CLIENT_ID/SECRET are configured. Without credentials the
 * user is redirected back with a clear message — no fake OAuth is performed.
 *
 * The redirect_uri is derived from the configured app origin (APP_URL /
 * NEXT_PUBLIC_APP_URL) so it stays byte-identical to the URI registered in
 * Google Cloud Console regardless of how the server is reached.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = getAppOrigin(req.nextUrl.origin);
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${req.nextUrl.origin}/login?error=google_not_configured`);
  }
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(origin));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
