"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Single source of truth for "is the visitor signed in?" on marketing
// pages. Used by both the chrome header and the pricing card so they
// agree about visibility transitions during sign-in / sign-out without
// each spinning up its own auth listener. Backed by Auth.js useSession.
export type LandingAuthState = "loading" | "signed-in" | "signed-out";

// Last resolved value, kept at module scope so the header seeds from it on
// every client-side navigation instead of flashing back to "loading" and
// reflowing its buttons.
let cachedAuthState: LandingAuthState | null = null;

export function useLandingAuthState(configured: boolean = true): LandingAuthState {
  const { status } = useSession();
  const [authState, setAuthState] = useState<LandingAuthState>(
    cachedAuthState ?? (configured ? "loading" : "signed-out"),
  );

  useEffect(() => {
    if (!configured) {
      cachedAuthState = "signed-out";
      setAuthState("signed-out");
      return;
    }
    const next: LandingAuthState =
      status === "loading"
        ? "loading"
        : status === "authenticated"
          ? "signed-in"
          : "signed-out";
    cachedAuthState = next;
    setAuthState(next);
  }, [configured, status]);

  return authState;
}
