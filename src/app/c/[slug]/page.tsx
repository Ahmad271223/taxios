import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CompanyHome({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({ where: { slug: params.slug } });
  if (!company) notFound();

  const tel = (company.phone ?? "").replace(/[^0-9+]/g, "");

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl" />

      <div className="relative">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 to-brand-500 text-xl shadow-glow ring-1 ring-white/30">
              🚕
            </span>
            <span className="text-lg font-extrabold tracking-tight">{company.name}</span>
          </div>
          <Link href="/fahrer" className="rounded-xl px-3.5 py-2 text-sm font-medium text-ink-200 transition hover:bg-white/10 hover:text-white">
            Fahrer-Login
          </Link>
        </header>

        <section className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pt-20">
          <span className="chip bg-white/10 text-brand-200 ring-1 ring-white/15">
            <span className="h-2 w-2 animate-pulseSoft rounded-full bg-brand-400" />
            GPS-Vermittlung · {company.address?.split(",").pop()?.trim() || "Hannover"}
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Wohin soll es{" "}
            <span className="bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">gehen?</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-300">
            Bestellen Sie Ihr Taxi bei {company.name} – sofort oder im Voraus. Der nächste freie
            Fahrer wird automatisch per GPS gefunden.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Link href={`/c/${company.slug}/buchen`} className="group rounded-3xl bg-gradient-to-b from-brand-300 to-brand-500 p-6 shadow-glow transition hover:-translate-y-1">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-950/10 text-2xl">🚕</div>
              <div className="mt-4 text-xl font-bold text-ink-950">Jetzt Taxi bestellen</div>
              <div className="mt-1 text-sm text-ink-900/70">Sofort einen freien Fahrer rufen.</div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-900">Auswählen →</span>
            </Link>

            <Link href={`/c/${company.slug}/buchen/vorbestellung`} className="group rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-white/[0.08]">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-2xl">🗓️</div>
              <div className="mt-4 text-xl font-bold">Später bestellen</div>
              <div className="mt-1 text-sm text-ink-400">Termin im Voraus reservieren.</div>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-300">Auswählen →</span>
            </Link>

            {company.phone && (
              <a href={`tel:${tel}`} className="group rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/10 transition hover:-translate-y-1 hover:bg-white/[0.08]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/15 text-2xl">📞</div>
                <div className="mt-4 text-xl font-bold">Telefonisch</div>
                <div className="mt-1 text-sm text-ink-400">{company.phone}</div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-300">Anrufen →</span>
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
