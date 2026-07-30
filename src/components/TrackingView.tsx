"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { Brand } from "@/components/Brand";
import { TRACKING_STEPS, TRACKING_LABEL } from "@/lib/status";
import { formatDuration, formatEuro, formatDateTime } from "@/lib/format";
import type { MapMarker } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

export function TrackingView({ id }: { id: string }) {
  const [booking, setBooking] = useState<any | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [stars, setStars] = useState(0);
  const [ratedDone, setRatedDone] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paidFlag, setPaidFlag] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("paid") === "1") {
      // Rueckkehr von Stripe-Checkout: Zahlung serverseitig verifizieren
      // (funktioniert auch ohne Webhook, z. B. lokal).
      fetch(`/api/bookings/${id}/verify-payment`, { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d.paid) {
            setPaidFlag(true);
            fetch(`/api/bookings/${id}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((x) => x && setBooking(x.booking))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function payWithCard() {
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/pay`, { method: "POST" });
      const d = await res.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      if (d.paid) setPaidFlag(true);
      else setPayError(d.error ?? "Zahlung nicht möglich.");
    } catch {
      setPayError("Netzwerkfehler.");
    }
    setPaying(false);
  }

  async function submitRating(n: number) {
    setStars(n);
    try {
      await fetch(`/api/bookings/${id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: n }),
      });
    } catch {
      /* ignore */
    }
    setRatedDone(true);
  }

  useEffect(() => {
    let mounted = true;
    fetch(`/api/bookings/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => mounted && setBooking(d.booking))
      .catch(() => mounted && setNotFound(true));

    const socket = getSocket();
    socket.emit("track:join", { bookingId: id });
    const onUpdate = (b: any) => {
      if (b?.id === id) {
        setBooking(b);
        if (b.driver?.lat != null && b.driver?.lng != null) {
          setDriverLoc({ lat: b.driver.lat, lng: b.driver.lng });
        }
      }
    };
    const onDriverLoc = (p: { bookingId: string; lat: number; lng: number }) => {
      if (p.bookingId === id) setDriverLoc({ lat: p.lat, lng: p.lng });
    };
    socket.on("booking:update", onUpdate);
    socket.on("booking:driverLocation", onDriverLoc);
    socket.on("connect", () => socket.emit("track:join", { bookingId: id }));

    return () => {
      mounted = false;
      socket.off("booking:update", onUpdate);
      socket.off("booking:driverLocation", onDriverLoc);
    };
  }, [id]);

  useEffect(() => {
    if (!booking) return;
    let cancelled = false;
    fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: { lat: booking.pickupLat, lng: booking.pickupLng },
        to: { lat: booking.destLat, lng: booking.destLng },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRouteLine(d.geometry ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  const markers = useMemo<MapMarker[]>(() => {
    if (!booking) return [];
    const m: MapMarker[] = [
      { id: "pickup", lat: booking.pickupLat, lng: booking.pickupLng, kind: "pickup", popup: "Abholung" },
      { id: "dest", lat: booking.destLat, lng: booking.destLng, kind: "dest", popup: "Ziel" },
    ];
    const dl = driverLoc ?? (booking.driver?.lat != null ? { lat: booking.driver.lat, lng: booking.driver.lng } : null);
    if (dl) m.push({ id: "driver", lat: dl.lat, lng: dl.lng, kind: "car", popup: booking.driver?.name ?? "Fahrer" });
    return m;
  }, [booking, driverLoc]);

  if (notFound) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink-100 p-6 text-center">
        <div>
          <p className="text-5xl">🤔</p>
          <h1 className="mt-4 text-xl font-bold">Auftrag nicht gefunden</h1>
          <Link href="/" className="btn-primary mt-6">Zur Startseite</Link>
        </div>
      </main>
    );
  }

  if (!booking) {
    return <main className="grid min-h-screen place-items-center bg-ink-100">Lädt …</main>;
  }

  const status = booking.trackingStatus as string;
  const currentIdx = TRACKING_STEPS.indexOf(status as any);
  const center: [number, number] =
    (driverLoc && [driverLoc.lat, driverLoc.lng]) ||
    [booking.pickupLat, booking.pickupLng];
  const isScheduled = status === "GEPLANT";
  const noDriver = status === "KEIN_FAHRER";
  const cancelled = status === "STORNIERT";

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Brand subtitle="Auftragsverfolgung" />
          <Link href="/" className="text-sm font-medium text-ink-500 hover:text-ink-900">Startseite</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-3xl gap-5 px-5 py-6">
        {/* Status-Banner */}
        <div
          className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-float ${
            cancelled
              ? "bg-gradient-to-br from-red-500 to-red-700"
              : noDriver
              ? "bg-gradient-to-br from-amber-500 to-amber-700"
              : status === "BEENDET"
              ? "bg-gradient-to-br from-green-500 to-green-700"
              : "bg-gradient-to-br from-ink-900 to-ink-800"
          }`}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="eyebrow text-white/70">Aktueller Status</p>
          <p className="mt-1 text-2xl font-extrabold">{TRACKING_LABEL[status] ?? status}</p>
          {booking.etaSeconds != null && ["FAHRER_UNTERWEGS", "FAHRER_GEFUNDEN"].includes(status) && (
            <p className="mt-1 text-brand-300">Ankunft in ca. {formatDuration(booking.etaSeconds)}</p>
          )}
          {isScheduled && (
            <p className="mt-1 text-brand-300">Geplant für {formatDateTime(booking.scheduledAt)}</p>
          )}
        </div>

        {/* Karte */}
        <div className="card h-72 overflow-hidden p-0 sm:h-80">
          <Map center={center} markers={markers} line={routeLine ?? undefined} fit zoom={14} />
        </div>

        {/* Abschluss: Quittung + Bewertung */}
        {status === "BEENDET" && (
          <div className="card p-6 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="mt-2 text-xl font-extrabold text-ink-900">Vielen Dank!</h2>
            <p className="text-ink-600">Ihre Fahrt ist beendet.</p>
            <p className="mt-4 eyebrow text-ink-400">Gesamtpreis</p>
            <p className="text-3xl font-extrabold text-ink-900">{formatEuro(booking.fare ?? booking.priceMax)}</p>

            {/* Kartenzahlung */}
            {(booking.paid || paidFlag) ? (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-100 px-4 py-1 font-semibold text-green-700">
                ✓ Bezahlt
              </p>
            ) : booking.paymentMethod === "KARTE" ? (
              <div className="mt-3">
                <button onClick={payWithCard} disabled={paying} className="btn-primary">
                  {paying ? "Weiterleitung …" : "💳 Jetzt mit Karte bezahlen"}
                </button>
                {payError && <p className="mt-2 text-sm text-red-600">{payError}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-500">Zahlung bar / EC beim Fahrer</p>
            )}

            {booking.rating || ratedDone ? (
              <p className="mt-4 font-semibold text-green-600">Danke für Ihre Bewertung! ⭐</p>
            ) : (
              <>
                <p className="mt-5 text-sm text-ink-500">Bewerten Sie Ihre Fahrt</p>
                <div className="mt-2 flex justify-center gap-1" onMouseLeave={() => setStars(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setStars(n)}
                      onClick={() => submitRating(n)}
                      className="text-4xl leading-none transition"
                      aria-label={`${n} Sterne`}
                    >
                      <span className={n <= stars ? "text-brand-500" : "text-ink-300"}>★</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Fortschritt */}
        {!isScheduled && !cancelled && (
          <div className="card p-5">
            <ol className="grid gap-3">
              {TRACKING_STEPS.map((step, i) => {
                const done = currentIdx >= 0 && i <= currentIdx;
                const active = i === currentIdx;
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done ? "bg-green-600 text-white" : "bg-ink-200 text-ink-500"
                      } ${active ? "ring-4 ring-green-200" : ""}`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <span className={done ? "font-semibold text-ink-900" : "text-ink-500"}>
                      {TRACKING_LABEL[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Fahrerinformationen */}
        {booking.driver && (
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
              Ihr Fahrer
            </h2>
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-2xl">🧑‍✈️</div>
              <div className="flex-1">
                <p className="text-lg font-bold text-ink-900">
                  {booking.driver.name}
                  {booking.driver.rating != null && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-sm font-semibold text-brand-700">
                      ★ {booking.driver.rating}
                    </span>
                  )}
                </p>
                <p className="text-ink-600">
                  {booking.driver.vehicleColor} {booking.driver.vehicleModel} · {booking.driver.vehiclePlate}
                </p>
                {booking.driver.rating != null && (
                  <p className="text-xs text-ink-400">
                    {booking.driver.ratingCount} Bewertung{booking.driver.ratingCount === 1 ? "" : "en"}
                  </p>
                )}
              </div>
              {booking.driver.phone && (
                <a href={`tel:${booking.driver.phone}`} className="btn-ghost">📞 Anrufen</a>
              )}
            </div>
          </div>
        )}

        {/* Fahrtdetails */}
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">Fahrt</h2>
          <div className="grid gap-2 text-sm">
            <Row label="Von" value={booking.pickupAddress} />
            <Row label="Nach" value={booking.destAddress} />
            <Row
              label="Preis"
              value={`${formatEuro(booking.priceMin)} – ${formatEuro(booking.priceMax)}`}
            />
            <Row label="Auftragsnummer" value={booking.id} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}
