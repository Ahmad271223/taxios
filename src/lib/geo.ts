// Geokodierung (Photon/Komoot + Nominatim-Fallback), Routing/Distanz (OSRM)
// und Preisberechnung. Alle Dienste sind frei und ohne API-Key nutzbar.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry?: [number, number][]; // [lat, lng] entlang der Strecke
}

export interface PriceEstimate {
  distanceMeters: number;
  durationSeconds: number;
  priceMin: number;
  priceMax: number;
  priceMid: number;
  geometry?: [number, number][];
}

const PHOTON = "https://photon.komoot.io";
const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
const USER_AGENT = "TaxiConnect/0.1 (Taxi-Dispatch Hannover)";

function biasCenter(): GeoPoint {
  return {
    lat: Number(process.env.DEFAULT_LAT ?? 52.375892),
    lng: Number(process.env.DEFAULT_LNG ?? 9.732010),
  };
}

// Haversine-Distanz in Metern (Luftlinie) – fuer die Fahrerauswahl.
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function photonLabel(props: any): string {
  const street = [props.street ?? props.name, props.housenumber].filter(Boolean).join(" ");
  const place = [props.postcode, props.city ?? props.town ?? props.village ?? props.county]
    .filter(Boolean)
    .join(" ");
  const parts = [street || props.name, place].filter(Boolean);
  // Falls name != street zusaetzlich anzeigen (z. B. POI-Name)
  if (props.name && props.street && props.name !== props.street) {
    parts.unshift(props.name);
  }
  return Array.from(new Set(parts)).join(", ");
}

// Adress-Autovervollstaendigung via Photon (Komoot) – auf Hannover ausgerichtet.
async function geocodePhoton(query: string, limit: number): Promise<GeocodeResult[]> {
  const c = biasCenter();
  const url = `${PHOTON}/api/?q=${encodeURIComponent(query)}&lang=de&limit=${limit}&lat=${c.lat}&lon=${c.lng}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: any[] };
  const out: GeocodeResult[] = [];
  for (const f of data.features ?? []) {
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    out.push({ label: photonLabel(f.properties ?? {}), lat: coords[1], lng: coords[0] });
  }
  return out;
}

// Fallback: Nominatim (OpenStreetMap).
async function geocodeNominatim(query: string, limit: number): Promise<GeocodeResult[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=0&limit=${limit}&countrycodes=de&q=${encodeURIComponent(
    query,
  )}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

export async function geocode(query: string, limit = 6): Promise<GeocodeResult[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const photon = await geocodePhoton(query, limit);
    if (photon.length) return photon;
  } catch {
    /* fallback */
  }
  try {
    return await geocodeNominatim(query, limit);
  } catch {
    return [];
  }
}

// Eine einzelne, beste Treffer-Koordinate (fuer "Adresse beim Bestellen erkennen").
export async function geocodeOne(query: string): Promise<GeocodeResult | null> {
  const results = await geocode(query, 1);
  return results[0] ?? null;
}

// Strassen-Route fuer Distanz, Fahrzeit und Streckenverlauf. Faellt bei Fehler
// auf eine Luftlinien-Schaetzung zurueck.
export async function routeBetween(from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
  const url = `${OSRM}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data = (await res.json()) as {
        code: string;
        routes?: Array<{ distance: number; duration: number; geometry?: { coordinates: [number, number][] } }>;
      };
      const r = data.routes?.[0];
      if (data.code === "Ok" && r) {
        const geometry = (r.geometry?.coordinates ?? []).map(
          (c) => [c[1], c[0]] as [number, number],
        );
        return {
          distanceMeters: Math.round(r.distance),
          durationSeconds: Math.round(r.duration),
          geometry: geometry.length ? geometry : [[from.lat, from.lng], [to.lat, to.lng]],
        };
      }
    }
  } catch {
    /* ignore -> fallback */
  }
  const straight = haversineMeters(from, to);
  const distanceMeters = Math.round(straight * 1.35);
  const durationSeconds = Math.round((distanceMeters / 1000 / 30) * 3600);
  return {
    distanceMeters,
    durationSeconds,
    geometry: [[from.lat, from.lng], [to.lat, to.lng]],
  };
}

interface Tariff {
  base: number;
  perKm: number;
  perMin: number;
}

export function getTariff(): Tariff {
  return {
    base: Number(process.env.TARIFF_BASE ?? 3.9),
    perKm: Number(process.env.TARIFF_PER_KM ?? 2.2),
    perMin: Number(process.env.TARIFF_PER_MIN ?? 0.4),
  };
}

export function priceFromRoute(distanceMeters: number, durationSeconds: number): Omit<PriceEstimate, "geometry"> {
  const t = getTariff();
  const km = distanceMeters / 1000;
  const min = durationSeconds / 60;
  const mid = t.base + km * t.perKm + min * t.perMin;
  const priceMin = Math.max(t.base, Math.round(mid * 0.9 * 100) / 100);
  const priceMax = Math.round(mid * 1.15 * 100) / 100;
  return {
    distanceMeters,
    durationSeconds,
    priceMid: Math.round(mid * 100) / 100,
    priceMin,
    priceMax,
  };
}

export async function estimatePrice(from: GeoPoint, to: GeoPoint): Promise<PriceEstimate> {
  const route = await routeBetween(from, to);
  return { ...priceFromRoute(route.distanceMeters, route.durationSeconds), geometry: route.geometry };
}

// --- Mandantenfaehige, zeitabhaengige Preisberechnung ----------------------

export interface PricingConfig {
  basePrice: number;
  perKmDay: number;
  perKmNight: number;
  perKmWeekend: number;
  perMinute: number;
  nightStartHour: number;
  nightEndHour: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  basePrice: 4.0,
  perKmDay: 2.5,
  perKmNight: 3.2,
  perKmWeekend: 2.8,
  perMinute: 0.0,
  nightStartHour: 22,
  nightEndHour: 6,
};

export type Tariff = "TAG" | "NACHT" | "WOCHENENDE";

// Aktiven Tarif anhand Wochentag/Uhrzeit bestimmen.
export function activeTariff(p: PricingConfig, when: Date = new Date()): { perKm: number; tariff: Tariff } {
  const day = when.getDay(); // 0 = So, 6 = Sa
  if (day === 0 || day === 6) return { perKm: p.perKmWeekend, tariff: "WOCHENENDE" };
  const h = when.getHours();
  const isNight =
    p.nightStartHour > p.nightEndHour
      ? h >= p.nightStartHour || h < p.nightEndHour // z. B. 22..6
      : h >= p.nightStartHour && h < p.nightEndHour;
  return isNight ? { perKm: p.perKmNight, tariff: "NACHT" } : { perKm: p.perKmDay, tariff: "TAG" };
}

export interface PriceEstimateT extends PriceEstimate {
  tariff: Tariff;
}

export function priceWithConfig(
  distanceMeters: number,
  durationSeconds: number,
  p: PricingConfig,
  when: Date = new Date(),
): Omit<PriceEstimateT, "geometry"> {
  const { perKm, tariff } = activeTariff(p, when);
  const km = distanceMeters / 1000;
  const min = durationSeconds / 60;
  const mid = p.basePrice + km * perKm + min * p.perMinute;
  const priceMin = Math.max(p.basePrice, Math.round(mid * 0.9 * 100) / 100);
  const priceMax = Math.round(mid * 1.15 * 100) / 100;
  return {
    distanceMeters,
    durationSeconds,
    priceMid: Math.round(mid * 100) / 100,
    priceMin,
    priceMax,
    tariff,
  };
}

export async function estimatePriceWith(
  from: GeoPoint,
  to: GeoPoint,
  p: PricingConfig,
  when: Date = new Date(),
): Promise<PriceEstimateT> {
  const route = await routeBetween(from, to);
  return {
    ...priceWithConfig(route.distanceMeters, route.durationSeconds, p, when),
    geometry: route.geometry,
  };
}
