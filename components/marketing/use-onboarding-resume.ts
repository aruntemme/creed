"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// True when the signed-in user has already started onboarding (a Creed exists
// server-side: seed claimed or composed), so marketing CTAs can offer "Resume"
// instead of "Get Started". Server-backed via /api/app/onboarding-status, so
// it's correct on any device. Reacts to auth changes via Auth.js useSession.

// Last resolved value, kept at module scope so the CTA label seeds from it on
// every client-side navigation instead of flipping "Resume" -> "Get Started"
// and reflowing the button.
let cachedCanResume = false;

export function useOnboardingResume(configured: boolean = true): boolean {
  const { data: session, status } = useSession();
  const [canResume, setCanResume] = useState(cachedCanResume);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const userId = session?.user?.id ?? null;

    if (!userId) {
      cachedCanResume = false;
      setCanResume(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/app/onboarding-status", {
          method: "GET",
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) {
          cachedCanResume = false;
          setCanResume(false);
          return;
        }
        const data = (await res.json()) as { started?: boolean };
        cachedCanResume = Boolean(data.started);
        if (active) setCanResume(cachedCanResume);
      } catch {
        if (active) {
          cachedCanResume = false;
          setCanResume(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [configured, session?.user?.id, status]);

  return canResume;
}
