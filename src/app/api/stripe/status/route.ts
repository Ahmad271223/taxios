import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getStripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json({ configured: false, connected: false, chargesEnabled: false });
  }

  const company = await prisma.company.findUnique({ where: { id: session.companyId } });
  if (!company?.stripeAccountId) {
    return NextResponse.json({ configured: true, connected: false, chargesEnabled: false });
  }

  const stripe = getStripe();
  try {
    const acct = await stripe!.accounts.retrieve(company.stripeAccountId);
    const chargesEnabled = !!acct.charges_enabled;
    if (chargesEnabled !== company.stripeChargesEnabled) {
      await prisma.company.update({ where: { id: company.id }, data: { stripeChargesEnabled: chargesEnabled } });
    }
    return NextResponse.json({
      configured: true,
      connected: true,
      chargesEnabled,
      detailsSubmitted: !!acct.details_submitted,
      accountId: company.stripeAccountId,
    });
  } catch (err: any) {
    return NextResponse.json({ configured: true, connected: true, chargesEnabled: false, error: err?.message });
  }
}
