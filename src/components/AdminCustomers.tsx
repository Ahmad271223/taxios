"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { formatEuro, formatDateTime } from "@/lib/format";

export function AdminCustomers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/customers")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setCustomers(d.customers))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  const filtered = (customers ?? []).filter((c) => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });

  const totals = (customers ?? []).reduce(
    (acc, c) => ({ trips: acc.trips + c.trips, revenue: acc.revenue + c.revenue }),
    { trips: 0, revenue: 0 },
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle="Kunden" />
          <Link href="/admin" className="text-sm font-medium text-ink-500 hover:text-ink-900">← Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-6">
        {/* Kopfzahlen */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Kunden</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{customers?.length ?? "–"}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Fahrten gesamt</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{totals.trips}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs uppercase tracking-wide text-ink-500">Umsatz gesamt</p>
            <p className="mt-1 text-2xl font-extrabold text-ink-900">{formatEuro(totals.revenue)}</p>
          </div>
        </div>

        <input
          className="field mt-4"
          placeholder="🔍 Nach Name oder Telefonnummer suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="card mt-4 overflow-hidden p-0">
          {!customers && <p className="px-5 py-8 text-center text-ink-400">Lädt …</p>}
          {customers && filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-ink-400">Keine Kunden gefunden.</p>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th className="px-4 py-3">Kunde</th>
                    <th className="px-4 py-3 text-right">Fahrten</th>
                    <th className="px-4 py-3 text-right">Abgeschlossen</th>
                    <th className="px-4 py-3 text-right">Storniert</th>
                    <th className="px-4 py-3 text-right">Umsatz</th>
                    <th className="px-4 py-3">Ø Bewertung</th>
                    <th className="px-4 py-3">Letzte Fahrt</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.phone} className="border-t border-ink-100 hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-900">{c.name}</p>
                        <a href={`tel:${c.phone}`} className="text-xs text-brand-700 hover:underline">
                          {c.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{c.trips}</td>
                      <td className="px-4 py-3 text-right text-green-700">{c.completed}</td>
                      <td className="px-4 py-3 text-right text-red-600">{c.cancelled || "–"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatEuro(c.revenue)}</td>
                      <td className="px-4 py-3">{c.avgRating ? `${c.avgRating} ★` : "–"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-600">{formatDateTime(c.lastRideAt)}</td>
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
