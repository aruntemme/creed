import { NextResponse } from "next/server";
import { getAuthenticatedUser, type SessionUser } from "@/lib/auth/session";
import { createCompatClient, type CompatClient } from "@/lib/db/supabase-compat";

export type AuthContext = {
  /** libSQL-backed compat client (was the Supabase server client). */
  supabase: CompatClient;
  user: SessionUser;
};

/**
 * Gate an API route on an authenticated session. Returns `{ supabase, user }`
 * or a 401 NextResponse. `supabase` is now the libSQL-backed compat client, so
 * existing route bodies that read `supabase.from(...)` keep working.
 */
export async function requireApiAuth(): Promise<AuthContext | NextResponse> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { supabase: createCompatClient(), user };
}
