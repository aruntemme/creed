// Shared credit configuration. Deliberately has neither "server-only" nor
// "use client", so the server-side billing (lib/ai/credits, lib/ai/persistence,
// the credits intent route) and the client UI (settings, add-credits dialog)
// read one source of truth.

// Markup applied to the real OpenRouter token cost when billing prepaid credits.
// BYOK is at-cost. Applied prospectively at deduction time, so changing it never
// re-prices an existing balance.
export const CREDIT_MARKUP = 1.5;

// Top-up bounds, in whole USD.
export const MIN_TOPUP_USD = 5;
export const MAX_TOPUP_USD = 500;

// Below this balance (USD), a successful credits-mode analysis warns the user.
export const LOW_BALANCE_USD = 0.5;
