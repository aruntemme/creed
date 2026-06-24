/**
 * Compatibility shim. The app moved off Supabase to Auth.js + Turso, but many
 * modules still import `getSiteUrl` / `isSupabaseConfigured` from this path.
 * These now delegate to lib/env.ts. "Configured" means auth is configured
 * (an AUTH_SECRET is set); email/password works in local dev with just that.
 */
export { getSiteUrl, isAuthConfigured } from "@/lib/env";
import { isAuthConfigured } from "@/lib/env";

/** @deprecated use isAuthConfigured(); kept for call-site compatibility. */
export function isSupabaseConfigured() {
  return isAuthConfigured();
}

/** @deprecated admin/data access is always available via Turso now. */
export function isSupabaseAdminConfigured() {
  return true;
}
