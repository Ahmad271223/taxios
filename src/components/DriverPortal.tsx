"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Brand } from "@/components/Brand";
import { DRIVER_STATUS, DRIVER_STATUS_LABEL, DRIVER_STATUS_COLOR, TRACKING_LABEL } from "@/lib/status";
import { formatEuro, formatDistance, formatDuration, formatDateTime } from "@/lib/format";

const FALLBACK = { lat: 52.375892, lng: 9.732010 }; // Hannover

export function DriverPortal() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ok" | "denied">("checking");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("PAUSE");
  const [active, setActive] = useState<any | null>(null);
  const [myScheduled, setMyScheduled] = useState<any[]>([]);
  const [openScheduled, setOpenScheduled] = useState<any[]>([]);
  const [offer, setOffer] = useState<any | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [summary, setSummary] = useState<{ today: { trips: number; revenue: number }; recent: any[] } | null>(null);
  const [gpsOk, setGpsOk] = useState(false);

  const loadSummary = useCallback(() => {
    fetch("/api/driver/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => {});
  }, []);

  // Auth pruefen
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.role === "DRIVER") {
          setAuthState("ok");
          setName(d.session.name);
        } else {
          router.replace("/fahrer/login");
        }
      })
      .catch(() => router.replace("/fahrer/login"));
  }, [router]);

  // Socket + GPS
  useEffect(() => {
    if (authState !== "ok") return;
    const socket = getSocket();

    const onState = (s: any) => {
      setStatus(s.status);
      if (s.name) setName(s.name);
      setActive(s.activeBooking);
      setMyScheduled(s.myScheduled ?? []);
      setOpenScheduled(s.openScheduled ?? []);
      loadSummary();
    };
    const onOffer = (o: any) => setOffer(o);
    const onOfferCancel = (p: { bookingId: string }) =>
      setOffer((cur: any) => (cur?.id === p.bookingId ? null : cur));
    const onBooking = (b: any) => {
      setActive((cur: any) => (cur && cur.id === b.id ? b : cur));
    };

    socket.on("driver:state", onState);
    socket.on("driver:offer", onOffer);
    socket.on("driver:offerCancel", onOfferCancel);
    socket.on("driver:booking", onBooking);

    // GPS senden (echtes Geraet) + Fallback, damit der Fahrer disponierbar ist.
    socket.emit("driver:location", FALLBACK);
    let watchId: number | null = null;
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsOk(true);
          socket.emit("driver:location", { lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => setGpsOk(false),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
    }
    const fallbackTimer = setInterval(() => {
      if (!gpsOk) socket.emit("driver:location", FALLBACK);
    }, 15000);

    return () => {
      socket.off("driver:state", onState);
      socket.off("driver:offer", onOffer);
      socket.off("driver:offerCancel", onOfferCancel);
      socket.off("driver:booking", onBooking);
      if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      clearInterval(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState]);

  // Countdown fuer Angebot
  useEffect(() => {
    if (!offer) return;
    const tick = () => {
      const ms = Math.max(0, (offer.offerExpiresAt ?? 0) - Date.now());
      setRemaining(Math.ceil(ms / 1000));
      if (ms <= 0) setOffer(null);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [offer]);

  function changeStatus(s: string) {
    setStatus(s);
    getSocket().emit("driver:status", { status: s });
  }
  function respond(accept: boolean) {
    if (!offer) return;
    getSocket().emit("driver:respond", { bookingId: offer.id, accept });
    setOffer(null);
  }
  function tripAction(action: string) {
    if (!active) return;
    getSocket().emit("driver:trip", { bookingId: active.id, action });
  }
  function reserve(bookingId: string) {
    getSocket().emit("driver:reserve", { bookingId });
  }
  function navigate(lat: number, lng: number) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/fahrer/login");
  }

  if (authState !== "ok") {
    return <main className="grid min-h-screen place-items-center bg-ink-900 text-white">Lädt …</main>;
  }

  const navTarget =
    active?.trackingStatus === "FAHRT_LAEUFT"
      ? { lat: active.destLat, lng: active.destLng, label: "zum Ziel" }
      : active
      ? { lat: active.pickupLat, lng: active.pickupLng, label: "zur Abholung" }
      : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100 pb-20">
      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Brand href="/fahrer" subtitle={name} />
          <button onClick={logout} className="text-sm text-ink-500 hover:text-ink-800">Abmelden</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-2xl gap-5 px-5 py-5">
        {/* Status */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Mein Status</h2>
            <span className="flex items-center gap-1 text-xs text-ink-400">
              <span className={`h-2 w-2 rounded-full ${gpsOk ? "bg-green-500" : "bg-amber-500"}`} />
              {gpsOk ? "GPS aktiv" : "Demo-Standort"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DRIVER_STATUS.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={!!active && s !== "BESETZT"}
                className={`rounded-xl px-3 py-3 text-sm font-semibold ring-1 transition disabled:opacity-40 ${
                  status === s ? "text-white ring-transparent" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50"
                }`}
                style={status === s ? { backgroundColor: DRIVER_STATUS_COLOR[s] } : undefined}
              >
                {DRIVER_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Einnahmen */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Einnahmen heute</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{formatEuro(summary?.today.revenue ?? 0)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Fahrten heute</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{summary?.today.trips ?? 0}</p>
          </div>
        </div>

        {/* Aktiver Auftrag */}
        {active && (
          <div className="card border-2 border-brand-400 p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold text-ink-900">Aktueller Auftrag</h2>
              <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">
                {TRACKING_LABEL[active.trackingStatus]}
              </span>
            </div>
            <TripInfo b={active} />
            {navTarget && (
              <button onClick={() => navigate(navTarget.lat, navTarget.lng)} className="btn-dark mt-4 w-full">
                🧭 Navigation starten ({navTarget.label})
              </button>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                onClick={() => tripAction("arrived")}
                disabled={active.trackingStatus !== "FAHRER_UNTERWEGS"}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                Angekommen
              </button>
              <button
                onClick={() => tripAction("start")}
                disabled={active.trackingStatus !== "FAHRER_ANGEKOMMEN"}
                className="btn-ghost text-sm disabled:opacity-40"
              >
                Fahrt starten
              </button>
              <button
                onClick={() => tripAction("complete")}
                disabled={active.trackingStatus !== "FAHRT_LAEUFT"}
                className="btn-success text-sm disabled:opacity-40"
              >
                Beenden
              </button>
            </div>
          </div>
        )}

        {/* Meine Vorbestellungen */}
        {myScheduled.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-ink-900">Meine geplanten Fahrten</h2>
            <div className="grid gap-3">
              {myScheduled.map((b) => (
                <div key={b.id} className="rounded-xl bg-ink-50 p-3 text-sm">
                  <p className="font-semibold">{formatDateTime(b.scheduledAt)}</p>
                  <p className="text-ink-600">{b.pickupAddress} → {b.destAddress}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offene Vorbestellungen */}
        {openScheduled.length > 0 && !active && (
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-ink-900">Verfügbare Vorbestellungen</h2>
            <div className="grid gap-3">
              {openScheduled.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-3 text-sm">
                  <div>
                    <p className="font-semibold">{formatDateTime(b.scheduledAt)}</p>
                    <p className="text-ink-600">{b.pickupAddress} → {b.destAddress}</p>
                  </div>
                  <button onClick={() => reserve(b.id)} className="btn-primary shrink-0 text-sm">Reservieren</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Letzte Fahrten */}
        {summary && summary.recent.length > 0 && (
          <div className="card p-5">
            <h2 className="mb-3 font-bold text-ink-900">Letzte Fahrten</h2>
            <div className="grid gap-2 text-sm">
              {summary.recent.map((b) => (
                <div key={b.id} className="flex justify-between border-b border-ink-100 pb-2 last:border-0">
                  <span className="truncate text-ink-600">{b.destAddress}</span>
                  <span className="font-semibold">{formatEuro(b.fare)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!active && status === "FREI" && (
          <p className="text-center text-sm text-ink-500">
            Sie sind frei und empfangen neue Aufträge. 🟢
          </p>
        )}
      </div>

      {/* Angebots-Overlay */}
      {offer && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Neuer Auftrag!</h2>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-100 text-lg font-extrabold text-brand-700">
                {remaining}s
              </span>
            </div>
            <TripInfo b={offer} showCustomer />
            {offer.distanceToPickup != null && (
              <p className="mt-2 text-sm text-ink-600">
                Entfernung zur Abholung: ca. {formatDistance(offer.distanceToPickup)}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => respond(false)} className="btn-danger">Ablehnen</button>
              <button onClick={() => respond(true)} className="btn-success">Annehmen</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TripInfo({ b, showCustomer }: { b: any; showCustomer?: boolean }) {
  return (
    <div className="grid gap-1 text-sm">
      {showCustomer && (
        <div className="flex justify-between">
          <span className="text-ink-500">Kunde</span>
          <span className="font-medium">
            {b.customerName} · <a href={`tel:${b.customerPhone}`} className="text-brand-700">{b.customerPhone}</a>
          </span>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <span className="text-ink-500">Abholung</span>
        <span className="text-right font-medium">{b.pickupAddress}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-ink-500">Ziel</span>
        <span className="text-right font-medium">{b.destAddress}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-500">Strecke / Dauer</span>
        <span className="font-medium">{formatDistance(b.distanceMeters)} · {formatDuration(b.durationSeconds)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-ink-500">Preis</span>
        <span className="font-medium">{formatEuro(b.priceMin)} – {formatEuro(b.priceMax)}</span>
      </div>
      {(b.passengers > 1 || b.luggage || b.childSeat) && (
        <div className="flex justify-between">
          <span className="text-ink-500">Hinweise</span>
          <span className="font-medium">
            {b.passengers > 1 ? `${b.passengers} Pers. ` : ""}
            {b.luggage ? "🧳 " : ""}
            {b.childSeat ? "🧒 " : ""}
          </span>
        </div>
      )}
      {b.notes && (
        <div className="flex justify-between gap-3">
          <span className="text-ink-500">Bemerkung</span>
          <span className="text-right font-medium">{b.notes}</span>
        </div>
      )}
    </div>
  );
}
