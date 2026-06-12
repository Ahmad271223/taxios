import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingDTO } from "@/server/serialize";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { driver: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Auftrag nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ booking: bookingDTO(booking) });
}
