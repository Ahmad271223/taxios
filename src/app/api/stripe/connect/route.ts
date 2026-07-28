import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getStripe, appBaseUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Startet das Stripe-Connect-Onboarding fuer die eingeloggte Firma.
export async function POST() {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe ist nicht konfiguriert (STRIPE_SECRET_KEY fehlt)." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (!company) return NextResponse.json({ error: "Firma nicht gefunden" }, { status: 404 });

  let accountId = company.stripeAccountId;
  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "DE",
        email: company.email,
        business_type: "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { companyId: company.id },
      });
      accountId = account.id;
      await prisma.company.update({ where: { id: company.id }, data: { stripeAccountId: accountId } });
    }

    const base = appBaseUrl();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/admin/zahlungen?refresh=1`,
      return_url: `${base}/admin/zahlungen?return=1`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: link.url });
  } catch (err: any) {
    console.error("Stripe connect Fehler:", err?.message ?? err);
    return NextResponse.json({ error: "Stripe-Onboarding fehlgeschlagen: " + (err?.message ?? "") }, { status: 500 });
  }
}
