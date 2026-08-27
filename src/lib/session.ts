"use client";

/**
 * Shared client-side session store.
 *
 * Every surface (UserNav, AppShell, ChatBot, dashboards) used to call
 * /api/auth/me independently — 4-5 identical requests per page load, each
 * triggering two database round-trips. This module:
 *   1. de-duplicates concurrent fetches into a single request
 *   2. caches the result for 60s per tab (sessionStorage)
 *   3. exposes a tiny subscription API + React hook (useSession)
 *
 * Auth-decision safety: a cached value is trusted immediately only when it is
 * a logged-in user. A cached "logged-out" (null) never blocks revalidation —
 * ensureValidated() performs one real fetch per page load, so flows where the
 * cookie is set server-side (Google OAuth callback, demo login) are picked up
 * automatically.
 */

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  organization?: { id: string; legalName: string } | null;
  unreadNotifications?: number;
}

const CACHE_KEY = "absar.session.v1";
const FRESH_MS = 60_000;

interface CacheBox {
  user: SessionUser | null;
  ts: number;
}

type Listener = (user: SessionUser | null) => void;

let inflight: Promise<SessionUser | null> | null = null;
let validatedThisLoad = false;
let lastResult: SessionUser | null | undefined = undefined; // undefined = not fetched yet this load
const listeners = new Set<Listener>();

function readCache(): CacheBox | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const box = JSON.parse(raw) as CacheBox;
    if (!box || typeof box.ts !== "number") return null;
    return box;
  } catch {
    return null;
  }
}

function writeCache(user: SessionUser | null) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ user, ts: Date.now() } satisfies CacheBox));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

function emit(user: SessionUser | null) {
  for (const fn of listeners) fn(user);
}

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const res = await fetch("/api/auth/me");
    const json = await res.json();
    const user = json.ok && json.data ? (json.data as SessionUser) : null;
    writeCache(user);
    lastResult = user;
    emit(user);
    return user;
  } catch {
    lastResult = null;
    emit(null);
    return null;
  }
}

/** Subscribe to session changes; returns unsubscribe. */
export function onSession(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Returns a fresh cached user instantly, or null.
 * A non-null return means "definitely logged in" (<60s old).
 */
export function peekFreshUser(): SessionUser | null {
  const box = readCache();
  if (box?.user && Date.now() - box.ts < FRESH_MS) return box.user;
  return null;
}

/**
 * Best-known session for this page load:
 *   - fresh cached user, else
 *   - result of the last completed validation fetch, else
 *   - undefined when nothing has been decided yet (caller should wait).
 */
export function currentSnapshot(): SessionUser | null | undefined {
  const fresh = peekFreshUser();
  if (fresh) return fresh;
  return lastResult;
}

/**
 * One real network validation per page load. Instant when the cache already
 * holds a fresh logged-in user; otherwise fires a single deduped request whose
 * result is broadcast via onSession listeners.
 */
export function ensureValidated(): void {
  if (validatedThisLoad) {
    // Still make sure an inflight fetch exists when nothing usable is cached.
    const box = readCache();
    if ((!box || (!box.user && Date.now() - box.ts >= FRESH_MS)) && !inflight) {
      inflight = fetchMe().finally(() => { inflight = null; });
    }
    return;
  }
  validatedThisLoad = true;
  const box = readCache();
  const hasFreshUser = Boolean(box?.user && Date.now() - box.ts < FRESH_MS);
  if (!hasFreshUser && !inflight) {
    inflight = fetchMe().finally(() => { inflight = null; });
  }
}

/**
 * Await the session: fresh cached user resolves instantly, otherwise waits for
 * the shared network fetch. Used by non-critical consumers (ChatBot).
 */
export function getSessionClient(): Promise<SessionUser | null> {
  const fresh = peekFreshUser();
  if (fresh) return Promise.resolve(fresh);
  if (!inflight) {
    inflight = fetchMe().finally(() => { inflight = null; });
  }
  return inflight;
}

/** Force refresh (after profile changes etc.). */
export async function refreshSession(): Promise<SessionUser | null> {
  return fetchMe();
}

/** Clear the local cache without touching the server cookie
 *  (call right before redirecting after a successful login). */
export function clearSessionCache(): void {
  writeCache(null);
  emit(null);
}

/** Clear local cache and drop the server cookie. */
export async function signOut(): Promise<void> {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  writeCache(null);
  emit(null);
}
