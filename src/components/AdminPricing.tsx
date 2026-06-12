"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";

const FIELDS: { key: string; label: string; suffix: string; step?: string }[] = [
  { key: "perKmDay", label: "Preis pro km · Tag (06:00–22:00)", suffix: "€ / km", step: "0.10" },
  { key: "perKmNight", label: "Preis pro km · Nacht (22:00–06:00)", suffix: "€ / km", step: "0.10" },
  { key: "perKmWeekend", label: "Preis pro km · Wochenende (Sa/So)", suffix: "€ / km", step: "0.10" },
  { key: "perMinute", label: "Preis pro Minute (optional)", suffix: "€ / min", step: "0.05" },
  { key: "basePrice", label: "Grundpreis", suffix: "€", step: "0.10" },
];

export function AdminPricing() {
  const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pricing")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setForm(d.pricing))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  function set(k: string, v: string) {
    setForm((f: any) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      basePrice: Number(form.basePrice),
      perKmDay: Number(form.perKmDay),
      perKmNight: Number(form.perKmNight),
      perKmWeekend: Number(form.perKmWeekend),
      perMinute: Number(form.perMinute ?? 0),
      nightStartHour: Number(form.nightStartHour ?? 22),
      nightEndHour: Number(form.nightEndHour ?? 6),
    };
    const res = await fetch("/api/admin/pricing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  if (!form) return <main className="grid min-h-screen place-items-center bg-ink-100">Lädt …</main>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle="Preiseinstellungen" />
          <Link href="/admin" className="text-sm font-medium text-ink-500 hover:text-ink-900">← Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="card p-6">
          <h1 className="text-xl font-extrabold text-ink-900">Tarife</h1>
          <p className="mt-1 text-sm text-ink-500">
            Diese Preise gelten automatisch je nach Wochentag und Uhrzeit für alle Buchungen Ihrer Firma.
          </p>
          <div className="mt-5 grid gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <div className="flex items-center gap-3">
                  <input
                    className="field"
                    type="number"
                    step={f.step}
                    min="0"
                    value={form[f.key] ?? 0}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <span className="w-20 shrink-0 text-sm text-ink-500">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={saving} className="btn-primary mt-6 w-full">
            {saving ? "Speichern …" : saved ? "✓ Gespeichert" : "Speichern"}
          </button>
        </div>
      </div>
    </main>
  );
}
