// Dispatch-Engine: GPS-basierte automatische Fahrerzuweisung.
//
// Ablauf:
//  1. Neue Sofortbuchung -> assignNext()
//  2. Naechstgelegener FREIER Fahrer (Luftlinie) erhaelt ein Angebot (30 s).
//  3. Annahme  -> Fahrt beginnt, Fahrer wird BESETZT.
//     Ablehnung/Timeout -> Fahrer auf Ignorier-Liste, naechster Fahrer.
//  4. Kein Fahrer frei -> Auftrag bleibt OFFEN, wird erneut versucht,
//     sobald ein Fahrer FREI wird.

import type { Server as IOServer } from "socket.io";
import { prisma } from "../lib/prisma";
import { haversineMeters, routeBetween } from "../lib/geo";
import { sendSms, baseUrl } from "../lib/notify";
import { bookingDTO, driverAdmin, driverPublic } from "./serialize";

const OFFER_TIMEOUT_MS = 30_000;
const SCHEDULED_LEAD_MS = 5 * 60_000; // 5 Min. vor Termin automatisch disponieren
const LOCATION_PERSIST_MS = 8_000;

interface LiveDriver {
  id: string;
  companyId: string;
  name: string;
  status: string; // FREI | BESETZT | PAUSE | OFFLINE
  lat: number | null;
  lng: number | null;
  online: boolean;
  lastSeen: number;
}

interface Offer {
  bookingId: string;
  driverId: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

function csvToSet(csv: string | null | undefined): Set<string> {
  if (!csv) return new Set();
  return new Set(csv.split(",").map((s) => s.trim()).filter(Boolean));
}

export class Dispatcher {
  private io: IOServer;
  private live = new Map<string, LiveDriver>();
  private offers = new Map<string, Offer>(); // key = bookingId
  private driverHasOffer = new Set<string>();
  private driverActiveBooking = new Map<string, string>();
  private lastPersist = new Map<string, number>();

  // Optionaler Hook fuer den GPS-Simulator (virtuelle Fahrer).
  public onOffer?: (bookingId: string, driverId: string) => void;

  constructor(io: IOServer) {
    this.io = io;
  }

  // -- Initialisierung -----------------------------------------------------
  async init(): Promise<void> {
    const drivers = await prisma.driver.findMany();
    for (const d of drivers) {
      this.live.set(d.id, {
        id: d.id,
        companyId: d.companyId,
        name: d.name,
        status: "OFFLINE",
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        online: false,
        lastSeen: 0,
      });
      // Beim Serverstart gilt jeder Fahrer zunaechst als offline.
      await prisma.driver.update({ where: { id: d.id }, data: { status: "OFFLINE" } });
    }
    // Aktive Buchungen (laufende Fahrten) wieder einhaengen.
    const active = await prisma.booking.findMany({
      where: { status: { in: ["ZUGEWIESEN", "AKTIV"] }, driverId: { not: null } },
    });
    for (const b of active) {
      if (b.driverId) this.driverActiveBooking.set(b.driverId, b.id);
    }

    // Periodischer Sweep: Vorbestellungen disponieren + haengende Auftraege.
    setInterval(() => this.sweep().catch(() => {}), 20_000);
  }

  // -- Hilfsfunktionen -----------------------------------------------------
  private emitAdminDriver(driver: any) {
    if (driver?.companyId) {
      this.io.to(`admins:${driver.companyId}`).emit("admin:driver", driverAdmin(driver));
    }
  }

  private async emitBooking(bookingId: string, event = "booking:update") {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { driver: true },
    });
    if (!b) return;
    const eta = this.driverActiveBooking.get(b.driverId ?? "") === b.id
      ? await this.etaSeconds(b)
      : null;
    const dto = bookingDTO(b, { etaSeconds: eta });
    this.io.to(`booking:${bookingId}`).emit(event, dto);
    this.io.to(`admins:${b.companyId}`).emit("admin:booking", dto);
    if (b.driverId) {
      this.io.to(`driver:${b.driverId}`).emit("driver:booking", dto);
    }
    return dto;
  }

  private async etaSeconds(b: any): Promise<number | null> {
    const d = this.live.get(b.driverId);
    if (!d || d.lat == null || d.lng == null) return null;
    try {
      const r = await routeBetween({ lat: d.lat, lng: d.lng }, { lat: b.pickupLat, lng: b.pickupLng });
      return r.durationSeconds;
    } catch {
      return null;
    }
  }

  // -- Fahrer-Lebenszyklus -------------------------------------------------
  async onDriverConnect(driverId: string): Promise<void> {
    const d = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!d) return;
    const prev = this.live.get(driverId);
    // Beim Verbinden: vorherigen Status wiederherstellen, falls vorhanden,
    // sonst PAUSE (Fahrer waehlt aktiv FREI).
    const status = prev && prev.status !== "OFFLINE" ? prev.status : "PAUSE";
    this.live.set(driverId, {
      id: d.id,
      companyId: d.companyId,
      name: d.name,
      status,
      lat: d.lat ?? prev?.lat ?? null,
      lng: d.lng ?? prev?.lng ?? null,
      online: true,
      lastSeen: Date.now(),
    });
    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { status, lastSeenAt: new Date() },
    });
    this.emitAdminDriver(updated);
  }

  async onDriverDisconnect(driverId: string): Promise<void> {
    const live = this.live.get(driverId);
    if (live) {
      live.online = false;
      live.status = "OFFLINE";
    }
    // Offenes Angebot dieses Fahrers freigeben.
    for (const [bid, offer] of this.offers) {
      if (offer.driverId === driverId) {
        this.cancelOffer(bid, true);
      }
    }
    try {
      const updated = await prisma.driver.update({
        where: { id: driverId },
        data: { status: "OFFLINE", lastSeenAt: new Date() },
      });
      this.emitAdminDriver(updated);
    } catch {
      /* ignore */
    }
  }

  async updateLocation(driverId: string, lat: number, lng: number): Promise<void> {
    let live = this.live.get(driverId);
    if (live) {
      live.lat = lat;
      live.lng = lng;
      live.lastSeen = Date.now();
      live.online = true;
    } else {
      live = {
        id: driverId,
        companyId: "",
        name: "",
        status: "PAUSE",
        lat,
        lng,
        online: true,
        lastSeen: Date.now(),
      };
      this.live.set(driverId, live);
    }

    // Live-Position an die Admins der jeweiligen Firma.
    if (live.companyId) {
      this.io.to(`admins:${live.companyId}`).emit("admin:driverLocation", { id: driverId, lat, lng });
    }

    // Bei aktiver Fahrt: Kunde sieht das Fahrzeug fahren.
    const activeBooking = this.driverActiveBooking.get(driverId);
    if (activeBooking) {
      this.io.to(`booking:${activeBooking}`).emit("booking:driverLocation", {
        bookingId: activeBooking,
        lat,
        lng,
      });
    }

    // Gedrosselt in die DB schreiben.
    const last = this.lastPersist.get(driverId) ?? 0;
    if (Date.now() - last > LOCATION_PERSIST_MS) {
      this.lastPersist.set(driverId, Date.now());
      prisma.driver
        .update({ where: { id: driverId }, data: { lat, lng, lastSeenAt: new Date() } })
        .catch(() => {});
    }
  }

  async setStatus(driverId: string, status: string): Promise<void> {
    const live = this.live.get(driverId);
    if (live) live.status = status;
    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { status, lastSeenAt: new Date() },
    });
    this.emitAdminDriver(updated);
    // Wird ein Fahrer frei, offene Auftraege erneut verteilen.
    if (status === "FREI") {
      this.tryAssignPending().catch(() => {});
    }
  }

  getLiveDrivers() {
    return Array.from(this.live.values());
  }

  // -- Zuweisung -----------------------------------------------------------
  async dispatchBooking(bookingId: string): Promise<void> {
    await this.assignNext(bookingId);
  }

  private async assignNext(bookingId: string): Promise<void> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b) return;
    if (b.status !== "OFFEN") return; // bereits zugewiesen/storniert
    if (this.offers.has(bookingId)) return; // laeuft bereits ein Angebot

    const declined = csvToSet(b.declinedDriverIds);
    const pickup = { lat: b.pickupLat, lng: b.pickupLng };

    const candidates = this.getLiveDrivers()
      .filter(
        (d) =>
          d.companyId === b.companyId && // nur Fahrer der buchenden Firma
          d.online &&
          d.status === "FREI" &&
          d.lat != null &&
          d.lng != null &&
          !declined.has(d.id) &&
          !this.driverHasOffer.has(d.id),
      )
      .map((d) => ({ d, dist: haversineMeters(pickup, { lat: d.lat!, lng: d.lng! }) }))
      .sort((a, b2) => a.dist - b2.dist);

    if (candidates.length === 0) {
      // Kein freier Fahrer -> spaeter erneut versuchen.
      if (b.trackingStatus !== "KEIN_FAHRER") {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { trackingStatus: "KEIN_FAHRER" },
        });
        await this.emitBooking(bookingId);
      }
      return;
    }

    const chosen = candidates[0].d;
    const expiresAt = Date.now() + OFFER_TIMEOUT_MS;
    this.driverHasOffer.add(chosen.id);

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { trackingStatus: "SUCHE", assignedAt: new Date() },
      include: { driver: true },
    });

    const timer = setTimeout(() => {
      this.onOfferTimeout(bookingId, chosen.id).catch(() => {});
    }, OFFER_TIMEOUT_MS);
    this.offers.set(bookingId, { bookingId, driverId: chosen.id, expiresAt, timer });

    const dto = bookingDTO(updated, {
      etaSeconds: null,
      offerExpiresAt: expiresAt,
      offerDurationMs: OFFER_TIMEOUT_MS,
      distanceToPickup: Math.round(candidates[0].dist),
    });
    this.io.to(`driver:${chosen.id}`).emit("driver:offer", dto);

    // Simulator (virtuelle Fahrer) benachrichtigen.
    this.onOffer?.(bookingId, chosen.id);

    // Admin/Kunde sehen "Fahrer wird benachrichtigt".
    await this.emitBooking(bookingId);
  }

  private cancelOffer(bookingId: string, notifyDriver = false): string | null {
    const offer = this.offers.get(bookingId);
    if (!offer) return null;
    clearTimeout(offer.timer);
    this.offers.delete(bookingId);
    this.driverHasOffer.delete(offer.driverId);
    if (notifyDriver) {
      this.io.to(`driver:${offer.driverId}`).emit("driver:offerCancel", { bookingId });
    }
    return offer.driverId;
  }

  private async onOfferTimeout(bookingId: string, driverId: string): Promise<void> {
    const offer = this.offers.get(bookingId);
    if (!offer || offer.driverId !== driverId) return;
    this.cancelOffer(bookingId, true);
    await this.addDeclined(bookingId, driverId);
    await this.assignNext(bookingId);
  }

  private async addDeclined(bookingId: string, driverId: string): Promise<void> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b) return;
    const set = csvToSet(b.declinedDriverIds);
    set.add(driverId);
    await prisma.booking.update({
      where: { id: bookingId },
      data: { declinedDriverIds: Array.from(set).join(",") },
    });
  }

  async respondToOffer(driverId: string, bookingId: string, accept: boolean): Promise<{ ok: boolean; reason?: string }> {
    const offer = this.offers.get(bookingId);
    if (!offer || offer.driverId !== driverId) {
      return { ok: false, reason: "Angebot nicht mehr gueltig." };
    }
    if (accept) {
      this.cancelOffer(bookingId, false);
      await this.acceptBooking(bookingId, driverId);
      return { ok: true };
    } else {
      this.cancelOffer(bookingId, false);
      await this.addDeclined(bookingId, driverId);
      await this.assignNext(bookingId);
      return { ok: true };
    }
  }

  private async acceptBooking(bookingId: string, driverId: string): Promise<void> {
    const now = new Date();
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "ZUGEWIESEN",
        trackingStatus: "FAHRER_UNTERWEGS",
        driverId,
        acceptedAt: now,
      },
      include: { driver: true },
    });
    this.driverActiveBooking.set(driverId, bookingId);
    await this.setStatusInternal(driverId, "BESETZT");
    await this.emitBooking(bookingId);

    // SMS: Fahrer gefunden / unterwegs
    const dv = (updated as any).driver;
    const veh = [dv?.vehicleColor, dv?.vehicleModel].filter(Boolean).join(" ");
    sendSms(
      updated.customerPhone,
      `Ihr Taxi ist unterwegs! Fahrer: ${dv?.name ?? ""}${veh ? `, ${veh}` : ""}${dv?.vehiclePlate ? ` (${dv.vehiclePlate})` : ""}. Live-Verfolgung: ${baseUrl()}/verfolgen/${updated.id}`,
    );
  }

  // setStatus ohne tryAssignPending (intern bei Annahme).
  private async setStatusInternal(driverId: string, status: string): Promise<void> {
    const live = this.live.get(driverId);
    if (live) live.status = status;
    const updated = await prisma.driver.update({
      where: { id: driverId },
      data: { status, lastSeenAt: new Date() },
    });
    this.emitAdminDriver(updated);
  }

  // -- Fahrtfortschritt ----------------------------------------------------
  async tripAction(driverId: string, bookingId: string, action: "arrived" | "start" | "complete" | "cancel"): Promise<{ ok: boolean }> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || b.driverId !== driverId) return { ok: false };

    if (action === "arrived") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { trackingStatus: "FAHRER_ANGEKOMMEN", arrivedAt: new Date() },
      });
      sendSms(b.customerPhone, `Ihr Fahrer ist angekommen. Bitte kommen Sie zum Abholpunkt: ${b.pickupAddress}`);
    } else if (action === "start") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "AKTIV", trackingStatus: "FAHRT_LAEUFT", startedAt: new Date() },
      });
    } else if (action === "complete") {
      const fare = b.priceMax ?? b.priceMin ?? 0;
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "ABGESCHLOSSEN",
          trackingStatus: "BEENDET",
          completedAt: new Date(),
          fare,
        },
      });
      this.driverActiveBooking.delete(driverId);
      await this.setStatus(driverId, "FREI"); // loest tryAssignPending aus
      const preis = fare.toFixed(2).replace(".", ",");
      sendSms(b.customerPhone, `Fahrt beendet. Gesamtpreis: ${preis} €. Vielen Dank für Ihre Fahrt!`);
    } else if (action === "cancel") {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "STORNIERT", trackingStatus: "STORNIERT" },
      });
      this.driverActiveBooking.delete(driverId);
      await this.setStatus(driverId, "FREI");
    }
    await this.emitBooking(bookingId);
    return { ok: true };
  }

  // -- Vorbestellungen reservieren ----------------------------------------
  async reserveScheduled(driverId: string, bookingId: string): Promise<{ ok: boolean; reason?: string }> {
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b || !b.isScheduled) return { ok: false, reason: "Keine Vorbestellung." };
    if (b.driverId) return { ok: false, reason: "Bereits reserviert." };
    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { driverId, status: "ZUGEWIESEN" },
      include: { driver: true },
    });
    await this.emitBooking(bookingId);
    this.io.to("drivers").emit("driver:scheduledTaken", { bookingId });
    return { ok: true };
  }

  // -- Stornierung durch Zentrale/Kunde ------------------------------------
  async cancelBooking(bookingId: string): Promise<void> {
    const driverId = this.cancelOffer(bookingId, true);
    const b = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!b) return;
    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "STORNIERT", trackingStatus: "STORNIERT" },
    });
    if (b.driverId) {
      this.driverActiveBooking.delete(b.driverId);
      await this.setStatus(b.driverId, "FREI");
    }
    await this.emitBooking(bookingId);
  }

  // -- Hintergrund-Sweep ---------------------------------------------------
  private async tryAssignPending(): Promise<void> {
    const pending = await prisma.booking.findMany({
      where: {
        status: "OFFEN",
        isScheduled: false,
        trackingStatus: { in: ["SUCHE", "KEIN_FAHRER"] },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const b of pending) {
      if (!this.offers.has(b.id)) {
        await this.assignNext(b.id);
      }
    }
  }

  private async sweep(): Promise<void> {
    // 1. Haengende Sofortauftraege erneut verteilen.
    await this.tryAssignPending();

    // 2. Faellige Vorbestellungen automatisch disponieren.
    const due = await prisma.booking.findMany({
      where: {
        isScheduled: true,
        status: "OFFEN",
        scheduledAt: { lte: new Date(Date.now() + SCHEDULED_LEAD_MS) },
      },
    });
    for (const b of due) {
      // In eine normale Sofortdisposition ueberfuehren.
      await prisma.booking.update({
        where: { id: b.id },
        data: { trackingStatus: "SUCHE" },
      });
      await this.assignNext(b.id);
    }
  }
}
