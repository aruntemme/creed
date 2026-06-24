/**
 * One-off data migration: Supabase Postgres -> Turso (libSQL).
 *
 *   SUPABASE_DB_URL="postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres" \
 *   TURSO_DATABASE_URL="file:./local.db" \
 *   npm run db:import
 *
 * Reads from a live Supabase database (the connection string is in
 * Supabase Dashboard -> Project Settings -> Database) and writes every row into
 * the already-migrated Turso schema. Idempotent per row via INSERT OR REPLACE.
 *
 * Caveats:
 *  - Supabase auth passwords are bcrypt-hashed in auth.users with Supabase's own
 *    salt and CANNOT be re-used by Auth.js Credentials. Imported users get a
 *    NULL passwordHash: they sign in via OAuth, or set a password via reset.
 *  - auth.identities -> accounts is best-effort (provider + provider id), enough
 *    for the settings "linked accounts" view and OAuth re-login.
 */
import { Client as Pg } from "pg";
import { createClient } from "@libsql/client";

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
if (!SUPABASE_DB_URL) {
  console.error("Set SUPABASE_DB_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Tables copied verbatim (column names already match the Drizzle schema).
// `bigint` columns are listed so all-digit strings from pg become numbers.
const TABLES: { name: string; bigint?: string[] }[] = [
  { name: "creed_sections" },
  { name: "creed_proposals" },
  { name: "creed_activity" },
  { name: "creed_connections" },
  { name: "creed_tokens" },
  { name: "creed_mcp_clients" },
  { name: "creed_mcp_read_events" },
  { name: "creed_integrations" },
  { name: "creed_version_control" },
  { name: "creed_ai_settings" },
  { name: "creed_ai_usage" },
  { name: "creed_quality_reports" },
  { name: "creed_audit_log" },
  { name: "creed_entitlements" },
  { name: "creed_credits", bigint: ["balance_micro_usd"] },
  {
    name: "creed_credit_transactions",
    bigint: ["amount_micro_usd", "balance_after_micro_usd"],
  },
  { name: "oauth_clients" },
  { name: "oauth_authorization_codes" },
  { name: "oauth_tokens" },
];

function encode(value: unknown, bigintCols: Set<string>, col: string): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  if (bigintCols.has(col) && typeof value === "string" && /^-?\d+$/.test(value)) {
    return Number(value);
  }
  return value as string | number;
}

async function copyTable(pg: Pg, name: string, bigint: string[] = []) {
  const bigintCols = new Set(bigint);
  let rows: Record<string, unknown>[];
  try {
    const res = await pg.query(`select * from public."${name}"`);
    rows = res.rows;
  } catch (err) {
    console.warn(`  skip ${name}: ${(err as Error).message}`);
    return;
  }
  if (rows.length === 0) {
    console.log(`  ${name}: 0 rows`);
    return;
  }
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO "${name}" (${colList}) VALUES (${placeholders})`;

  const stmts = rows.map((row) => ({
    sql,
    args: cols.map((c) => encode(row[c], bigintCols, c) as never),
  }));
  await turso.batch(stmts, "write");
  console.log(`  ${name}: ${rows.length} rows`);
}

async function copyUsers(pg: Pg) {
  // auth.users -> users
  const users = await pg.query(
    `select id, email, raw_user_meta_data, created_at from auth.users`,
  );
  const userStmts = users.rows.map((u) => {
    const meta = (u.raw_user_meta_data ?? {}) as Record<string, unknown>;
    const name = (meta.full_name ?? meta.name ?? null) as string | null;
    const image = (meta.avatar_url ?? meta.picture ?? null) as string | null;
    return {
      sql: `INSERT OR REPLACE INTO "users" ("id","email","name","image","emailVerified","passwordHash","created_at") VALUES (?,?,?,?,?,?,?)`,
      args: [
        u.id,
        u.email ?? null,
        name,
        image,
        u.created_at ? new Date(u.created_at).getTime() : null,
        null, // passwords can't migrate from Supabase
        u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
      ] as never[],
    };
  });
  if (userStmts.length) await turso.batch(userStmts, "write");
  console.log(`  users: ${users.rows.length} rows`);

  // auth.identities -> accounts (best-effort)
  try {
    const ids = await pg.query(
      `select user_id, provider, identity_data, provider_id from auth.identities`,
    );
    const accStmts = ids.rows
      .map((i) => {
        const data = (i.identity_data ?? {}) as Record<string, unknown>;
        const providerAccountId = String(
          i.provider_id ?? data.sub ?? data.provider_id ?? data.id ?? "",
        );
        if (!providerAccountId) return null;
        return {
          sql: `INSERT OR REPLACE INTO "accounts" ("userId","type","provider","providerAccountId") VALUES (?,?,?,?)`,
          args: [i.user_id, "oauth", i.provider, providerAccountId] as never[],
        };
      })
      .filter(Boolean) as { sql: string; args: never[] }[];
    if (accStmts.length) await turso.batch(accStmts, "write");
    console.log(`  accounts: ${accStmts.length} rows`);
  } catch (err) {
    console.warn(`  skip accounts: ${(err as Error).message}`);
  }
}

async function main() {
  const pg = new Pg({ connectionString: SUPABASE_DB_URL });
  await pg.connect();
  console.log("Connected to Supabase. Copying into Turso...\n");

  // Users first so creed_* foreign keys resolve.
  await copyUsers(pg);
  for (const t of TABLES) {
    await copyTable(pg, t.name, t.bigint);
  }

  await pg.end();
  console.log("\nImport complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
