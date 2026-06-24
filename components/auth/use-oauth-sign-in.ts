"use client";

// Shared OAuth trigger for the marketing auth surface. Owns the one bit of
// real OAuth logic (kick off Auth.js OAuth with an optional post-login
// destination) so the chrome button and the /login + /signup screens don't
// each carry a copy.

import { useState } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

// "x" is the marketing label; Auth.js registers the provider as "twitter".
export type OAuthProvider = "google" | "x";

// Map our UI provider id to the Auth.js provider id.
const PROVIDER_ID: Record<OAuthProvider, string> = {
  google: "google",
  x: "twitter",
};

// Remember the last OAuth provider the user kicked off, so the auth screen can
// surface a "Last used" hint. Written at click time (before the redirect).
const LAST_PROVIDER_KEY = "creed:last-auth-provider";

export function readLastAuthProvider(): OAuthProvider | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(LAST_PROVIDER_KEY);
    return value === "google" || value === "x" ? value : null;
  } catch {
    return null;
  }
}

export function useOAuthSignIn(configured: boolean = true, redirectTo?: string) {
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider | null>(null);

  async function signInWith(provider: OAuthProvider) {
    if (!configured || pendingProvider) return;

    setPendingProvider(provider);
    try {
      window.localStorage.setItem(LAST_PROVIDER_KEY, provider);
    } catch {
      // Storage may be unavailable; the "Last used" hint is non-essential.
    }

    try {
      // Auth.js redirects the browser to the provider; control only returns
      // here if the handoff itself throws (e.g. provider not configured).
      await signIn(PROVIDER_ID[provider], { callbackUrl: redirectTo ?? "/" });
    } catch {
      setPendingProvider(null);
      toast.error("Could not start sign-in. Try again.");
    }
  }

  return { signIn: signInWith, pendingProvider };
}
