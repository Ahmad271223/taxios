"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSocket, resetSocket } from "@/lib/socket";
import { Brand } from "@/components/Brand";
import {
  DRIVER_STATUS_LABEL,
  DRIVER_STATUS_COLOR,
  BOOKING_STATUS_LABEL,
  TRACKING_LABEL,
} from "@/lib/status";
import { formatEuro, formatDateTime } from "@/lib/format";
import type { MapMarker } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });
const FALLBACK: [number, number] = [52.375892, 9.732010]; // Hannover

export function AdminDashboard() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "ok">("checking");
  const [drivers, setDrivers] = useState<Record<string, any>>({});
  const [bookings, setBookings] = useState<Record<string, any>>({});
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [today, setToday] = useState<{ trips: number; revenue: number; avgFare: number } | null>(null);
  const [company, setCompany] = useState<{ name: string; slug: string } | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.session?.role === "ADMIN") setAuthState("ok");
        else router.replace("/admin/login");
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  const loadOverview = () => {
    fetch("/api/admin/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setToday(d.today);
          if (d.company) setCompany(d.company);
        }
      })
      .catch(() => {});
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStats(d))
      .catch(() => {});
    fetch("/api/admin/trips?status=ABGESCHLOSSEN&take=8")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRecentTrips(d.trips))
      .catch(() => {});
  };

  useEffect(() => {
    if (authState !== "ok") return;
    const socket = getSocket();

    const onSnapshot = (s: any) => {
      const dmap: Record<string, any> = {};
      for (const d of s.drivers ?? []) dmap[d.id] = d;
      setDrivers(dmap);
      const bmap: Record<string, any> = {};
      for (const b of s.bookings ?? []) bmap[b.id] = b;
      setBookings(bmap);
      setScheduled(s.scheduled ?? []);
    };
    const onDriver = (d: any) => setDrivers((cur) => ({ ...cur, [d.id]: { ...cur[d.id], ...d } }));
    const onDriverLoc = (p: { id: string; lat: number; lng: number }) =>
      setDrivers((cur) => (cur[p.id] ? { ...cur, [p.id]: { ...cur[p.id], lat: p.lat, lng: p.lng } } : cur));
    const onBooking = (b: any) => {
      setBookings((cur) => ({ ...cur, [b.id]: b }));
      if (b.isScheduled) {
        setScheduled((cur) => {
          const others = cur.filter((x) => x.id !== b.id);
          return ["ABGESCHLOSSEN", "STORNIERT"].includes(b.status) ? others : [...others, b];
        });
      }
      if (b.status === "ABGESCHLOSSEN") loadOverview();
    };

    socket.on("admin:snapshot", onSnapshot);
    socket.on("admin:driver", onDriver);
    socket.on("admin:driverLocation", onDriverLoc);
    socket.on("admin:booking", onBooking);
    socket.on("connect", () => socket.emit("admin:refresh"));

    loadOverview();
    const t = setInterval(loadOverview, 20000);

    return () => {
      socket.off("admin:snapshot", onSnapshot);
      socket.off("admin:driver", onDriver);
      socket.off("admin:driverLocation", onDriverLoc);
      socket.off("admin:booking", onBooking);
      clearInterval(t);
    };
  }, [authState]);

  const driverList = useMemo(() => Object.values(drivers), [drivers]);
  const bookingList = useMemo(
    () =>
      Object.values(bookings)
        .filter((b: any) => ["OFFEN", "ZUGEWIESEN", "AKTIV"].includes(b.status))
        .sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1)),
    [bookings],
  );

  const counts = useMemo(() => {
    const c = { active: 0, frei: 0, besetzt: 0, pause: 0, offline: 0 };
    for (const d of driverList) {
      if (d.status !== "OFFLINE") c.active++;
      if (d.status === "FREI") c.frei++;
      else if (d.status === "BESETZT") c.besetzt++;
      else if (d.status === "PAUSE") c.pause++;
      else c.offline++;
    }
    return c;
  }, [driverList]);

  const markers = useMemo<MapMarker[]>(() => {
    const m: MapMarker[] = [];
    for (const d of driverList) {
      if (d.lat != null && d.lng != null && d.status !== "OFFLINE") {
        m.push({
          id: `drv-${d.id}`,
          lat: d.lat,
          lng: d.lng,
          kind: "car",
          color: DRIVER_STATUS_COLOR[d.status],
          popup: `${d.name} – ${DRIVER_STATUS_LABEL[d.status]}`,
        });
      }
    }
    for (const b of bookingList) {
      if (["OFFEN", "ZUGEWIESEN"].includes(b.status)) {
        m.push({ id: `pk-${b.id}`, lat: b.pickupLat, lng: b.pickupLng, kind: "pickup", popup: `Abholung: ${b.customerName}` });
      }
    }
    return m;
  }, [driverList, bookingList]);

  const center = useMemo<[number, number]>(() => {
    const withLoc = driverList.filter((d) => d.lat != null && d.lng != null);
    if (!withLoc.length) return FALLBACK;
    const lat = withLoc.reduce((s, d) => s + d.lat, 0) / withLoc.length;
    const lng = withLoc.reduce((s, d) => s + d.lng, 0) / withLoc.length;
    return [lat, lng];
  }, [driverList]);

  function cancel(id: string) {
    getSocket().emit("admin:cancel", { bookingId: id });
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    resetSocket();
    router.replace("/admin/login");
  }

  if (authState !== "ok") {
    return <main className="grid min-h-screen place-items-center bg-ink-900 text-white">Lädt …</main>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle={company?.name ?? "Zentrale"} />
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/admin/fahrten" className="text-ink-500 hover:text-ink-900">Fahrten</Link>
            <Link href="/admin/kunden" className="text-ink-500 hover:text-ink-900">Kunden</Link>
            <Link href="/admin/fahrer" className="text-ink-500 hover:text-ink-900">Fahrer</Link>
            <Link href="/admin/preise" className="text-ink-500 hover:text-ink-900">Preise</Link>
            <Link href="/admin/zahlungen" className="text-ink-500 hover:text-ink-900">Zahlungen</Link>
            <button onClick={logout} className="text-ink-500 hover:text-ink-900">Abmelden</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5">
        {/* Kunden-Buchungslink */}
        {company && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-semibold text-ink-800">Ihr Kunden-Buchungslink: </span>
              <code className="text-brand-700">/c/{company.slug}</code>
              <span className="text-ink-500"> – diesen Link geben Sie an Ihre Kunden weiter.</span>
            </div>
            <Link href={`/c/${company.slug}`} target="_blank" className="btn-ghost text-sm">
              Kundenansicht öffnen ↗
            </Link>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Aktive Fahrer" value={counts.active} />
          <Kpi label="Frei" value={counts.frei} color="#16a34a" />
          <Kpi label="Besetzt" value={counts.besetzt} color="#dc2626" />
          <Kpi label="Aktive Aufträge" value={bookingList.length} />
          <Kpi label="Fahrten heute" value={today?.trips ?? 0} />
          <Kpi label="Umsatz heute" value={formatEuro(today?.revenue ?? 0)} />
          <Kpi label="Umsatz Monat" value={formatEuro(stats?.month?.revenue ?? 0)} />
          <Kpi label="Ø Bewertung" value={stats?.month?.avgRating ? `${stats.month.avgRating} ★` : "–"} color="#f59e0b" />
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Live-Karte */}
          <div className="card h-[520px] overflow-hidden p-0 lg:col-span-2">
            <Map center={center} markers={markers} zoom={12} />
          </div>

          {/* Fahrerliste */}
          <div className="card flex max-h-[520px] flex-col p-0">
            <h2 className="border-b border-ink-100 px-5 py-3 font-bold">Fahrer</h2>
            <div className="flex-1 overflow-auto">
              {driverList.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 border-b border-ink-50 px-5 py-3">
                  <div>
                    <p className="font-semibold text-ink-900">
                      {d.name}
                      {d.rating != null && (
                        <span className="ml-2 text-sm font-semibold text-brand-600">★ {d.rating}</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-500">
                      {d.vehicleModel} · {d.vehiclePlate}
                      {d.ratingCount ? ` · ${d.ratingCount} Bew.` : ""}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: DRIVER_STATUS_COLOR[d.status] }}
                  >
                    {DRIVER_STATUS_LABEL[d.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Aktive Aufträge */}
          <div className="card p-0">
            <h2 className="border-b border-ink-100 px-5 py-3 font-bold">Aktive Aufträge</h2>
            <div className="max-h-96 overflow-auto">
              {bookingList.length === 0 && <p className="px-5 py-6 text-sm text-ink-400">Keine aktiven Aufträge.</p>}
              {bookingList.map((b) => (
                <div key={b.id} className="border-b border-ink-50 px-5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{b.customerName}</span>
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs">{BOOKING_STATUS_LABEL[b.status]}</span>
                  </div>
                  <p className="mt-1 text-ink-600">{b.pickupAddress} → {b.destAddress}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
                    <span>{b.driver ? `🚕 ${b.driver.name}` : TRACKING_LABEL[b.trackingStatus]}</span>
                    <button onClick={() => cancel(b.id)} className="text-red-600 hover:underline">Stornieren</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vorbestellungen */}
          <div className="card p-0">
            <h2 className="border-b border-ink-100 px-5 py-3 font-bold">Vorbestellungen</h2>
            <div className="max-h-96 overflow-auto">
              {scheduled.length === 0 && <p className="px-5 py-6 text-sm text-ink-400">Keine Vorbestellungen.</p>}
              {scheduled.map((b) => (
                <div key={b.id} className="border-b border-ink-50 px-5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{formatDateTime(b.scheduledAt)}</span>
                    <span className="text-xs text-ink-500">{b.driver ? `🚕 ${b.driver.name}` : "offen"}</span>
                  </div>
                  <p className="mt-1 text-ink-600">{b.customerName} · {b.pickupAddress} → {b.destAddress}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Statistik-Zeile */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Umsatz je Fahrer */}
          <div className="card p-0">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <h2 className="font-bold">Umsatz je Fahrer</h2>
              <span className="text-xs text-ink-400">dieser Monat</span>
            </div>
            <div className="max-h-80 overflow-auto">
              {(stats?.driverStats ?? []).length === 0 && (
                <p className="px-5 py-6 text-sm text-ink-400">Noch keine Daten.</p>
              )}
              {(stats?.driverStats ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border-b border-ink-50 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-ink-900">{d.name}</p>
                    <p className="text-xs text-ink-500">
                      {d.tripsMonth} Fahrten{d.avgRating ? ` · ${d.avgRating} ★` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatEuro(d.revenueMonth)}</p>
                    <p className="text-xs text-ink-500">heute {formatEuro(d.revenueToday)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Letzte Fahrten */}
          <div className="card p-0">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <h2 className="font-bold">Letzte Fahrten</h2>
              <Link href="/admin/fahrten" className="text-xs font-semibold text-brand-700 hover:underline">
                Alle ansehen →
              </Link>
            </div>
            <div className="max-h-80 overflow-auto">
              {recentTrips.length === 0 && <p className="px-5 py-6 text-sm text-ink-400">Noch keine Fahrten.</p>}
              {recentTrips.map((t) => (
                <div key={t.id} className="border-b border-ink-50 px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink-700">
                      {t.pickupAddress.split(",")[0]} → {t.destAddress.split(",")[0]}
                    </span>
                    <span className="shrink-0 font-bold">{formatEuro(t.fare)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs text-ink-500">
                    <span>{formatDateTime(t.completedAt)} · {t.driver?.name ?? "–"}</span>
                    <span>
                      {t.paid ? "💳 bezahlt" : t.paymentMethod === "KARTE" ? "💳 offen" : "💵 bar"}
                      {t.rating ? ` · ${t.rating} ★` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beliebteste Strecken */}
          <div className="card p-0">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
              <h2 className="font-bold">Beliebteste Strecken</h2>
              <span className="text-xs text-ink-400">dieser Monat</span>
            </div>
            <div className="max-h-80 overflow-auto">
              {(stats?.topRoutes ?? []).length === 0 && (
                <p className="px-5 py-6 text-sm text-ink-400">Noch keine Daten.</p>
              )}
              {(stats?.topRoutes ?? []).map((r: any, i: number) => (
                <div key={r.route} className="flex items-center gap-3 border-b border-ink-50 px-5 py-3 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-800">{r.route}</p>
                    <p className="text-xs text-ink-500">{r.count}× · {formatEuro(r.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Kpi({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={color ? { color } : undefined}>
        {value}
      </p>
    </div>
  );
}
