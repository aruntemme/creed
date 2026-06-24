import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireApiAuth } from "@/lib/api-auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name || name.length > 200) {
    return NextResponse.json({ error: "Invalid display name" }, { status: 400 });
  }

  try {
    await db.update(users).set({ name }).where(eq(users.id, auth.user.id));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update profile." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    user: { name, email: auth.user.email ?? "" },
  });
}
