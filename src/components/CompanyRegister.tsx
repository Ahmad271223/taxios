"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export function CompanyRegister() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/companies/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registrierung fehlgeschlagen.");
        setLoading(false);
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Netzwerkfehler.");
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-5">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Brand subtitle="Taxiunternehmen registrieren" tone="light" />
        </div>
        <form onSubmit={submit} className="card grid gap-4 p-6">
          <div>
            <label className="label">Firmenname *</label>
            <input className="field" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="field" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Straße, PLZ Ort" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Telefon</label>
              <input className="field" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <label className="label">E-Mail *</label>
              <input className="field" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Passwort * (min. 6 Zeichen)</label>
            <input className="field" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={6} />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary" disabled={loading}>
            {loading ? "Wird erstellt …" : "Account erstellen"}
          </button>
          <p className="text-center text-sm text-ink-500">
            Bereits registriert?{" "}
            <Link href="/admin/login" className="font-semibold text-brand-600 hover:underline">Anmelden</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
