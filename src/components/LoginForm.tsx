"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { resetSocket } from "@/lib/socket";

interface Props {
  role: "DRIVER" | "ADMIN";
  redirectTo: string;
  title: string;
  hint?: string;
  identifierLabel?: string;
  identifierType?: string;
  showRegister?: boolean;
}

export function LoginForm({
  role,
  redirectTo,
  title,
  hint,
  identifierLabel = "Benutzername",
  identifierType = "text",
  showRegister,
}: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen.");
        setLoading(false);
        return;
      }
      resetSocket(); // frische Verbindung mit der neuen Session
      router.replace(redirectTo);
    } catch {
      setError("Netzwerkfehler.");
      setLoading(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ink-950 p-5">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Brand subtitle={title} tone="light" />
        </div>
        <form onSubmit={submit} className="card grid gap-4 p-6">
          <div>
            <label className="label">{identifierLabel}</label>
            <input
              className="field"
              type={identifierType}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary" disabled={loading}>
            {loading ? "Anmelden …" : "Anmelden"}
          </button>
          {hint && <p className="text-center text-xs text-ink-400">{hint}</p>}
          {showRegister && (
            <p className="text-center text-sm text-ink-500">
              Noch kein Account?{" "}
              <Link href="/registrieren" className="font-semibold text-brand-600 hover:underline">
                Firma registrieren
              </Link>
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
