import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Stripe-Webhook: bestaetigt Zahlungen und aktualisiert den Onboarding-Status.
// Endpoint bei Stripe registrieren: https://<domain>/api/stripe/webhook
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert" }, { status: 400 });
  }

  const sig = headers().get("stripe-signature") ?? "";
  const raw = await req.text(); // Rohtext fuer Signaturpruefung

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error("Stripe-Webhook Signatur ungültig:", err?.message);
    return NextResponse.json({ error: "Signatur ungültig" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const bookingId = s.metadata?.bookingId;
      if (bookingId) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paid: true,
            paidAmount: (s.amount_total ?? 0) / 100,
            stripePaymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : null,
          },
        });
      }
    } else if (event.type === "account.updated") {
      const acct = event.data.object;
      await prisma.company.updateMany({
        where: { stripeAccountId: acct.id },
        data: { stripeChargesEnabled: !!acct.charges_enabled },
      });
    }
  } catch (err: any) {
    console.error("Stripe-Webhook Verarbeitung Fehler:", err?.message ?? err);
  }

  return NextResponse.json({ received: true });
}
