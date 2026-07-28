import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe, appBaseUrl, platformFeePercent } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Erzeugt eine Stripe-Checkout-Session. Das Geld geht als Destination-Charge
// direkt an das verbundene Konto der Firma (abzueglich optionaler Plattform-Provision).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Kartenzahlung ist noch nicht eingerichtet." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { company: true },
  });
  if (!booking) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (booking.paid) return NextResponse.json({ paid: true });
  if (booking.status !== "ABGESCHLOSSEN") {
    return NextResponse.json({ error: "Zahlung ist erst nach Fahrtende möglich." }, { status: 400 });
  }

  const company = booking.company;
  if (!company.stripeAccountId || !company.stripeChargesEnabled) {
    return NextResponse.json({ error: "Diese Firma hat die Kartenzahlung noch nicht aktiviert." }, { status: 400 });
  }

  const amount = Math.round((booking.fare ?? booking.priceMax ?? 0) * 100);
  if (amount < 50) return NextResponse.json({ error: "Betrag zu gering" }, { status: 400 });
  const fee = Math.round((amount * platformFeePercent()) / 100);
  const base = appBaseUrl();

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Taxifahrt: ${booking.pickupAddress} → ${booking.destAddress}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        transfer_data: { destination: company.stripeAccountId },
        ...(fee > 0 ? { application_fee_amount: fee } : {}),
        description: `TaxiConnect Fahrt ${booking.id}`,
      },
      success_url: `${base}/verfolgen/${booking.id}?paid=1`,
      cancel_url: `${base}/verfolgen/${booking.id}?paid=0`,
      metadata: { bookingId: booking.id },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { stripeSessionId: checkout.id, paymentMethod: "KARTE" },
    });
    return NextResponse.json({ url: checkout.url });
  } catch (err: any) {
    console.error("Stripe Checkout Fehler:", err?.message ?? err);
    return NextResponse.json({ error: "Zahlung konnte nicht gestartet werden: " + (err?.message ?? "") }, { status: 500 });
  }
}
