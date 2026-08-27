import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { safeRole, type Role, OFFICER_ROLES, ADMIN_ROLES, DECISION_ROLES, AUDIT_ROLES } from "@/lib/roles";

export const SESSION_COOKIE = "bidverify_session";
const SESSION_HOURS = 8;

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string | null;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET || "bidverify-dev-secret-change-me");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string | null;
}): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Verify a session token string (used by middleware and API routes). Returns null when invalid/expired. */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.role !== "string") return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: safeRole(payload.role),
      organizationId: (payload.organizationId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Read the current session from cookies and re-check it against the database (defense in depth).
 *  A short-TTL in-memory cache avoids a remote database round-trip on every request —
 *  role/isActive changes propagate within 60 seconds. */
const SESSION_CACHE_TTL_MS = 60_000;
const sessionCache = new Map<string, { user: Awaited<ReturnType<typeof loadUser>>; expiresAt: number }>();

async function loadUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, role: true, organizationId: true, email: true, name: true },
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;

  const cached = sessionCache.get(session.userId);
  if (cached && cached.expiresAt > Date.now()) {
    const u = cached.user;
    if (!u || !u.isActive) return null;
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      role: safeRole(u.role),
      organizationId: u.organizationId,
    };
  }

  const user = await loadUser(session.userId);
  sessionCache.set(session.userId, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
  if (!user || !user.isActive) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: safeRole(user.role),
    organizationId: user.organizationId,
  };
}

/** Invalidate the cached user record (call after role changes or deactivation). */
export function invalidateSessionCache(userId?: string) {
  if (userId) sessionCache.delete(userId);
  else sessionCache.clear();
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Authentication required");
  return session;
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!allowed.includes(session.role)) {
    throw new HttpError(403, `Access denied for role ${session.role}`);
  }
  return session;
}

export const requireBidder = () => requireRole(["BIDDER"]);
export const requireOfficer = () => requireRole(OFFICER_ROLES);
export const requireDecisionRole = () => requireRole(DECISION_ROLES);
export const requireAdmin = () => requireRole(ADMIN_ROLES);
export const requireAuditRole = () => requireRole(AUDIT_ROLES);
