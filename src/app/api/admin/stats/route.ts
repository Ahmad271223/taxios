import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

function shortAddr(a: string): string {
  return (a ?? "").split(",")[0].trim();
}

// Statistik fuers Chef-Dashboard: Umsatz je Fahrer, Monatszahlen,
// beliebteste Strecken, Bewertungsschnitt, letzte Fahrten.
export async function GET() {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const companyId = session.companyId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [drivers, monthBookings] = await Promise.all([
    prisma.driver.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.booking.findMany({
      where: { companyId, createdAt: { gte: startOfMonth } },
      include: { driver: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const perDriver = new Map<string, any>();
  for (const d of drivers) {
    perDriver.set(d.id, { id: d.id, name: d.name, plate: d.vehiclePlate, tripsToday: 0, revenueToday: 0, tripsMonth: 0, revenueMonth: 0, ratings: [] as number[] });
  }

  let revenueMonth = 0;
  let tripsMonth = 0;
  const ratingsAll: number[] = [];
  const routeCount = new Map<string, { route: string; count: number; revenue: number }>();

  for (const b of monthBookings) {
    if (b.status !== "ABGESCHLOSSEN") continue;
    const fare = b.fare ?? 0;
    tripsMonth++;
    revenueMonth += fare;
    if (b.rating) ratingsAll.push(b.rating);

    const route = `${shortAddr(b.pickupAddress)} → ${shortAddr(b.destAddress)}`;
    const rc = routeCount.get(route) ?? { route, count: 0, revenue: 0 };
    rc.count++;
    rc.revenue += fare;
    routeCount.set(route, rc);

    if (b.driverId && perDriver.has(b.driverId)) {
      const pd = perDriver.get(b.driverId);
      pd.tripsMonth++;
      pd.revenueMonth += fare;
      if (b.rating) pd.ratings.push(b.rating);
      if (b.completedAt && b.completedAt >= startOfDay) {
        pd.tripsToday++;
        pd.revenueToday += fare;
      }
    }
  }

  const driverStats = Array.from(perDriver.values())
    .map((d) => ({
      ...d,
      revenueToday: Math.round(d.revenueToday * 100) / 100,
      revenueMonth: Math.round(d.revenueMonth * 100) / 100,
      avgRating: d.ratings.length
        ? Math.round((d.ratings.reduce((s: number, r: number) => s + r, 0) / d.ratings.length) * 10) / 10
        : null,
      ratings: undefined,
    }))
    .sort((a, b) => b.revenueMonth - a.revenueMonth);

  const topRoutes = Array.from(routeCount.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((r) => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }));

  return NextResponse.json({
    month: {
      trips: tripsMonth,
      revenue: Math.round(revenueMonth * 100) / 100,
      avgRating: ratingsAll.length
        ? Math.round((ratingsAll.reduce((s, r) => s + r, 0) / ratingsAll.length) * 10) / 10
        : null,
    },
    driverStats,
    topRoutes,
  });
}
