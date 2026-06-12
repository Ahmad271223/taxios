import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = requireRole("ADMIN");
  if (!session) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const companyId = session.companyId;

  const drivers = await prisma.driver.findMany({ where: { companyId } });
  const byStatus = { FREI: 0, BESETZT: 0, PAUSE: 0, OFFLINE: 0 } as Record<string, number>;
  for (const d of drivers) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;

  const activeBookings = await prisma.booking.count({
    where: { companyId, status: { in: ["OFFEN", "ZUGEWIESEN", "AKTIV"] } },
  });
  const scheduledCount = await prisma.booking.count({
    where: { companyId, isScheduled: true, status: { notIn: ["ABGESCHLOSSEN", "STORNIERT"] } },
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todays = await prisma.booking.findMany({
    where: { companyId, status: "ABGESCHLOSSEN", completedAt: { gte: startOfDay } },
    select: { fare: true },
  });
  const tripsToday = todays.length;
  const revenueToday = todays.reduce((sum, b) => sum + (b.fare ?? 0), 0);
  const avgFare = tripsToday > 0 ? revenueToday / tripsToday : 0;

  const company = await prisma.company.findUnique({ where: { id: companyId } });

  return NextResponse.json({
    company: company ? { name: company.name, slug: company.slug } : null,
    drivers: {
      total: drivers.length,
      active: drivers.length - (byStatus.OFFLINE ?? 0),
      frei: byStatus.FREI ?? 0,
      besetzt: byStatus.BESETZT ?? 0,
      pause: byStatus.PAUSE ?? 0,
      offline: byStatus.OFFLINE ?? 0,
    },
    activeBookings,
    scheduledCount,
    today: {
      trips: tripsToday,
      revenue: Math.round(revenueToday * 100) / 100,
      avgFare: Math.round(avgFare * 100) / 100,
    },
  });
}
