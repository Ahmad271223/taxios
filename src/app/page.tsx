import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function PlatformLanding() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />

      <div className="relative">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Brand subtitle="Taxi-Vermittlung für Unternehmen" tone="light" />
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link href="/admin/login" className="rounded-xl px-3.5 py-2 text-ink-200 transition hover:bg-white/10 hover:text-white">
              Firmen-Login
            </Link>
            <Link href="/registrieren" className="rounded-xl bg-brand-500 px-3.5 py-2 font-semibold text-ink-950 transition hover:bg-brand-400">
              Registrieren
            </Link>
          </nav>
        </header>

        <section className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pt-20">
          <span className="chip bg-white/10 text-brand-200 ring-1 ring-white/15">
            <span className="h-2 w-2 animate-pulseSoft rounded-full bg-brand-400" />
            Die Plattform für Taxiunternehmen
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Ihr eigenes{" "}
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">Taxi-Dispatch</span>{" "}
            – in Minuten startklar.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-300">
            Jedes Taxiunternehmen legt einen eigenen Account an und verwaltet Fahrer, Preise und
            Aufträge. Kunden buchen online, das System findet automatisch den nächsten freien Fahrer per GPS.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registrieren" className="btn-primary text-lg">Firma kostenlos registrieren</Link>
            <Link href="/admin/login" className="btn-ghost text-lg">Zur Zentrale anmelden</Link>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🏢", t: "Eigener Firmen-Account", d: "Getrennte Verwaltung von Fahrern, Preisen und Aufträgen." },
              { icon: "📍", t: "GPS-Auto-Zuweisung", d: "Der nächste freie Fahrer bekommt den Auftrag automatisch." },
              { icon: "💶", t: "Flexible Tarife", d: "Tag-, Nacht- und Wochenendtarif plus Grundpreis frei einstellbar." },
            ].map((f) => (
              <div key={f.t} className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10">
                <div className="text-2xl">{f.icon}</div>
                <div className="mt-3 text-lg font-semibold">{f.t}</div>
                <div className="mt-1 text-sm text-ink-400">{f.d}</div>
              </div>
            ))}
          </div>

          {/* Demo */}
          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <p className="eyebrow text-ink-400">Demo ausprobieren</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link href="/c/citytaxi" className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09]">
                <div className="font-semibold">🧍 Kundenansicht</div>
                <div className="mt-1 text-sm text-ink-400">Taxi bei „CityTaxi Hannover" bestellen</div>
              </Link>
              <Link href="/fahrer" className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09]">
                <div className="font-semibold">🧑‍✈️ Fahrer-App</div>
                <div className="mt-1 text-sm text-ink-400">fahrer1 … fahrer6 / taxi123</div>
              </Link>
              <Link href="/admin/login" className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.09]">
                <div className="font-semibold">🖥️ Zentrale</div>
                <div className="mt-1 text-sm text-ink-400">admin@citytaxi.de / admin123</div>
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-ink-400 sm:flex-row">
            <Brand subtitle="Taxi-Vermittlung für Unternehmen" tone="light" />
            <div className="flex items-center gap-5">
              <Link href="/registrieren" className="hover:text-white">Registrieren</Link>
              <Link href="/admin/login" className="hover:text-white">Firmen-Login</Link>
              <Link href="/fahrer" className="hover:text-white">Fahrer</Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
