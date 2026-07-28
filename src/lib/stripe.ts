import Stripe from "stripe";

let stripe: Stripe | null = null;

// Lazy-Init: nur wenn STRIPE_SECRET_KEY gesetzt ist.
export function getStripe(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripe = new Stripe(key);
  return stripe;
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Plattform-Provision in Prozent (0 = keine).
export function platformFeePercent(): number {
  const v = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);
  return Number.isFinite(v) && v >= 0 && v < 100 ? v : 0;
}

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
