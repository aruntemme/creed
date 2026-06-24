/**
 * Environment helpers. Replaces lib/supabase/env.ts. getSiteUrl() keeps the
 * same contract the rest of the app relies on (OAuth callbacks, Stripe
 * redirects, agent read URLs).
 */
export function getSiteUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return configuredSiteUrl;
  }

  // Development convenience only. Production must set NEXT_PUBLIC_SITE_URL
  // explicitly - there's no hardcoded production fallback so forks can't
  // accidentally leak OAuth callbacks / API URLs to the upstream domain.
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not set. Set it to the deployed origin (e.g. https://your-deploy.vercel.app) so OAuth callbacks, Stripe redirects, and agent read URLs resolve correctly.",
  );
}

/** Whether Google OAuth is configured. */
export function isGoogleConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

/** Whether GitHub OAuth is configured. */
export function isGitHubConfigured() {
  return Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
}

/** Whether Twitter/X OAuth is configured. */
export function isTwitterConfigured() {
  return Boolean(
    process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET,
  );
}

/**
 * The app is "auth configured" whenever NextAuth has a secret. Email/password
 * (Credentials) works with just a secret + the Turso DB, so this stays true in
 * local dev even without any OAuth provider keys.
 */
export function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
}
