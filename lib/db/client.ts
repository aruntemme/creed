/**
 * Turso (libSQL) connection + Drizzle handle.
 *
 * `db` is the unscoped handle. For user-facing reads/writes prefer the scoped
 * helpers in lib/db/scoped.ts, which enforce per-user isolation now that
 * Postgres RLS is gone. Use `db` directly only from trusted server contexts
 * (webhooks, the OAuth server, audit logging) — the same paths that used the
 * Supabase service-role client before.
 *
 * Local dev points TURSO_DATABASE_URL at a file: URL (e.g. file:./local.db);
 * production points it at the libsql://<db>.turso.io URL with TURSO_AUTH_TOKEN.
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

declare global {
  // Reuse a single client across HMR reloads in dev.
  var __creedLibsql: Client | undefined;
}

function resolveUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (url && url.length > 0) return url;
  // Sensible default for local dev so the app boots without extra config.
  return "file:./local.db";
}

export const libsql: Client =
  globalThis.__creedLibsql ??
  createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__creedLibsql = libsql;
}

export const db: LibSQLDatabase<typeof schema> = drizzle(libsql, { schema });

export { schema };
export type Db = typeof db;
