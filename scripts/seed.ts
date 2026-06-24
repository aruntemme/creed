/**
 * Seed a local account so the app is usable immediately after the Turso
 * migration. Idempotent: re-running updates the password for the same email.
 *
 *   npm run db:seed
 *
 * Override the defaults with env vars:
 *   SEED_EMAIL=you@example.com SEED_PASSWORD=secret SEED_NAME="You" npm run db:seed
 *
 * The seeded user is granted a lifetime entitlement so the gated /file and
 * /onboarding routes are reachable in local dev without running Stripe.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, creedEntitlements } from "@/lib/db/schema";

async function main() {
  const email = (process.env.SEED_EMAIL ?? "praveensm890@gmail.com")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "creed-local-dev";
  const name = process.env.SEED_NAME ?? "Arun";

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({ passwordHash, name })
      .where(eq(users.id, userId));
    console.log(`Updated existing user ${email} (${userId})`);
  } else {
    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email,
      name,
      emailVerified: new Date(),
      passwordHash,
      createdAt: now,
    });
    console.log(`Created user ${email} (${userId})`);
  }

  // Lifetime entitlement so the gated app is reachable locally.
  await db
    .insert(creedEntitlements)
    .values({
      userId,
      email,
      plan: "personal",
      billingMode: "lifetime",
      stripeSessionId: `seed_${userId}`,
      stripePriceId: "seed_local",
      amountCents: 0,
      currency: "usd",
      status: "paid",
      paidAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  console.log("\nSeed complete. Sign in at /login with:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
