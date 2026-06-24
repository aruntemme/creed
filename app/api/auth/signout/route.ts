import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/auth";

// Sign-out endpoint.
//
// Auth.js owns the session cookie (a stateless JWT). We call its signOut to
// clear it, then belt-and-braces sweep any auth cookie we can see so shared
// browsers are left in a known-clean state — covering Auth.js's authjs.* /
// __Secure-/__Host- prefixed variants plus any legacy Supabase sb-* cookies.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await signOut({ redirect: false });

  const origin = new URL(request.url).origin;
  const response = NextResponse.json({ ok: true, redirectTo: `${origin}/` });

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("authjs.") ||
      cookie.name.includes("next-auth.")
    ) {
      response.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }

  // Avoid any intermediary caching a "logged out" response and serving it
  // to a future request that still has a valid session.
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}
