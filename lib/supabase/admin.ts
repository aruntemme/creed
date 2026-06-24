/**
 * Former Supabase service-role client. Now returns the libSQL-backed compat
 * client (unscoped — the same trust level the service_role key had). The name
 * is kept so the many `getSupabaseAdminClient()` call sites are untouched.
 */
import { createCompatClient } from "@/lib/db/supabase-compat";

export function getSupabaseAdminClient() {
  return createCompatClient();
}

export function isSupabaseAdminConfigured() {
  return true;
}
