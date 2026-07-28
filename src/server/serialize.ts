// Wandelt Prisma-Datensaetze in einfache, JSON-sichere Objekte fuer
// Sockets und Clients um (Dates -> ISO-Strings).

import { DRIVER_STATUS_LABEL } from "../lib/status";

export function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}

function ratingAvg(driver: any): number | null {
  return driver?.ratingCount > 0
    ? Math.round((driver.ratingSum / driver.ratingCount) * 10) / 10
    : null;
}

// Oeffentliche Fahrerinfo fuer den Kunden (ohne sensible Daten).
export function driverPublic(driver: any) {
  if (!driver) return null;
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone ?? null,
    vehicleModel: driver.vehicleModel ?? null,
    vehiclePlate: driver.vehiclePlate ?? null,
    vehicleColor: driver.vehicleColor ?? null,
    lat: driver.lat ?? null,
    lng: driver.lng ?? null,
    rating: ratingAvg(driver),
    ratingCount: driver.ratingCount ?? 0,
  };
}

// Fahrerinfo fuer die Admin-Live-Karte.
export function driverAdmin(driver: any) {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone ?? null,
    username: driver.username,
    status: driver.status,
    statusLabel: DRIVER_STATUS_LABEL[driver.status] ?? driver.status,
    lat: driver.lat ?? null,
    lng: driver.lng ?? null,
    vehicleModel: driver.vehicleModel ?? null,
    vehiclePlate: driver.vehiclePlate ?? null,
    vehicleColor: driver.vehicleColor ?? null,
    vehicleSeats: driver.vehicleSeats ?? 4,
    rating: ratingAvg(driver),
    ratingCount: driver.ratingCount ?? 0,
    lastSeenAt: iso(driver.lastSeenAt),
  };
}

// Vollstaendiges Buchungs-DTO.
export function bookingDTO(b: any, extra: Record<string, any> = {}) {
  return {
    id: b.id,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    pickupAddress: b.pickupAddress,
    pickupLat: b.pickupLat,
    pickupLng: b.pickupLng,
    destAddress: b.destAddress,
    destLat: b.destLat,
    destLng: b.destLng,
    passengers: b.passengers,
    luggage: b.luggage,
    childSeat: b.childSeat,
    notes: b.notes ?? null,
    isScheduled: b.isScheduled,
    scheduledAt: iso(b.scheduledAt),
    distanceMeters: b.distanceMeters ?? null,
    durationSeconds: b.durationSeconds ?? null,
    priceMin: b.priceMin ?? null,
    priceMax: b.priceMax ?? null,
    tariff: b.tariff ?? null,
    fare: b.fare ?? null,
    rating: b.rating ?? null,
    paymentMethod: b.paymentMethod ?? null,
    paid: b.paid ?? false,
    paidAmount: b.paidAmount ?? null,
    status: b.status,
    trackingStatus: b.trackingStatus,
    driverId: b.driverId ?? null,
    driver: b.driver ? driverPublic(b.driver) : null,
    assignedAt: iso(b.assignedAt),
    acceptedAt: iso(b.acceptedAt),
    arrivedAt: iso(b.arrivedAt),
    startedAt: iso(b.startedAt),
    completedAt: iso(b.completedAt),
    createdAt: iso(b.createdAt),
    ...extra,
  };
}
