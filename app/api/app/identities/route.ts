import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db/client";
import { accounts, users } from "@/lib/db/schema";

export const runtime = "nodejs";

// Auth.js provider id <-> the UI's provider label.
const UI_TO_AUTH: Record<string, string> = { x: "twitter" };

type LinkedIdentity = {
  provider: string;
  identity_data?: Record<string, unknown>;
};

/** List the signed-in user's linked sign-in identities (OAuth + email). */
export async function GET() {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, auth.user.id))
    .all();

  const identities: LinkedIdentity[] = rows.map((r) => ({
    provider: r.provider,
    identity_data: { email: auth.user.email ?? undefined },
  }));

  const userRow = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .get();
  if (userRow?.passwordHash) {
    identities.unshift({
      provider: "email",
      identity_data: { email: auth.user.email ?? undefined },
    });
  }

  return NextResponse.json({ identities });
}

/** Unlink an OAuth identity. Body: { provider }. Keeps >=1 sign-in method. */
export async function DELETE(request: Request) {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  const uiProvider = body.provider;
  if (!uiProvider) {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 });
  }
  const provider = UI_TO_AUTH[uiProvider] ?? uiProvider;

  const linked = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, auth.user.id))
    .all();

  const userRow = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .get();
  const methodCount = linked.length + (userRow?.passwordHash ? 1 : 0);
  if (methodCount <= 1) {
    return NextResponse.json(
      { error: "Add another sign-in method before disconnecting this one." },
      { status: 400 },
    );
  }

  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, auth.user.id), eq(accounts.provider, provider)));

  return NextResponse.json({ ok: true });
}
