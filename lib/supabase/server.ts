/**
 * Former Supabase server (cookie-bound) client. Now returns the libSQL-backed
 * compat client with a session-aware `auth.getUser()` powered by Auth.js, so
 * the routes/pages that call `createSupabaseServerClient()` for both auth and
 * data keep working unchanged. getAuthenticatedUser re-exports the canonical
 * session helper.
 */
import { createCompatClient } from "@/lib/db/supabase-compat";
import { getAuthenticatedUser } from "@/lib/auth/session";

export async function createSupabaseServerClient() {
  const client = createCompatClient();
  return {
    ...client,
    auth: {
      ...client.auth,
      getUser: async () => {
        const user = await getAuthenticatedUser();
        return { data: { user }, error: null };
      },
    },
  };
}

export { getAuthenticatedUser };
