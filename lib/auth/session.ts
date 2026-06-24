/**
 * Session helpers bridging Auth.js to the shape the rest of the app expects.
 *
 * The codebase was written against Supabase's `User` object, reading `user.id`,
 * `user.email`, `user.user_metadata` (display name), and `user.identities`
 * (linked OAuth providers). To keep the blast radius small we expose a
 * `SessionUser` with the same surface, hydrated from Auth.js + the Drizzle
 * `users`/`accounts` tables. Replaces lib/supabase/server.ts.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users, accounts } from "@/lib/db/schema";

export type SessionIdentity = {
  provider: string;
  identity_data?: Record<string, unknown>;
};

export type SessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  identities: SessionIdentity[];
};

/** Build the Supabase-compatible user surface from the users/accounts tables. */
async function hydrateUser(userId: string): Promise<SessionUser | null> {
  const row = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (!row) return null;

  const linked = await db
    .select({
      provider: accounts.provider,
      providerAccountId: accounts.providerAccountId,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  const identities: SessionIdentity[] = linked.map((a) => ({
    provider: a.provider,
    identity_data: {
      provider_account_id: a.providerAccountId,
      email: row.email ?? undefined,
    },
  }));

  // A password account presents as an "email" identity for parity with the
  // old Supabase email provider surface.
  if (row.passwordHash) {
    identities.unshift({
      provider: "email",
      identity_data: { email: row.email ?? undefined },
    });
  }

  return {
    id: row.id,
    email: row.email,
    user_metadata: {
      full_name: row.name ?? undefined,
      name: row.name ?? undefined,
      avatar_url: row.image ?? undefined,
    },
    identities,
  };
}

/** Current authenticated user, or null. Replaces Supabase getAuthenticatedUser. */
export async function getAuthenticatedUser(): Promise<SessionUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return hydrateUser(userId);
}

/** Look up any user by id (replaces admin.auth.admin.getUserById). */
export async function getUserById(
  userId: string,
): Promise<SessionUser | null> {
  return hydrateUser(userId);
}
