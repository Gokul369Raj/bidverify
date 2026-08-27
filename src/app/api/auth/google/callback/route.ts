import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { googleRedirectUri } from "@/lib/appUrl";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("g_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${origin}/login?error=oauth_state`);
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        // Must byte-match the redirect_uri used to start the flow.
        redirect_uri: googleRedirectUri(origin),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    // verify the id_token signature against Google's JWKS
    const { payload } = await jwtVerify(tokens.id_token, JWKS, { issuer: ["https://accounts.google.com"], audience: process.env.GOOGLE_CLIENT_ID });
    const email = String(payload.email ?? "").toLowerCase();
    const name = String(payload.name ?? email);
    const googleId = String(payload.sub);
    if (!email) throw new Error("no email in Google profile");

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user && googleId) user = await prisma.user.findUnique({ where: { googleId } });
    if (!user) {
      // Google sign-ups are BIDDER accounts; privileged roles are granted by admins only.
      user = await prisma.user.create({ data: { email, name, googleId, authProvider: "GOOGLE", role: "BIDDER" } });
      // First-time users must complete their organization profile before bidding.
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Complete your organization profile",
          body: "Add your legal name, PAN, GSTIN and address to unlock bidding and compliance verification.",
          kind: "WARNING",
          link: "/bidder/profile",
        },
      });
    } else if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId, authProvider: "GOOGLE" } });
    }
    if (!user.isActive) return NextResponse.redirect(`${origin}/login?error=deactivated`);

    const token = await createSessionToken(user);
    const res = NextResponse.redirect(`${origin}${user.role === "BIDDER" ? "/bidder" : "/officer"}`);
    res.cookies.set("bidverify_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
    await audit({ actor: { userId: user.id, email, name, role: user.role as never, organizationId: user.organizationId }, action: "LOGIN_GOOGLE", entityType: "User", entityId: user.id });
    return res;
  } catch (err) {
    console.error("google oauth callback failed", err);
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }
}
