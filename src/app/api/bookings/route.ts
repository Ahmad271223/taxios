import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { estimatePriceWith } from "@/lib/geo";
import { getDispatcher } from "@/server/runtime";
import { bookingDTO } from "@/server/serialize";

export const dynamic = "force-dynamic";

const point = z.object({ lat: z.number(), lng: z.number() });

const schema = z.object({
  company: z.string().min(1), // Firmen-Slug
  customerName: z.string().min(1),
  customerPhone: z.string().min(3),
  pickupAddress: z.string().min(1),
  pickup: point,
  destAddress: z.string().min(1),
  dest: point,
  passengers: z.number().int().min(1).max(8).optional(),
  luggage: z.boolean().optional(),
  childSeat: z.boolean().optional(),
  notes: z.string().max(500).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export async function POST(req: Request) {
  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte alle Pflichtfelder ausfüllen", details: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const company = await prisma.company.findUnique({
    where: { slug: d.company },
    include: { pricing: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Unbekanntes Unternehmen" }, { status: 404 });
  }

  const pricing = (company.pricing as any) ?? undefined;
  const estimate = await estimatePriceWith(d.pickup, d.dest, pricing);

  const scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
  const isScheduled = !!scheduledAt && scheduledAt.getTime() > Date.now() + 60_000;

  const booking = await prisma.booking.create({
    data: {
      companyId: company.id,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      pickupAddress: d.pickupAddress,
      pickupLat: d.pickup.lat,
      pickupLng: d.pickup.lng,
      destAddress: d.destAddress,
      destLat: d.dest.lat,
      destLng: d.dest.lng,
      passengers: d.passengers ?? 1,
      luggage: d.luggage ?? false,
      childSeat: d.childSeat ?? false,
      notes: d.notes ?? null,
      isScheduled,
      scheduledAt,
      distanceMeters: estimate.distanceMeters,
      durationSeconds: estimate.durationSeconds,
      priceMin: estimate.priceMin,
      priceMax: estimate.priceMax,
      tariff: estimate.tariff,
      status: "OFFEN",
      trackingStatus: isScheduled ? "GEPLANT" : "SUCHE",
    },
  });

  if (!isScheduled) {
    getDispatcher()?.dispatchBooking(booking.id).catch(() => {});
  }

  return NextResponse.json({ id: booking.id, booking: bookingDTO(booking) }, { status: 201 });
}
