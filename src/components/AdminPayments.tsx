"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";

interface Status {
  configured: boolean;
  connected: boolean;
  chargesEnabled: boolean;
  detailsSubmitted?: boolean;
}

export function AdminPayments() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/stripe/status")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setStatus(d))
      .catch(() => router.replace("/admin/login"));
  }

  useEffect(load, [router]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const d = await res.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      setError(d.error ?? "Verbindung fehlgeschlagen.");
    } catch {
      setError("Netzwerkfehler.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Brand href="/admin" subtitle="Zahlungen (Stripe)" />
          <Link href="/admin" className="text-sm font-medium text-ink-500 hover:text-ink-900">← Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="card p-6">
          <h1 className="text-xl font-extrabold text-ink-900">Kartenzahlung &amp; Auszahlungen</h1>
          <p className="mt-1 text-sm text-ink-500">
            Verbinden Sie Ihr Stripe-Konto. Kundenzahlungen per Karte gehen nach der Fahrt
            <strong> direkt an Ihr Unternehmen</strong>.
          </p>

          {!status && <p className="mt-6 text-ink-500">Lädt …</p>}

          {status && !status.configured && (
            <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
              Stripe ist auf dem Server noch nicht eingerichtet. Der Betreiber muss
              <code className="mx-1">STRIPE_SECRET_KEY</code> (und Webhook) in <code>.env</code> hinterlegen.
            </div>
          )}

          {status?.configured && (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${status.chargesEnabled ? "bg-green-500" : status.connected ? "bg-amber-500" : "bg-ink-300"}`}
                />
                <span className="font-semibold text-ink-800">
                  {status.chargesEnabled
                    ? "Kartenzahlung aktiv"
                    : status.connected
                    ? "Onboarding unvollständig"
                    : "Noch nicht verbunden"}
                </span>
              </div>

              {status.chargesEnabled ? (
                <p className="mt-3 text-sm text-ink-600">
                  ✓ Ihr Stripe-Konto ist verbunden. Auszahlungen erfolgen automatisch an Ihr Konto.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-ink-600">
                    {status.connected
                      ? "Bitte schließen Sie das Stripe-Onboarding ab, um Kartenzahlungen zu empfangen."
                      : "Verbinden Sie Ihr Stripe-Konto (oder erstellen Sie eines im Prozess)."}
                  </p>
                  <button onClick={connect} disabled={busy} className="btn-primary mt-4">
                    {busy ? "Weiterleitung …" : status.connected ? "Onboarding fortsetzen" : "Stripe-Konto verbinden"}
                  </button>
                </>
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <button onClick={load} className="mt-4 block text-sm text-ink-400 hover:text-ink-700">
                Status aktualisieren
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
