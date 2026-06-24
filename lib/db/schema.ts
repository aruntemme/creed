/**
 * Drizzle schema for Creed on Turso (libSQL / SQLite).
 *
 * This is the SQLite port of the former Supabase Postgres schema. Type mapping:
 *   uuid          -> text (app-generated via crypto.randomUUID())
 *   timestamptz   -> text (ISO-8601, matching the app's existing new Date().toISOString())
 *   jsonb         -> text with { mode: "json" }
 *   bigint        -> integer (SQLite stores 64-bit ints natively)
 *   numeric(12,6) -> real
 *   text[]        -> text with { mode: "json" } (string[])
 *
 * Row-Level Security is gone (SQLite has none). Per-user isolation is enforced
 * in the application layer via lib/db/scoped.ts — every user query must pass a
 * userId. The former service_role write paths (audit log, entitlements, credits,
 * oauth_*) use the unscoped `db` directly from trusted server code only.
 *
 * The three Postgres SECURITY DEFINER RPCs (increment_mcp_read, credit_topup,
 * debit_credits) are reimplemented as libSQL transactions in lib/db/rpc.ts.
 */
import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Shared helpers ------------------------------------------------------------

/** ISO-8601 timestamp column defaulting to now() at insert time. */
const nowText = (name: string) =>
  text(name)
    .notNull()
    .$defaultFn(() => new Date().toISOString());

// ── Auth.js (NextAuth) core tables ────────────────────────────────────────
// Compatible with @auth/drizzle-adapter's SQLite shape, plus a passwordHash
// column for the bcrypt Credentials provider (local email/password login).

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  // Local credentials login. NULL for OAuth-only accounts.
  passwordHash: text("passwordHash"),
  // Mirrors Supabase user_metadata.full_name / display name surface.
  createdAt: nowText("created_at"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
    index("accounts_user_idx").on(account.userId),
  ],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ── Creed application tables ──────────────────────────────────────────────

export const creedSections = sqliteTable(
  "creed_sections",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    accent: text("accent").notNull(),
    payload: text("payload", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    lastEditedBy: text("last_edited_by").notNull(),
    lastEditedType: text("last_edited_type").notNull(),
    lastEditedAt: nowText("last_edited_at"),
    revision: integer("revision").notNull().default(1),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
    agentWritable: integer("agent_writable", { mode: "boolean" })
      .notNull()
      .default(false),
    template: text("template").notNull().default("freeform"),
    agentPermission: text("agent_permission", {
      enum: ["hidden", "read-only", "propose", "direct"],
    })
      .notNull()
      .default("propose"),
    archivedAt: text("archived_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sectionId] }),
    index("creed_sections_user_position_idx").on(t.userId, t.position),
    index("creed_sections_template_idx").on(t.template),
  ],
);

export const creedProposals = sqliteTable(
  "creed_proposals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sectionId: text("section_id").notNull(),
    sectionName: text("section_name").notNull(),
    accent: text("accent").notNull(),
    agentName: text("agent_name").notNull(),
    changeType: text("change_type").notNull(),
    reason: text("reason").notNull(),
    impact: text("impact").notNull(),
    confidence: text("confidence").notNull(),
    draft: text("draft", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    status: text("status").notNull().default("pending"),
    baseRevision: integer("base_revision"),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    index("creed_proposals_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const creedActivity = sqliteTable(
  "creed_activity",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id").references(() => creedProposals.id, {
      onDelete: "set null",
    }),
    sectionId: text("section_id").notNull(),
    sectionName: text("section_name").notNull(),
    accent: text("accent").notNull(),
    actor: text("actor").notNull(),
    actorType: text("actor_type").notNull(),
    summary: text("summary").notNull(),
    status: text("status").notNull(),
    changeType: text("change_type").notNull(),
    reason: text("reason").notNull(),
    impact: text("impact").notNull(),
    confidence: text("confidence").notNull(),
    beforeText: text("before_text"),
    afterText: text("after_text").notNull(),
    createdAt: nowText("created_at"),
  },
  (t) => [index("creed_activity_user_created_idx").on(t.userId, t.createdAt)],
);

export const creedConnections = sqliteTable(
  "creed_connections",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: text("connection_id").notNull(),
    status: text("status").notNull().default("not-connected"),
    lastSeenAt: text("last_seen_at"),
    lastAgentName: text("last_agent_name"),
    observedVia: text("observed_via"),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.connectionId] }),
    index("creed_connections_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export const creedTokens = sqliteTable(
  "creed_tokens",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    readToken: text("read_token"),
    proposalToken: text("proposal_token"),
    directEditToken: text("direct_edit_token"),
    readTokenHash: text("read_token_hash"),
    proposalTokenHash: text("proposal_token_hash"),
    directEditTokenHash: text("direct_edit_token_hash"),
    encryptedReadToken: text("encrypted_read_token"),
    encryptedProposalToken: text("encrypted_proposal_token"),
    encryptedDirectEditToken: text("encrypted_direct_edit_token"),
    requireApproval: integer("require_approval", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    uniqueIndex("creed_tokens_read_token_hash_idx")
      .on(t.readTokenHash)
      .where(sql`${t.readTokenHash} is not null`),
    uniqueIndex("creed_tokens_proposal_token_hash_idx")
      .on(t.proposalTokenHash)
      .where(sql`${t.proposalTokenHash} is not null`),
    uniqueIndex("creed_tokens_direct_edit_token_hash_idx")
      .on(t.directEditTokenHash)
      .where(sql`${t.directEditTokenHash} is not null`),
  ],
);

export const creedMcpClients = sqliteTable(
  "creed_mcp_clients",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientName: text("client_name").notNull(),
    lastSeenAt: text("last_seen_at"),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.clientId] }),
    index("creed_mcp_clients_user_last_seen_idx").on(t.userId, t.lastSeenAt),
  ],
);

export const creedMcpReadEvents = sqliteTable(
  "creed_mcp_read_events",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    // Postgres `date`; stored as 'YYYY-MM-DD' text.
    day: text("day").notNull(),
    readCount: integer("read_count").notNull().default(0),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.clientId, t.day] }),
    index("creed_mcp_read_events_user_day_idx").on(t.userId, t.day),
  ],
);

export const creedIntegrations = sqliteTable(
  "creed_integrations",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("connected"),
    providerAccountId: text("provider_account_id"),
    providerLogin: text("provider_login"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: text("token_expires_at"),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.provider] }),
    index("creed_integrations_user_provider_idx").on(t.userId, t.provider),
  ],
);

export const creedVersionControl = sqliteTable("creed_version_control", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("github"),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  branch: text("branch"),
  path: text("path").notNull().default("creed.md"),
  lastRemoteSha: text("last_remote_sha"),
  lastRemoteMessage: text("last_remote_message"),
  lastRemoteCommittedAt: text("last_remote_committed_at"),
  lastSyncedContentHash: text("last_synced_content_hash"),
  syncStatus: text("sync_status").notNull().default("not-configured"),
  createdAt: nowText("created_at"),
  updatedAt: nowText("updated_at"),
});

export const creedAiSettings = sqliteTable("creed_ai_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("openrouter"),
  selectedModelId: text("selected_model_id").notNull(),
  encryptedApiKey: text("encrypted_api_key"),
  apiKeyLastFour: text("api_key_last_four"),
  keyStatus: text("key_status").notNull().default("missing"),
  aiMode: text("ai_mode", { enum: ["credits", "byok"] })
    .notNull()
    .default("credits"),
  lastValidatedAt: text("last_validated_at"),
  createdAt: nowText("created_at"),
  updatedAt: nowText("updated_at"),
});

export const creedAiUsage = sqliteTable(
  "creed_ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull().default("openrouter"),
    modelId: text("model_id").notNull(),
    modelQuality: text("model_quality").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    aiMode: text("ai_mode", { enum: ["credits", "byok"] })
      .notNull()
      .default("byok"),
    createdAt: nowText("created_at"),
  },
  (t) => [index("creed_ai_usage_user_created_idx").on(t.userId, t.createdAt)],
);

export const creedQualityReports = sqliteTable(
  "creed_quality_reports",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    modelId: text("model_id").notNull(),
    report: text("report", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: nowText("created_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    index("creed_quality_reports_user_hash_idx").on(t.userId, t.contentHash),
  ],
);

export const creedAuditLog = sqliteTable(
  "creed_audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    metadata: text("metadata", { mode: "json" })
      .notNull()
      .$type<Record<string, unknown>>()
      .default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: nowText("created_at"),
  },
  (t) => [
    index("creed_audit_log_user_id_created_at_idx").on(t.userId, t.createdAt),
    index("creed_audit_log_action_created_at_idx").on(t.action, t.createdAt),
  ],
);

export const creedEntitlements = sqliteTable(
  "creed_entitlements",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    plan: text("plan", { enum: ["personal", "company"] })
      .notNull()
      .default("personal"),
    billingMode: text("billing_mode", { enum: ["subscription", "lifetime"] })
      .notNull()
      .default("lifetime"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePriceId: text("stripe_price_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status", {
      enum: [
        "paid",
        "refunded",
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
      ],
    })
      .notNull()
      .default("paid"),
    currentPeriodEnd: text("current_period_end"),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    paidAt: nowText("paid_at"),
    updatedAt: nowText("updated_at"),
  },
  (t) => [
    uniqueIndex("creed_entitlements_subscription_id_key")
      .on(t.stripeSubscriptionId)
      .where(sql`${t.stripeSubscriptionId} is not null`),
    index("creed_entitlements_customer_id_idx")
      .on(t.stripeCustomerId)
      .where(sql`${t.stripeCustomerId} is not null`),
  ],
);

export const creedCredits = sqliteTable("creed_credits", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  balanceMicroUsd: integer("balance_micro_usd").notNull().default(0),
  createdAt: nowText("created_at"),
  updatedAt: nowText("updated_at"),
});

export const creedCreditTransactions = sqliteTable(
  "creed_credit_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["topup", "debit"] }).notNull(),
    amountMicroUsd: integer("amount_micro_usd").notNull(),
    balanceAfterMicroUsd: integer("balance_after_micro_usd").notNull(),
    feature: text("feature"),
    modelId: text("model_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
    createdAt: nowText("created_at"),
  },
  (t) => [
    index("creed_credit_transactions_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
  ],
);

// ── OAuth 2.1 authorization server (MCP) ──────────────────────────────────

export const oauthClients = sqliteTable("oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name").notNull().default("MCP Client"),
  redirectUris: text("redirect_uris", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default([]),
  createdAt: nowText("created_at"),
});

export const oauthAuthorizationCodes = sqliteTable(
  "oauth_authorization_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    scope: text("scope").notNull().default("read propose"),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: nowText("created_at"),
  },
  (t) => [index("oauth_authorization_codes_user_idx").on(t.userId)],
);

export const oauthTokens = sqliteTable(
  "oauth_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    clientId: text("client_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().default("read propose"),
    accessExpiresAt: text("access_expires_at").notNull(),
    refreshExpiresAt: text("refresh_expires_at").notNull(),
    revokedAt: text("revoked_at"),
    lastUsedAt: text("last_used_at"),
    createdAt: nowText("created_at"),
  },
  (t) => [
    uniqueIndex("oauth_tokens_access_hash_idx").on(t.accessTokenHash),
    uniqueIndex("oauth_tokens_refresh_hash_idx").on(t.refreshTokenHash),
    index("oauth_tokens_user_client_idx").on(t.userId, t.clientId),
  ],
);
