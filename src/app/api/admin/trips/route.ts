import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { bookingDTO } from "@/server/serialize";

export const dynamic = "force-dynamic";

// Fahrtenverwaltung: alle Auftraege der Firma, optional nach Status gefiltert.
// ?status=LAUFEND | ABGESCHLOSSEN | STORNIERT | (leer = alle)
export async function GET(req: Request) {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const take = Math.min(Number(searchParams.get("take") ?? 100), 300);

  const where: any = { companyId: session.companyId };
  if (status === "LAUFEND") where.status = { in: ["OFFEN", "ZUGEWIESEN", "AKTIV"] };
  else if (status === "ABGESCHLOSSEN") where.status = "ABGESCHLOSSEN";
  else if (status === "STORNIERT") where.status = "STORNIERT";

  const trips = await prisma.booking.findMany({
    where,
    include: { driver: true },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({ trips: trips.map((t) => bookingDTO(t)) });
}
