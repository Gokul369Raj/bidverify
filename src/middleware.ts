import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Edge middleware: first line of route protection. API routes and server components
 * re-verify sessions and roles against the database — the middleware is defense in
 * depth, never the only check.
 */

const OFFICER_ROLES = new Set([
  "SUPER_ADMIN",
  "PROCUREMENT_OFFICER",
  "BID_EVALUATION_OFFICER",
  "COMPLIANCE_REVIEWER",
  "AUDITOR",
  "SYSTEM_ADMIN",
]);

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "bidverify-dev-secret-change-me");
}

async function roleFromRequest(req: NextRequest): Promise<{ role?: string; home: string }> {
  const token = req.cookies.get("bidverify_session")?.value;
  if (!token) return { home: "/login" };
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = String(payload.role ?? "BIDDER");
    const home = OFFICER_ROLES.has(role) ? "/officer" : "/bidder";
    return { role, home };
  } catch {
    return { home: "/login" };
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const { role, home } = await roleFromRequest(req);

  const isProtected =
    pathname.startsWith("/bidder") ||
    pathname.startsWith("/officer") ||
    pathname.startsWith("/admin");

  if (!isProtected) return NextResponse.next();

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/bidder") && role !== "BIDDER") {
    return NextResponse.redirect(new URL(home, req.url));
  }
  if (pathname.startsWith("/officer") && !OFFICER_ROLES.has(role)) {
    return NextResponse.redirect(new URL(home, req.url));
  }
  // /admin has its own password gate (AdminGate component) — allow all logged-in users
  // if (pathname.startsWith("/admin") && !ADMIN_ROLES.has(role)) {
  //   return NextResponse.redirect(new URL("/officer", req.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ["/bidder/:path*", "/officer/:path*"],
};
