"use client";

import { useEffect, useState } from "react";
import {
  currentSnapshot,
  ensureValidated,
  onSession,
  type SessionUser,
} from "@/lib/session";

/**
 * React hook for the shared session store.
 *
 * - Renders a cached logged-in user instantly (no loading flash on dashboards).
 * - Otherwise waits for the shared network validation before reporting ready,
 *   so protected shells (AppShell) never bounce a just-logged-in user.
 * - Late-mounting components read the snapshot of an already-completed fetch
 *   instead of waiting forever for an emission that already happened.
 */
export function useSession(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    // Snapshot path: covers fresh cache AND results from a validation that
    // completed before this component mounted.
    const snap = currentSnapshot();
    if (snap !== undefined) {
      setUser(snap);
      setLoading(false);
    }

    // Network truth arrives via the shared store.
    const unsubscribe = onSession((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });

    ensureValidated();

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
