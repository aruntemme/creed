/**
 * A thin libSQL-backed adapter implementing the exact subset of the
 * Supabase/PostgREST query-builder this codebase uses. It exists so the
 * carefully-written, already-user-scoped data layer (creed-backend, oauth,
 * ai/*, stripe, mcp-health, audit-log, github-version-control) keeps working
 * verbatim — only the client *factory* changes from Supabase to this.
 *
 * Supported surface (verified against the codebase):
 *   from(table)
 *     .select(cols?) .insert(v) .upsert(v,{onConflict}) .update(v) .delete()
 *     .eq .in .is .gte .order(col,{ascending}) .limit(n)
 *     .maybeSingle() .single()   ->  awaitable, resolves to { data, error }
 *   rpc(name, params)            ->  increment_mcp_read | debit_credits | credit_topup
 *   admin auth: getUserById | deleteUser | listUsers
 *
 * Per-user isolation: every user query in the data layer already passes an
 * explicit .eq("user_id", …) filter (the former dual RLS + filter design), so
 * this adapter preserves that isolation. The DB-level RLS backstop is gone;
 * the application filters are now the single enforcement layer.
 */
import { eq as dEq } from "drizzle-orm";
import type { InValue, Row } from "@libsql/client";
import { libsql, db } from "./client";
import { users } from "./schema";
import { incrementMcpRead, creditTopup, debitCredits } from "./rpc";

export type CompatResult<T = unknown> = {
  data: T | null;
  error: { message: string } | null;
};

// Columns stored as JSON text that must (de)serialize transparently, keyed by
// `${table}.${column}`.
const JSON_COLUMNS = new Set<string>([
  "creed_sections.payload",
  "creed_proposals.draft",
  "creed_quality_reports.report",
  "creed_quality_reports.section_hashes",
  "creed_audit_log.metadata",
  "oauth_clients.redirect_uris",
]);

// Columns the app treats as real booleans (SQLite stores 0/1).
const BOOL_COLUMNS = new Set<string>([
  "creed_sections.agent_writable",
  "creed_tokens.require_approval",
  "creed_entitlements.cancel_at_period_end",
]);

function encodeValue(table: string, col: string, value: unknown): InValue {
  if (value === undefined || value === null) return null;
  if (JSON_COLUMNS.has(`${table}.${col}`)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "bigint") return value;
  return String(value);
}

function decodeRow(table: string, row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const raw = (row as Record<string, unknown>)[key];
    const qualified = `${table}.${key}`;
    if (JSON_COLUMNS.has(qualified)) {
      out[key] =
        typeof raw === "string" && raw.length > 0 ? safeParse(raw) : raw;
    } else if (BOOL_COLUMNS.has(qualified)) {
      out[key] = raw === null || raw === undefined ? raw : Boolean(raw);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

type FilterOp = "eq" | "in" | "is" | "gte";
type Filter = { col: string; op: FilterOp; value: unknown };
type Mode = "select" | "insert" | "update" | "delete" | "upsert";

class QueryBuilder implements PromiseLike<CompatResult<unknown>> {
  private filters: Filter[] = [];
  private mode: Mode = "select";
  private selectCols = "*";
  private wantReturn = false;
  private values: Record<string, unknown>[] = [];
  private onConflict: string[] = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private singleMode: "none" | "maybe" | "single" = "none";

  constructor(private table: string) {}

  select(cols = "*", _options?: Record<string, unknown>) {
    if (this.mode === "select") {
      this.selectCols = cols === "*" ? "*" : cols;
    } else {
      // .insert(...).select() etc → return the affected rows.
      this.wantReturn = true;
      this.selectCols = cols === "*" ? "*" : cols;
    }
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.mode = "insert";
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string },
  ) {
    this.mode = "upsert";
    this.values = Array.isArray(values) ? values : [values];
    this.onConflict = (opts?.onConflict ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return this;
  }

  update(values: Record<string, unknown>) {
    this.mode = "update";
    this.values = [values];
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ col, op: "eq", value });
    return this;
  }
  in(col: string, value: unknown[]) {
    this.filters.push({ col, op: "in", value });
    return this;
  }
  is(col: string, value: null) {
    this.filters.push({ col, op: "is", value });
    return this;
  }
  gte(col: string, value: unknown) {
    this.filters.push({ col, op: "gte", value });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  single() {
    this.singleMode = "single";
    return this;
  }

  private buildWhere(args: InValue[]): string {
    if (this.filters.length === 0) return "";
    const clauses = this.filters.map((f) => {
      if (f.op === "is") return `"${f.col}" IS NULL`;
      if (f.op === "in") {
        const arr = (f.value as unknown[]) ?? [];
        if (arr.length === 0) return "0"; // matches nothing
        const placeholders = arr
          .map((v) => {
            args.push(encodeValue(this.table, f.col, v));
            return "?";
          })
          .join(", ");
        return `"${f.col}" IN (${placeholders})`;
      }
      const sqlOp = f.op === "gte" ? ">=" : "=";
      args.push(encodeValue(this.table, f.col, f.value));
      return `"${f.col}" ${sqlOp} ?`;
    });
    return ` WHERE ${clauses.join(" AND ")}`;
  }

  private buildSql(): { sql: string; args: InValue[] } {
    const args: InValue[] = [];
    const t = this.table;

    if (this.mode === "select") {
      let sql = `SELECT ${this.selectCols} FROM "${t}"`;
      sql += this.buildWhere(args);
      if (this.orderBy) {
        sql += ` ORDER BY "${this.orderBy.col}" ${this.orderBy.ascending ? "ASC" : "DESC"}`;
      }
      if (this.limitN != null) sql += ` LIMIT ${this.limitN}`;
      return { sql, args };
    }

    if (this.mode === "delete") {
      let sql = `DELETE FROM "${t}"`;
      sql += this.buildWhere(args);
      if (this.wantReturn) sql += " RETURNING *";
      return { sql, args };
    }

    if (this.mode === "update") {
      const row = this.values[0] ?? {};
      const cols = Object.keys(row);
      const setSql = cols
        .map((c) => {
          args.push(encodeValue(t, c, row[c]));
          return `"${c}" = ?`;
        })
        .join(", ");
      let sql = `UPDATE "${t}" SET ${setSql}`;
      sql += this.buildWhere(args);
      if (this.wantReturn) sql += " RETURNING *";
      return { sql, args };
    }

    // insert / upsert
    const cols = Object.keys(this.values[0] ?? {});
    const rowsSql = this.values
      .map((row) => {
        const placeholders = cols
          .map((c) => {
            args.push(encodeValue(t, c, row[c]));
            return "?";
          })
          .join(", ");
        return `(${placeholders})`;
      })
      .join(", ");
    const colList = cols.map((c) => `"${c}"`).join(", ");
    let sql = `INSERT INTO "${t}" (${colList}) VALUES ${rowsSql}`;
    if (this.mode === "upsert") {
      const conflictCols = this.onConflict.map((c) => `"${c}"`).join(", ");
      const updates = cols
        .filter((c) => !this.onConflict.includes(c))
        .map((c) => `"${c}" = excluded."${c}"`)
        .join(", ");
      sql += conflictCols
        ? updates
          ? ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`
          : ` ON CONFLICT (${conflictCols}) DO NOTHING`
        : "";
    }
    if (this.wantReturn) sql += " RETURNING *";
    return { sql, args };
  }

  private async run(): Promise<CompatResult<unknown>> {
    try {
      const { sql, args } = this.buildSql();
      const res = await libsql.execute({ sql, args });
      const rows = res.rows.map((r) => decodeRow(this.table, r));

      if (this.mode !== "select" && !this.wantReturn) {
        return { data: null, error: null };
      }
      if (this.singleMode === "maybe") {
        return { data: rows[0] ?? null, error: null };
      }
      if (this.singleMode === "single") {
        if (rows.length !== 1) {
          return {
            data: null,
            error: { message: `expected 1 row, got ${rows.length}` },
          };
        }
        return { data: rows[0], error: null };
      }
      return { data: rows, error: null };
    } catch (err) {
      return {
        data: null,
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  then<R1 = CompatResult<unknown>, R2 = never>(
    onFulfilled?:
      | ((value: CompatResult<unknown>) => R1 | PromiseLike<R1>)
      | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onFulfilled, onRejected);
  }
}

async function rpc(
  name: string,
  params: Record<string, unknown>,
): Promise<CompatResult<unknown>> {
  try {
    if (name === "increment_mcp_read") {
      await incrementMcpRead(
        String(params.p_user_id),
        String(params.p_client_id),
        String(params.p_day),
      );
      return { data: null, error: null };
    }
    if (name === "credit_topup") {
      const balance = await creditTopup(
        String(params.p_user_id),
        Number(params.p_amount_micro),
        String(params.p_payment_intent_id),
      );
      return { data: balance, error: null };
    }
    if (name === "debit_credits") {
      const balance = await debitCredits(
        String(params.p_user_id),
        Number(params.p_amount_micro),
        (params.p_feature as string) ?? null,
        (params.p_model_id as string) ?? null,
      );
      return { data: balance, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${name}` } };
  } catch (err) {
    return {
      data: null,
      error: { message: err instanceof Error ? err.message : String(err) },
    };
  }
}

// Supabase-User-compatible surface for admin lookups (no session needed).
async function hydrateUser(userId: string) {
  const row = await db.select().from(users).where(dEq(users.id, userId)).get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    user_metadata: {
      full_name: row.name ?? undefined,
      name: row.name ?? undefined,
      avatar_url: row.image ?? undefined,
    },
    identities: [],
  };
}

type ErrorOrNull = { message: string } | null;

const adminAuth = {
  async getUserById(
    userId: string,
  ): Promise<{ data: { user: Awaited<ReturnType<typeof hydrateUser>> }; error: ErrorOrNull }> {
    return { data: { user: await hydrateUser(userId) }, error: null };
  },
  async deleteUser(
    userId: string,
  ): Promise<{ data: { user: null }; error: ErrorOrNull }> {
    try {
      await db.delete(users).where(dEq(users.id, userId));
      return { data: { user: null }, error: null };
    } catch (err) {
      return {
        data: { user: null },
        error: { message: err instanceof Error ? err.message : String(err) },
      };
    }
  },
  async listUsers(
    _opts?: { page?: number; perPage?: number },
  ): Promise<{ data: { users: { id: string }[] }; error: ErrorOrNull }> {
    const rows = await db.select({ id: users.id }).from(users).all();
    return { data: { users: rows }, error: null };
  },
};

const authNamespace = {
  admin: adminAuth,
  async signOut(): Promise<{ error: ErrorOrNull }> {
    // Session is a stateless Auth.js JWT cookie; the route handler clears it.
    // Kept for call-site parity with the former Supabase client.
    return { error: null };
  },
};

export type CompatClient = {
  from: (table: string) => QueryBuilder;
  rpc: typeof rpc;
  auth: typeof authNamespace;
};

/** A data client with `.from`, `.rpc`, and admin auth lookups. */
export function createCompatClient(): CompatClient {
  return {
    from: (table: string) => new QueryBuilder(table),
    rpc,
    auth: authNamespace,
  };
}
