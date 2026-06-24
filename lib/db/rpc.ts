/**
 * TypeScript ports of the three Postgres SECURITY DEFINER RPCs that previously
 * lived in the Supabase schema. SQLite has no stored procedures, so each is
 * reimplemented as an atomic libSQL transaction. These are trusted server-side
 * functions — the equivalent of the old service-role-only EXECUTE grant — and
 * must never be called with a userId taken directly from an untrusted client.
 */
import { sql } from "drizzle-orm";
import { db } from "./client";

/**
 * Atomic upsert-increment of one MCP read for (user, client, day).
 * Port of public.increment_mcp_read(uuid, text, date).
 */
export async function incrementMcpRead(
  userId: string,
  clientId: string,
  day: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.run(sql`
    insert into creed_mcp_read_events (user_id, client_id, day, read_count, created_at, updated_at)
    values (${userId}, ${clientId}, ${day}, 1, ${now}, ${now})
    on conflict (user_id, client_id, day)
    do update set
      read_count = creed_mcp_read_events.read_count + 1,
      updated_at = ${now}
  `);
}

/**
 * Idempotent money-in. Port of public.credit_topup(uuid, bigint, text).
 * The ledger row is inserted first with a unique stripe_payment_intent_id; a
 * redelivered Stripe event no-ops and returns the unchanged balance. Returns
 * the resulting balance in micro-USD.
 */
export async function creditTopup(
  userId: string,
  amountMicro: number,
  paymentIntentId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date().toISOString();

    const inserted = await tx.run(sql`
      insert into creed_credit_transactions
        (id, user_id, type, amount_micro_usd, balance_after_micro_usd, stripe_payment_intent_id, created_at)
      values
        (${crypto.randomUUID()}, ${userId}, 'topup', ${amountMicro}, 0, ${paymentIntentId}, ${now})
      on conflict (stripe_payment_intent_id) do nothing
    `);

    if (inserted.rowsAffected === 0) {
      // Duplicate delivery: already credited. Return current balance untouched.
      const cur = await tx.get<{ balance_micro_usd: number }>(sql`
        select balance_micro_usd from creed_credits where user_id = ${userId}
      `);
      return cur?.balance_micro_usd ?? 0;
    }

    await tx.run(sql`
      insert into creed_credits (user_id, balance_micro_usd, created_at, updated_at)
      values (${userId}, ${amountMicro}, ${now}, ${now})
      on conflict (user_id) do update
        set balance_micro_usd = creed_credits.balance_micro_usd + excluded.balance_micro_usd,
            updated_at = ${now}
    `);

    const row = await tx.get<{ balance_micro_usd: number }>(sql`
      select balance_micro_usd from creed_credits where user_id = ${userId}
    `);
    const balance = row?.balance_micro_usd ?? 0;

    await tx.run(sql`
      update creed_credit_transactions
        set balance_after_micro_usd = ${balance}
        where stripe_payment_intent_id = ${paymentIntentId}
    `);

    return balance;
  });
}

/**
 * Atomic money-out. Port of public.debit_credits(uuid, bigint, text, text).
 * The caller gates on balance > 0 before the AI call; the post-call debit may
 * leave the balance slightly negative on the last run (next call is blocked).
 * Returns the resulting balance in micro-USD.
 */
export async function debitCredits(
  userId: string,
  amountMicro: number,
  feature: string | null,
  modelId: string | null,
): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date().toISOString();

    await tx.run(sql`
      insert into creed_credits (user_id, balance_micro_usd, created_at, updated_at)
      values (${userId}, ${-amountMicro}, ${now}, ${now})
      on conflict (user_id) do update
        set balance_micro_usd = creed_credits.balance_micro_usd - ${amountMicro},
            updated_at = ${now}
    `);

    const row = await tx.get<{ balance_micro_usd: number }>(sql`
      select balance_micro_usd from creed_credits where user_id = ${userId}
    `);
    const balance = row?.balance_micro_usd ?? 0;

    await tx.run(sql`
      insert into creed_credit_transactions
        (id, user_id, type, amount_micro_usd, balance_after_micro_usd, feature, model_id, created_at)
      values
        (${crypto.randomUUID()}, ${userId}, 'debit', ${amountMicro}, ${balance}, ${feature}, ${modelId}, ${now})
    `);

    return balance;
  });
}
