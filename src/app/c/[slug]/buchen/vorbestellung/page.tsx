import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function CompanyVorbestellung({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({ where: { slug: params.slug } });
  if (!company) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-ink-50 to-ink-100">
      <header className="sticky top-0 z-10 border-b border-ink-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-300 to-brand-500 text-lg shadow-glow">🚕</span>
            <span className="font-extrabold tracking-tight text-ink-900">{company.name}</span>
          </div>
          <Link href={`/c/${company.slug}`} className="text-sm font-medium text-ink-500 hover:text-ink-900">← Zurück</Link>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-5 py-8">
        <span className="chip bg-brand-100 text-brand-700">🗓️ Vorbestellung</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900">Taxi später bestellen</h1>
        <p className="mt-1.5 text-ink-600">
          Reservieren Sie Ihre Fahrt für einen späteren Zeitpunkt. Ein Fahrer wird rechtzeitig automatisch zugewiesen.
        </p>
        <div className="card mt-6 p-6">
          <BookingForm scheduled companySlug={company.slug} />
        </div>
      </section>
    </main>
  );
}
