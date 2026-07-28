import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

// Kundenuebersicht: aus den Buchungen aggregiert (pro Telefonnummer).
export async function GET() {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { companyId: session.companyId },
    select: {
      customerName: true,
      customerPhone: true,
      status: true,
      fare: true,
      rating: true,
      paid: true,
      paymentMethod: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const byPhone = new Map<string, any>();
  for (const b of bookings) {
    const key = b.customerPhone.replace(/[^\d+]/g, "") || b.customerPhone;
    let c = byPhone.get(key);
    if (!c) {
      c = {
        name: b.customerName, // neueste zuerst -> aktuellster Name
        phone: b.customerPhone,
        trips: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0,
        cardPayments: 0,
        ratings: [] as number[],
        lastRideAt: b.createdAt,
      };
      byPhone.set(key, c);
    }
    c.trips++;
    if (b.status === "ABGESCHLOSSEN") {
      c.completed++;
      c.revenue += b.fare ?? 0;
    }
    if (b.status === "STORNIERT") c.cancelled++;
    if (b.paid) c.cardPayments++;
    if (b.rating) c.ratings.push(b.rating);
  }

  const customers = Array.from(byPhone.values())
    .map((c) => ({
      name: c.name,
      phone: c.phone,
      trips: c.trips,
      completed: c.completed,
      cancelled: c.cancelled,
      revenue: Math.round(c.revenue * 100) / 100,
      cardPayments: c.cardPayments,
      avgRating: c.ratings.length
        ? Math.round((c.ratings.reduce((s: number, r: number) => s + r, 0) / c.ratings.length) * 10) / 10
        : null,
      lastRideAt: c.lastRideAt,
    }))
    .sort((a, b) => b.trips - a.trips);

  return NextResponse.json({ customers, total: customers.length });
}
