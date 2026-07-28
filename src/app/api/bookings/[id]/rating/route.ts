import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const rating = Number(json?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Bewertung muss zwischen 1 und 5 liegen" }, { status: 400 });
  }
  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  if (booking.status !== "ABGESCHLOSSEN") {
    return NextResponse.json({ error: "Bewertung ist erst nach Fahrtende möglich" }, { status: 400 });
  }

  const oldRating = booking.rating;
  const ops: any[] = [
    prisma.booking.update({
      where: { id: params.id },
      data: { rating, ratedAt: new Date() },
    }),
  ];
  // Fahrer-Durchschnitt pflegen: neue Bewertung zaehlt +1, eine geaenderte
  // Bewertung ersetzt nur den Summenanteil (keine Doppelzaehlung).
  if (booking.driverId) {
    ops.push(
      prisma.driver.update({
        where: { id: booking.driverId },
        data: {
          ratingSum: { increment: rating - (oldRating ?? 0) },
          ...(oldRating == null ? { ratingCount: { increment: 1 } } : {}),
        },
      }),
    );
  }
  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
