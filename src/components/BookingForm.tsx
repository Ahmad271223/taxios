"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AddressInput } from "@/components/AddressInput";
import { formatDistance, formatDuration, formatEuro } from "@/lib/format";
import type { GeocodeResult, PriceEstimate } from "@/lib/geo";
import type { MapMarker } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

interface AddrState {
  address: string;
  lat?: number;
  lng?: number;
}

export function BookingForm({ scheduled = false, companySlug }: { scheduled?: boolean; companySlug: string }) {
  const router = useRouter();
  const [pickup, setPickup] = useState<AddrState>({ address: "" });
  const [dest, setDest] = useState<AddrState>({ address: "" });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(false);
  const [childSeat, setChildSeat] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [quote, setQuote] = useState<PriceEstimate | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const haveRoute = pickup.lat != null && dest.lat != null;

  useEffect(() => {
    if (!haveRoute) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { lat: pickup.lat, lng: pickup.lng },
        to: { lat: dest.lat, lng: dest.lng },
        company: companySlug,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setQuote(d);
          setRouteLine(d.geometry ?? null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup.lat, pickup.lng, dest.lat, dest.lng]);

  function selectPickup(r: GeocodeResult) {
    setPickup({ address: r.label, lat: r.lat, lng: r.lng });
  }
  function selectDest(r: GeocodeResult) {
    setDest({ address: r.label, lat: r.lat, lng: r.lng });
  }

  // Adresse aus freiem Text erkennen (falls kein Vorschlag angeklickt wurde).
  async function resolveAddr(addr: AddrState): Promise<AddrState> {
    if (addr.lat != null) return addr;
    if (!addr.address.trim()) return addr;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(addr.address)}`);
      const d = await res.json();
      const hit = d.results?.[0];
      if (hit) return { address: hit.label, lat: hit.lat, lng: hit.lng };
    } catch {
      /* ignore */
    }
    return addr;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Bitte Name und Telefonnummer angeben.");
      return;
    }

    let scheduledAt: string | null = null;
    if (scheduled) {
      if (!date || !time) {
        setError("Bitte Datum und Uhrzeit für die Vorbestellung wählen.");
        return;
      }
      const dt = new Date(`${date}T${time}`);
      if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 60_000) {
        setError("Bitte einen Zeitpunkt in der Zukunft wählen.");
        return;
      }
      scheduledAt = dt.toISOString();
    }

    setSubmitting(true);

    // Adressen automatisch erkennen – kein Anklicken eines Vorschlags nötig.
    const p = await resolveAddr(pickup);
    const q = await resolveAddr(dest);
    setPickup(p);
    setDest(q);
    if (p.lat == null || q.lat == null) {
      setError(
        "Adresse konnte nicht gefunden werden. Bitte genauer eingeben (Straße, Hausnummer, Ort).",
      );
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companySlug,
          customerName: name,
          customerPhone: phone,
          pickupAddress: p.address,
          pickup: { lat: p.lat, lng: p.lng },
          destAddress: q.address,
          dest: { lat: q.lat, lng: q.lng },
          passengers,
          luggage,
          childSeat,
          notes: notes || null,
          scheduledAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Buchung fehlgeschlagen.");
        setSubmitting(false);
        return;
      }
      router.push(`/verfolgen/${data.id}`);
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-4">
        <AddressInput
          label="Abholadresse *"
          placeholder="z. B. Hauptbahnhof, Hannover"
          value={pickup.address}
          onChange={(t) => setPickup({ address: t })}
          onSelect={selectPickup}
          required
        />
        <AddressInput
          label="Zieladresse *"
          placeholder="z. B. Kröpcke, Hannover"
          value={dest.address}
          onChange={(t) => setDest({ address: t })}
          onSelect={selectDest}
          required
        />
        <p className="text-xs text-ink-500">
          Tipp: Adresse eintippen – ein Vorschlag genügt, die Erkennung erfolgt automatisch.
        </p>
      </div>

      {/* Routen-Karte */}
      {haveRoute && (
        <div className="overflow-hidden rounded-2xl ring-1 ring-ink-200 shadow-card">
          <div className="h-56 sm:h-64">
            <Map
              center={[((pickup.lat as number) + (dest.lat as number)) / 2, ((pickup.lng as number) + (dest.lng as number)) / 2]}
              markers={[
                { id: "p", lat: pickup.lat as number, lng: pickup.lng as number, kind: "pickup", popup: "Abholung" },
                { id: "d", lat: dest.lat as number, lng: dest.lng as number, kind: "dest", popup: "Ziel" },
              ] as MapMarker[]}
              line={routeLine ?? undefined}
              fit
            />
          </div>
        </div>
      )}

      {/* Preisvorschau */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        {quoting ? (
          <p className="text-sm text-ink-600">Preis wird berechnet …</p>
        ) : quote ? (
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-ink-600">Voraussichtlicher Fahrpreis</p>
              <p className="text-2xl font-extrabold text-ink-900">
                {formatEuro(quote.priceMin)} bis {formatEuro(quote.priceMax)}
              </p>
            </div>
            <div className="text-right text-sm text-ink-600">
              <p>📍 {formatDistance(quote.distanceMeters)}</p>
              <p>⏱ ca. {formatDuration(quote.durationSeconds)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            Wählen Sie Abhol- und Zieladresse für eine automatische Preisvorschau.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name *</label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Telefonnummer *</label>
          <input
            className="field"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      {scheduled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Datum *</label>
            <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Uhrzeit *</label>
            <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
      )}

      <details className="rounded-2xl border border-ink-200 bg-white p-4">
        <summary className="cursor-pointer font-medium text-ink-700">Weitere Optionen</summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Personenanzahl</label>
              <input
                className="field"
                type="number"
                min={1}
                max={8}
                value={passengers}
                onChange={(e) => setPassengers(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={luggage} onChange={(e) => setLuggage(e.target.checked)} />
                Gepäck
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={childSeat} onChange={(e) => setChildSeat(e.target.checked)} />
                Kindersitz
              </label>
            </div>
          </div>
          <div>
            <label className="label">Bemerkungen</label>
            <textarea
              className="field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Treffpunkt am Seiteneingang"
            />
          </div>
        </div>
      </details>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary text-lg" disabled={submitting}>
        {submitting ? "Wird gesendet …" : scheduled ? "Vorbestellung abschicken" : "Taxi bestellen"}
      </button>
    </form>
  );
}
