/**
 * Auth.js (NextAuth v5) configuration. Replaces Supabase Auth.
 *
 * - Drizzle adapter persists users/accounts (OAuth linking) in Turso.
 * - Providers: Google, GitHub, Twitter/X (each enabled only when its env keys
 *   are present) plus a bcrypt Credentials provider for local email/password.
 * - JWT session strategy (required when a Credentials provider is in play); the
 *   user id is threaded through the token so server code can read session.user.id.
 */
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Twitter from "next-auth/providers/twitter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import {
  isGitHubConfigured,
  isGoogleConfigured,
  isTwitterConfigured,
} from "@/lib/env";

const providers = [
  ...(isGoogleConfigured()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  ...(isGitHubConfigured()
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET,
          allowDangerousEmailAccountLinking: true,
          // Repo + user scope so the GitHub version-control integration can
          // read/write the user's creed.md.
          authorization: { params: { scope: "repo read:user" } },
        }),
      ]
    : []),
  ...(isTwitterConfigured()
    ? [
        Twitter({
          clientId: process.env.AUTH_TWITTER_ID,
          clientSecret: process.env.AUTH_TWITTER_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
  Credentials({
    id: "credentials",
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(raw) {
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const password = String(raw?.password ?? "");
      if (!email || !password) return null;

      const row = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();

      if (!row?.passwordHash) return null;

      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) return null;

      return {
        id: row.id,
        email: row.email,
        name: row.name,
        image: row.image,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = String(token.id);
      }
      return session;
    },
  },
});
