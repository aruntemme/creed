<div align="center">

# Creed

**One file across every agent.**

Your personal context, written once and kept polished by your agents — so every AI you talk to knows you instantly.

[Website](https://creed.md) · [Docs](https://creed.md/docs) · [Privacy](https://creed.md/privacy) · [Stack](https://creed.md/stack)

</div>

---

## What is Creed?

Anyone using AI seriously hits the same tax: re-explaining themselves every chat, every tool, every session.

Creed kills that tax with one file.

You write yourself down once — your role, goals, preferences, routines, the people who matter, anything you want every AI to know — and connected agents read that file before they answer you. As they learn new things about you, they propose updates. You approve the good ones. The file sharpens over time.

It's not a notes app. It's not a journal. It's not a memory dump. It's a curated personal-context profile, sized to fit on one page, that travels with you across Claude, ChatGPT, Codex, Cursor, OpenClaw, Hermes, OpenCode, and any custom agent you wire up.

---

## Why Creed exists

There's a small set of tools every AI-native person re-invents for themselves: a "system prompt" that grows in their notes, a `CLAUDE.md` they paste into every project, a list of "things ChatGPT keeps getting wrong about me." Creed is what happens when you decide that file should be **a real product**, not a hack.

The file is plain Markdown. The app exists to:

- help you write the first draft (4-vibe onboarding tuned to who you are)
- score quality and surface gaps (BYOK OpenRouter — never our tab)
- let agents read and propose updates without you copy-pasting
- keep one canonical version across every tool you use

If you've ever maintained a personal `creed.md` by hand, this is that, with the boring parts solved.

---

## How it works

```
┌──────────────────────┐         ┌────────────────────┐
│  You — onboarding    │ ──────► │  Your Creed file   │
│  (one short pass)    │         │  10 sections, MD   │
└──────────────────────┘         └─────────┬──────────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                  ┌─────────────────────┐    ┌──────────────────────┐
                  │  Agent reads it     │    │  Agent proposes an   │
                  │  before answering   │    │  update; you approve │
                  └─────────────────────┘    └──────────────────────┘
```

The file has 10 sections — five core, five optional — sized so the whole thing reads in under a minute:

| Always-on   | Optional      |
|-------------|---------------|
| Identity    | Beliefs       |
| Goals       | Constraints   |
| Work        | People        |
| Preferences | Health        |
| Routines    | Context       |

Every section is agent-writable. Every change goes through the review (or direct-edit, if you trust it).

---

## Status

Creed is in active development. Free while pricing is shaped around real user feedback. The likely paid tier later wraps heavy AI use (synthesis, quality, model spend) — but Creed will stay BYOK on AI, so you control the cost.

---

## Run it locally

You'll need:

- **Node.js 20+**
- **a Turso database** — or nothing at all locally: it defaults to an on-disk SQLite file (`file:./local.db`)
- **an OpenRouter API key** (only needed for the AI-powered features — onboarding synthesis, quality analysis, refinement)

Auth is handled by **Auth.js (NextAuth)** with email/password out of the box; Google / GitHub / X sign-in are optional and turn on when their env keys are present. The database is **Turso (libSQL)** via **Drizzle ORM**.

### 1. Clone and install

```bash
git clone https://github.com/<your-fork>/creed.git
cd creed
npm install
```

### 2. Configure environment

Copy the template and fill in values:

```bash
cp .env.example .env.local
```

`.env.example` documents every variable Creed reads. The minimum to boot the app:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
TURSO_DATABASE_URL=file:./local.db        # local SQLite file; or a libsql:// Turso URL
AUTH_SECRET=<base64-encoded-32-byte-secret>
CREED_ENCRYPTION_SECRET=<base64-encoded-32-byte-secret>
```

Generate each secret with `openssl rand -base64 32`. Add `AUTH_GOOGLE_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`, or `AUTH_TWITTER_ID/SECRET` to enable social sign-in (optional). Other optional vars (branding, Stripe, OpenRouter, feedback) are documented inline in `.env.example`.

### 3. Run database migrations

```bash
npm run db:migrate    # applies drizzle/ migrations to TURSO_DATABASE_URL
```

This creates every table Creed needs (Auth.js users/accounts/sessions, plus sections, proposals, activity, tokens, MCP, GitHub, AI usage, audit log, Stripe entitlements, and the OAuth-server tables). Per-user isolation — previously Postgres RLS — is enforced in the application data layer (every user query is scoped by `user_id`).

To regenerate migrations after editing `lib/db/schema.ts`, run `npm run db:generate`.

#### Seed a local account (optional)

```bash
npm run db:seed       # creates an email/password user + a lifetime entitlement
```

Prints the email/password to sign in with. Override via `SEED_EMAIL` / `SEED_PASSWORD` / `SEED_NAME`.

#### Migrating existing Supabase data (optional)

If you're moving off a previous Supabase deployment, set `SUPABASE_DB_URL` (Dashboard → Project Settings → Database) and run `npm run db:import` to copy every table into Turso. Note: Supabase password hashes can't be reused by Auth.js, so imported users sign in via OAuth or reset their password.

### 4. (Optional) Wire up Stripe

The hosted Creed gates `/file` and `/onboarding` behind a one-time $49 entitlement. For local development you can either:

- **Skip it** — leave `STRIPE_*` env vars unset. The app still boots; signed-in users without an entitlement row are redirected to `/pricing` by the layout guard. Useful when you only want to work on marketing pages or non-paid flows.
- **Run the full flow** — add the four `STRIPE_*` variables from `.env.example` using your sandbox/test keys, then in a second terminal run:
  ```bash
  stripe listen --forward-to localhost:3000/api/stripe/webhook
  ```
  Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. The webhook auto-grants entitlements when test payments complete.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google and you'll land on `/pricing` (or `/onboarding` if you've granted yourself an entitlement row manually for development).

### Deploying your own

If you're standing up a separate hosted Creed (not contributing back to this repo):

- Set `NEXT_PUBLIC_SITE_URL` to your deployed origin so OAuth callback and Stripe redirect URLs resolve correctly.
- Set `CREED_CSP_ENFORCE=1` in production once you've watched one deploy cycle in Report-Only mode.
- The Stripe webhook signing secret in production differs from your local `whsec_…` — create a webhook endpoint in the live Stripe dashboard pointing at `https://<your-domain>/api/stripe/webhook` and use that secret.
- The dormant example agent prompts in `lib/creed-data.ts` reference `https://creed.md` purely as illustration; real users see URLs derived from your `NEXT_PUBLIC_SITE_URL` at request time.

---

## Connect an agent

Once you have a Creed, open `/connections` and add the Creed MCP URL to your agent as a custom connector. The client opens a browser, you click **Allow** on the Creed consent screen, and it's connected. No tokens to copy. We have first-class flows for:

- Claude Code (a one-line `claude mcp add` command)
- Codex
- OpenClaw
- Hermes
- OpenCode
- Cursor (one-click "Add to Cursor")
- Custom Agent (any client that speaks MCP)

MCP uses OAuth 2.1: Creed is its own authorization server (`/authorize`, `/token`, `/register`, `/.well-known/*`), so any spec-compliant client connects from the server URL alone. The agent verifies it can read your file and starts shaping replies around it from the next message forward. For clients that don't speak MCP, the `/api/creed` HTTP API is the documented fallback.

---

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Tiptap** for the rich-text editor
- **Framer Motion** for the calmer-than-normal interactions
- **Auth.js (NextAuth)** for auth (email/password + Google/GitHub/X OAuth)
- **Turso (libSQL)** + **Drizzle ORM** for the database
- **OpenRouter** for BYOK AI

A complete tour of the public stack lives at [creed.md/stack](https://creed.md/stack).

---

## Repository tour

```
app/                    Next.js routes (marketing, app, API)
├── (creed-app)/        signed-in product (/file, /connections, /settings)
├── api/                session-authed and token-authed APIs
├── auth/callback/      OAuth callback
├── home/               public landing
├── onboarding/         7-step onboarding flow
└── proxy.ts            request-id + path-aware request forwarding

components/
├── creed/              the product UI
├── marketing/          the public site
├── auth/               sign-in / hero
└── ui/                 shadcn primitives + animated icons

lib/
├── creed-data.ts       types, section IDs, agent contract
├── creed-backend.ts    Creed reads/writes (via the libSQL data layer)
├── db/                 Drizzle schema, Turso client, RPC ports, compat layer
├── auth/               Auth.js session helpers
├── ai/                 OpenRouter, model catalog, quality
└── onboarding/         the synthesizer pipeline

auth.ts                 Auth.js (NextAuth) configuration
drizzle/                generated SQL migrations (canonical schema)
scripts/                seed + Supabase->Turso import
public/                 static assets
```

---

## Commands

```bash
npm run dev      # local dev server (Turbopack)
npm run build    # production build
npm run lint     # ESLint
npm run start    # serve a built app

npx tsc --noEmit -p .   # typecheck only
```

---

## Contributing

We'd love contributions. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a PR — it's short and saves both of us time.

If you're an AI agent picking up this codebase to make changes, read [`AGENTS.md`](./AGENTS.md) first instead. It's the same information, written for you.

---

## Security

Found a vulnerability? Please don't open a public issue. See [`SECURITY.md`](./SECURITY.md) for the responsible-disclosure path.

---

## License

[MIT](./LICENSE).
