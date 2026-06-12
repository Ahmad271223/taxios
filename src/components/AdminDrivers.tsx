"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";

export function AdminDrivers() {
  const router = useRouter();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [authOk, setAuthOk] = useState(false);

  useEffect(() => {
    fetch("/api/admin/drivers")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setDrivers(d.drivers);
          setAuthOk(true);
        }
      })
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  if (!authOk) return <main className="grid min-h-screen place-items-center bg-ink-100">Lädt …</main>;

  return (
    <main className="min-h-screen bg-ink-100">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle="Fahrerverwaltung" />
          <Link href="/admin" className="text-sm text-ink-500 hover:text-ink-800">← Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-4 px-5 py-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <NewDriverCard
            onCreated={(d) =>
              setDrivers((prev) => [...prev, d].sort((a, b) => a.name.localeCompare(b.name)))
            }
          />
        </div>
        {drivers.map((d) => (
          <DriverCard key={d.id} driver={d} />
        ))}
      </div>
    </main>
  );
}

function NewDriverCard({ onCreated }: { onCreated: (d: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    phone: "",
    vehicleModel: "",
    vehiclePlate: "",
    vehicleColor: "",
    vehicleSeats: 4,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function create() {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/admin/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vehicleSeats: Number(form.vehicleSeats) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Anlegen fehlgeschlagen.");
      return;
    }
    onCreated(data.driver);
    setForm({ name: "", username: "", password: "", phone: "", vehicleModel: "", vehiclePlate: "", vehicleColor: "", vehicleSeats: 4 });
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-dark w-full">
        + Neuen Fahrer anlegen
      </button>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 font-bold text-ink-900">Neuen Fahrer anlegen</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Telefon" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Benutzername *" value={form.username} onChange={(v) => set("username", v)} />
        <Field label="Passwort *" value={form.password} onChange={(v) => set("password", v)} type="password" />
        <Field label="Fahrzeug" value={form.vehicleModel} onChange={(v) => set("vehicleModel", v)} />
        <Field label="Kennzeichen" value={form.vehiclePlate} onChange={(v) => set("vehiclePlate", v)} />
        <Field label="Farbe" value={form.vehicleColor} onChange={(v) => set("vehicleColor", v)} />
        <Field label="Sitzplätze" type="number" value={String(form.vehicleSeats)} onChange={(v) => set("vehicleSeats", v)} />
      </div>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button onClick={() => setOpen(false)} className="btn-ghost flex-1">Abbrechen</button>
        <button onClick={create} disabled={saving} className="btn-primary flex-1">
          {saving ? "Anlegen …" : "Fahrer anlegen"}
        </button>
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: any }) {
  const [form, setForm] = useState({
    name: driver.name ?? "",
    phone: driver.phone ?? "",
    vehicleModel: driver.vehicleModel ?? "",
    vehiclePlate: driver.vehiclePlate ?? "",
    vehicleColor: driver.vehicleColor ?? "",
    vehicleSeats: driver.vehicleSeats ?? 4,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: any) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/drivers/${driver.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vehicleSeats: Number(form.vehicleSeats) }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{driver.username}</span>
      </div>
      <div className="grid gap-3">
        <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Telefon" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Fahrzeug" value={form.vehicleModel} onChange={(v) => set("vehicleModel", v)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kennzeichen" value={form.vehiclePlate} onChange={(v) => set("vehiclePlate", v)} />
          <Field label="Farbe" value={form.vehicleColor} onChange={(v) => set("vehicleColor", v)} />
        </div>
        <Field label="Sitzplätze" type="number" value={String(form.vehicleSeats)} onChange={(v) => set("vehicleSeats", v)} />
      </div>
      <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full">
        {saving ? "Speichern …" : saved ? "✓ Gespeichert" : "Speichern"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="field" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
