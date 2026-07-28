"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { BOOKING_STATUS_LABEL, TRACKING_LABEL } from "@/lib/status";
import { formatEuro, formatDateTime, formatDistance } from "@/lib/format";

const FILTERS = [
  { key: "", label: "Alle" },
  { key: "LAUFEND", label: "Laufend" },
  { key: "ABGESCHLOSSEN", label: "Abgeschlossen" },
  { key: "STORNIERT", label: "Storniert" },
];

const STATUS_STYLE: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  ZUGEWIESEN: "bg-blue-100 text-blue-800",
  AKTIV: "bg-indigo-100 text-indigo-800",
  ABGESCHLOSSEN: "bg-green-100 text-green-700",
  STORNIERT: "bg-red-100 text-red-700",
};

export function AdminTrips() {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [trips, setTrips] = useState<any[] | null>(null);

  const load = useCallback(
    (f: string) => {
      fetch(`/api/admin/trips${f ? `?status=${f}` : ""}`)
        .then((r) => {
          if (r.status === 401) {
            router.replace("/admin/login");
            return null;
          }
          return r.json();
        })
        .then((d) => d && setTrips(d.trips))
        .catch(() => router.replace("/admin/login"));
    },
    [router],
  );

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle="Fahrtenverwaltung" />
          <Link href="/admin" className="text-sm font-medium text-ink-500 hover:text-ink-900">← Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                filter === f.key
                  ? "bg-ink-900 text-white ring-transparent"
                  : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="card mt-4 overflow-hidden p-0">
          {!trips && <p className="px-5 py-8 text-center text-ink-400">Lädt …</p>}
          {trips && trips.length === 0 && (
            <p className="px-5 py-8 text-center text-ink-400">Keine Fahrten gefunden.</p>
          )}
          {trips && trips.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Datum</th>
                    <th className="px-4 py-3">Kunde</th>
                    <th className="px-4 py-3">Strecke</th>
                    <th className="px-4 py-3">Fahrer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Preis</th>
                    <th className="px-4 py-3">Zahlung</th>
                    <th className="px-4 py-3">⭐</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id} className="border-t border-ink-100 hover:bg-ink-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDateTime(t.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{t.customerName}</p>
                        <p className="text-xs text-ink-500">{t.customerPhone}</p>
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-ink-700">
                        <p className="truncate">{t.pickupAddress.split(",")[0]}</p>
                        <p className="truncate text-ink-500">→ {t.destAddress.split(",")[0]}</p>
                        <p className="text-xs text-ink-400">{formatDistance(t.distanceMeters)}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{t.driver ? t.driver.name : "–"}</td>
                      <td className="px-4 py-3">
                        <span className={`chip ${STATUS_STYLE[t.status] ?? "bg-ink-100 text-ink-700"}`}>
                          {BOOKING_STATUS_LABEL[t.status] ?? t.status}
                        </span>
                        {["OFFEN", "ZUGEWIESEN", "AKTIV"].includes(t.status) && (
                          <p className="mt-1 text-xs text-ink-400">{TRACKING_LABEL[t.trackingStatus]}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {formatEuro(t.fare ?? t.priceMax)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {t.paid ? (
                          <span className="chip bg-green-100 text-green-700">💳 bezahlt</span>
                        ) : t.paymentMethod === "KARTE" ? (
                          <span className="chip bg-amber-100 text-amber-800">💳 offen</span>
                        ) : (
                          <span className="chip bg-ink-100 text-ink-600">💵 bar</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{t.rating ? `${t.rating} ★` : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
