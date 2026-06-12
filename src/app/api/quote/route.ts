import { NextResponse } from "next/server";
import { estimatePriceWith } from "@/lib/geo";
import { pricingForSlug } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const { from, to, company } = body ?? {};
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) {
    return NextResponse.json({ error: "Start- und Zielkoordinaten erforderlich" }, { status: 400 });
  }
  const pricing = await pricingForSlug(company);
  const estimate = await estimatePriceWith(
    { lat: Number(from.lat), lng: Number(from.lng) },
    { lat: Number(to.lat), lng: Number(to.lng) },
    pricing,
  );
  return NextResponse.json(estimate);
}
