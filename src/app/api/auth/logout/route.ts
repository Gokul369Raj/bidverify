import { clearSessionCookie, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ok, handle } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST() {
  return handle(async () => {
    // Clear the cookie FIRST — the response must not wait on database writes.
    const session = await getSession();
    await clearSessionCookie();

    // Audit trail is written in the background; logout stays instant.
    if (session) {
      setTimeout(() => {
        audit({ actor: session, action: "LOGOUT", entityType: "User", entityId: session.userId }).catch(() => {});
      }, 0);
    }
    return ok({ loggedOut: true });
  });
}

// GET also clears session — visit /api/auth/logout to force logout
export async function GET() {
  const session = await getSession();
  await clearSessionCookie();
  if (session) {
    setTimeout(() => {
      audit({ actor: session, action: "LOGOUT", entityType: "User", entityId: session.userId }).catch(() => {});
    }, 0);
  }
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}
