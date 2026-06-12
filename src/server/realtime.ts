// Socket.IO-Verbindungslogik. Authentifizierung erfolgt ueber das
// Session-Cookie aus dem Handshake (httpOnly, kein Token im JS noetig).

import type { Server as IOServer, Socket } from "socket.io";
import { prisma } from "../lib/prisma";
import { verifySession, SESSION_COOKIE } from "../lib/auth";
import type { Dispatcher } from "./dispatch";
import { bookingDTO, driverAdmin } from "./serialize";

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

async function adminSnapshot(dispatcher: Dispatcher, companyId: string) {
  const dbDrivers = await prisma.driver.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  const live = new Map(dispatcher.getLiveDrivers().map((d) => [d.id, d]));
  const drivers = dbDrivers.map((d) => {
    const l = live.get(d.id);
    return driverAdmin({
      ...d,
      status: l?.status ?? d.status,
      lat: l?.lat ?? d.lat,
      lng: l?.lng ?? d.lng,
    });
  });
  const bookings = await prisma.booking.findMany({
    where: { companyId, status: { in: ["OFFEN", "ZUGEWIESEN", "AKTIV"] } },
    include: { driver: true },
    orderBy: { createdAt: "desc" },
  });
  const scheduled = await prisma.booking.findMany({
    where: { companyId, isScheduled: true, status: { notIn: ["ABGESCHLOSSEN", "STORNIERT"] } },
    include: { driver: true },
    orderBy: { scheduledAt: "asc" },
  });
  return {
    drivers,
    bookings: bookings.map((b) => bookingDTO(b)),
    scheduled: scheduled.map((b) => bookingDTO(b)),
  };
}

async function driverState(driverId: string) {
  const me = await prisma.driver.findUnique({ where: { id: driverId } });
  const active = await prisma.booking.findFirst({
    where: { driverId, status: { in: ["ZUGEWIESEN", "AKTIV"] } },
    include: { driver: true },
    orderBy: { acceptedAt: "desc" },
  });
  const myScheduled = await prisma.booking.findMany({
    where: { driverId, isScheduled: true, status: { notIn: ["ABGESCHLOSSEN", "STORNIERT"] } },
    orderBy: { scheduledAt: "asc" },
  });
  const openScheduled = await prisma.booking.findMany({
    where: { isScheduled: true, driverId: null, status: "OFFEN" },
    orderBy: { scheduledAt: "asc" },
  });
  return {
    status: me?.status ?? "PAUSE",
    name: me?.name ?? "",
    activeBooking: active ? bookingDTO(active) : null,
    myScheduled: myScheduled.map((b) => bookingDTO(b)),
    openScheduled: openScheduled.map((b) => bookingDTO(b)),
  };
}

export function registerSockets(io: IOServer, dispatcher: Dispatcher, realDrivers: Set<string>): void {
  io.on("connection", async (socket: Socket) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const token = parseCookie(cookieHeader, SESSION_COOKIE);
    const session = verifySession(token);

    // ---- Administrator (Firma/Mandant) ----
    if (session?.role === "ADMIN") {
      socket.data.role = "ADMIN";
      socket.data.companyId = session.companyId;
      socket.join(`admins:${session.companyId}`);
      try {
        socket.emit("admin:snapshot", await adminSnapshot(dispatcher, session.companyId));
      } catch (e) {
        socket.emit("admin:snapshot", { drivers: [], bookings: [], scheduled: [] });
      }
    }

    // ---- Fahrer ----
    if (session?.role === "DRIVER") {
      const driverId = session.sub;
      socket.data.role = "DRIVER";
      socket.data.driverId = driverId;
      socket.join(`driver:${driverId}`);
      socket.join("drivers");
      realDrivers.add(driverId);
      await dispatcher.onDriverConnect(driverId);
      try {
        socket.emit("driver:state", await driverState(driverId));
      } catch {
        /* ignore */
      }

      socket.on("driver:location", (p: { lat: number; lng: number }) => {
        if (typeof p?.lat === "number" && typeof p?.lng === "number") {
          dispatcher.updateLocation(driverId, p.lat, p.lng).catch(() => {});
        }
      });

      socket.on("driver:status", async (p: { status: string }, ack?: (r: any) => void) => {
        await dispatcher.setStatus(driverId, p.status).catch(() => {});
        ack?.({ ok: true });
      });

      socket.on("driver:respond", async (p: { bookingId: string; accept: boolean }, ack?: (r: any) => void) => {
        const r = await dispatcher.respondToOffer(driverId, p.bookingId, !!p.accept);
        if (r.ok) socket.emit("driver:state", await driverState(driverId));
        ack?.(r);
      });

      socket.on("driver:trip", async (p: { bookingId: string; action: any }, ack?: (r: any) => void) => {
        const r = await dispatcher.tripAction(driverId, p.bookingId, p.action);
        socket.emit("driver:state", await driverState(driverId));
        ack?.(r);
      });

      socket.on("driver:reserve", async (p: { bookingId: string }, ack?: (r: any) => void) => {
        const r = await dispatcher.reserveScheduled(driverId, p.bookingId);
        if (r.ok) socket.emit("driver:state", await driverState(driverId));
        ack?.(r);
      });

      socket.on("disconnect", () => {
        realDrivers.delete(driverId);
        dispatcher.onDriverDisconnect(driverId).catch(() => {});
      });
    }

    // ---- Kunde (Tracking) ----
    socket.on("track:join", async (p: { bookingId: string }, ack?: (r: any) => void) => {
      if (!p?.bookingId) return;
      socket.join(`booking:${p.bookingId}`);
      const b = await prisma.booking.findUnique({
        where: { id: p.bookingId },
        include: { driver: true },
      });
      if (b) {
        const dto = bookingDTO(b);
        socket.emit("booking:update", dto);
        ack?.({ ok: true, booking: dto });
      } else {
        ack?.({ ok: false });
      }
    });

    // ---- Admin-Aktionen ----
    socket.on("admin:cancel", async (p: { bookingId: string }) => {
      if (socket.data.role !== "ADMIN") return;
      // Mandantencheck
      const b = await prisma.booking.findUnique({ where: { id: p.bookingId } });
      if (!b || b.companyId !== socket.data.companyId) return;
      await dispatcher.cancelBooking(p.bookingId).catch(() => {});
    });

    socket.on("admin:refresh", async () => {
      if (socket.data.role !== "ADMIN" || !socket.data.companyId) return;
      socket.emit("admin:snapshot", await adminSnapshot(dispatcher, socket.data.companyId));
    });
  });
}
