import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, SESSION_COOKIE, type Role } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const { username, password, role } = body ?? {};
  const identifier = (username ?? body?.email ?? "").trim();
  if (!identifier || !password) {
    return NextResponse.json({ error: "Zugangsdaten erforderlich" }, { status: 400 });
  }

  if (role === "ADMIN") {
    // Firma (Mandant) meldet sich mit E-Mail an.
    const company = await prisma.company.findUnique({ where: { email: identifier.toLowerCase() } });
    if (!company || !(await verifyPassword(password, company.passwordHash))) {
      return NextResponse.json({ error: "E-Mail oder Passwort falsch" }, { status: 401 });
    }
    const token = signSession({
      sub: company.id,
      role: "ADMIN",
      name: company.name,
      username: company.email,
      companyId: company.id,
      companySlug: company.slug,
    });
    return withCookie(NextResponse.json({ ok: true, role: "ADMIN", name: company.name, slug: company.slug }), token);
  }

  // Fahrer meldet sich mit Benutzername an.
  const driver = await prisma.driver.findUnique({
    where: { username: identifier },
    include: { company: true },
  });
  if (!driver || !(await verifyPassword(password, driver.passwordHash))) {
    return NextResponse.json({ error: "Benutzername oder Passwort falsch" }, { status: 401 });
  }
  const token = signSession({
    sub: driver.id,
    role: "DRIVER",
    name: driver.name,
    username: driver.username,
    companyId: driver.companyId,
    companySlug: driver.company.slug,
  });
  return withCookie(NextResponse.json({ ok: true, role: "DRIVER", name: driver.name }), token);
}

function withCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
