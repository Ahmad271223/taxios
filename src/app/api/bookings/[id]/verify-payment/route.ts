import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Verifiziert die Kartenzahlung direkt bei Stripe (Fallback ohne Webhook,
// z. B. in der lokalen Entwicklung). Wird von der Tracking-Seite nach dem
// Ruecksprung von Stripe-Checkout aufgerufen.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (booking.paid) return NextResponse.json({ paid: true });

  const stripe = getStripe();
  if (!stripe || !booking.stripeSessionId) return NextResponse.json({ paid: false });

  try {
    const session = await stripe.checkout.sessions.retrieve(booking.stripeSessionId);
    if (session.payment_status === "paid") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paid: true,
          paidAmount: (session.amount_total ?? 0) / 100,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });
      return NextResponse.json({ paid: true });
    }
  } catch (err: any) {
    console.error("Zahlungs-Verifikation Fehler:", err?.message ?? err);
  }
  return NextResponse.json({ paid: false });
}
