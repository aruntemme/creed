import { NextResponse } from "next/server";
import { getCreditsState } from "@/lib/ai/credits";
import { requireApiAuth } from "@/lib/api-auth";

// Balance + recent ledger for the settings credits card. Read via the user's
// session client (RLS select-own); doubles as the "did my top-up land yet?"
// poll after a Payment Element confirmation.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const auth = await requireApiAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const credits = await getCreditsState(auth.supabase, auth.user.id);
    return NextResponse.json({ credits }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load credits." },
      { status: 400 }
    );
  }
}
