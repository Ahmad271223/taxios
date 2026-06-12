import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { driverAdmin } from "@/server/serialize";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  vehicleModel: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  vehicleColor: z.string().optional().nullable(),
  vehicleSeats: z.number().int().min(1).max(9).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  // Mandantencheck: Fahrer muss zur eigenen Firma gehoeren.
  const existing = await prisma.driver.findUnique({ where: { id: params.id } });
  if (!existing || existing.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  let json: any;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const driver = await prisma.driver.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ driver: driverAdmin(driver) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = requireRole("ADMIN");
  if (!session) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  const existing = await prisma.driver.findUnique({ where: { id: params.id } });
  if (!existing || existing.companyId !== session.companyId) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  await prisma.driver.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
