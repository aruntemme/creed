"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Client-side "is the current user paid?" hook.
//
// Reacts to auth changes via Auth.js useSession, then confirms paid status
// against /api/stripe/status. Result is cached in sessionStorage keyed by user
// id so back-and-forth navigation between marketing routes doesn't re-hit the
// endpoint.
//
// Returns:
//   "unknown" - auth state is still loading or we haven't asked yet.
//   "unpaid" - signed-out, or signed-in without a creed_entitlements row.
//   "paid"   - signed-in with an access-granting entitlement.

export type PaidStatus = "unknown" | "unpaid" | "paid";

const CACHE_PREFIX = "creed:paid-status:";

function readCache(userId: string): PaidStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${CACHE_PREFIX}${userId}`);
    if (raw === "paid" || raw === "unpaid") return raw;
    return null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, status: "paid" | "unpaid") {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${CACHE_PREFIX}${userId}`, status);
  } catch {
    // Storage may be disabled (private mode, quota); fail silently.
  }
}

function clearAllCache() {
  try {
    if (typeof window === "undefined") return;
    const toClear: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) toClear.push(key);
    }
    for (const key of toClear) window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Last resolved value, kept at module scope so the header seeds from it on
// every client-side navigation instead of flashing back to "unknown".
let cachedPaidStatus: PaidStatus | null = null;

export function usePaidStatus(configured: boolean = true): PaidStatus {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<PaidStatus>(cachedPaidStatus ?? "unknown");

  useEffect(() => {
    function commit(next: PaidStatus) {
      cachedPaidStatus = next;
      setStatus(next);
    }

    if (!configured) {
      commit("unpaid");
      return;
    }
    if (sessionStatus === "loading") return;

    let active = true;
    const userId = session?.user?.id ?? null;

    if (!userId) {
      // Clear ALL paid cache entries on sign-out so a shared browser doesn't
      // show "Owned" to whoever signs in next.
      clearAllCache();
      commit("unpaid");
      return;
    }

    const cached = readCache(userId);
    if (cached) commit(cached);

    (async () => {
      try {
        const res = await fetch("/api/stripe/status", {
          method: "GET",
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) {
          if (!cached) commit("unpaid");
          return;
        }
        const data = (await res.json()) as { paid?: boolean };
        const next: "paid" | "unpaid" = data.paid ? "paid" : "unpaid";
        writeCache(userId, next);
        commit(next);
      } catch {
        if (active && !cached) commit("unpaid");
      }
    })();

    return () => {
      active = false;
    };
  }, [configured, session?.user?.id, sessionStatus]);

  return status;
}
