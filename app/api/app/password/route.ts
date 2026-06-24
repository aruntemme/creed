import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Set/change the password for the signed-in user. Replaces the former Supabase
 * updateUser({ password }) call used by the reset-password screen.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";
  if (password.length < 8) {
    return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, auth.user.id));

  return NextResponse.json({ ok: true });
}
