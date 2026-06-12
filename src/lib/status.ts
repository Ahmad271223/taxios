// Zentrale Status-Definitionen + deutsche Beschriftungen.

export const DRIVER_STATUS = ["FREI", "BESETZT", "PAUSE", "OFFLINE"] as const;
export type DriverStatus = (typeof DRIVER_STATUS)[number];

export const DRIVER_STATUS_LABEL: Record<string, string> = {
  FREI: "Frei",
  BESETZT: "Besetzt",
  PAUSE: "Pause",
  OFFLINE: "Offline",
};

export const DRIVER_STATUS_COLOR: Record<string, string> = {
  FREI: "#16a34a",
  BESETZT: "#dc2626",
  PAUSE: "#f59e0b",
  OFFLINE: "#94a3b8",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  ZUGEWIESEN: "Zugewiesen",
  AKTIV: "Aktiv",
  ABGESCHLOSSEN: "Abgeschlossen",
  STORNIERT: "Storniert",
};

// Kunden-Tracking-Schritte in Reihenfolge.
export const TRACKING_STEPS = [
  "SUCHE",
  "FAHRER_GEFUNDEN",
  "FAHRER_UNTERWEGS",
  "FAHRER_ANGEKOMMEN",
  "FAHRT_LAEUFT",
  "BEENDET",
] as const;

export const TRACKING_LABEL: Record<string, string> = {
  SUCHE: "Auftrag eingegangen – Fahrer wird gesucht",
  FAHRER_GEFUNDEN: "Fahrer gefunden",
  FAHRER_UNTERWEGS: "Fahrer ist unterwegs",
  FAHRER_ANGEKOMMEN: "Fahrer angekommen",
  FAHRT_LAEUFT: "Fahrt läuft",
  BEENDET: "Fahrt beendet",
  STORNIERT: "Storniert",
  KEIN_FAHRER: "Momentan kein freier Fahrer verfügbar",
  GEPLANT: "Vorbestellung – geplant",
};
