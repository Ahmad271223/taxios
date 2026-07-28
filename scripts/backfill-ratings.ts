// Einmaliger Backfill: bestehende Fahrt-Bewertungen in die
// denormalisierten Fahrer-Felder (ratingSum/ratingCount) uebernehmen.
//   npx tsx scripts/backfill-ratings.ts
import "../src/server/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rated = await prisma.booking.findMany({
    where: { rating: { not: null }, driverId: { not: null } },
    select: { driverId: true, rating: true },
  });

  const agg = new Map<string, { sum: number; count: number }>();
  for (const b of rated) {
    const a = agg.get(b.driverId!) ?? { sum: 0, count: 0 };
    a.sum += b.rating!;
    a.count++;
    agg.set(b.driverId!, a);
  }

  // Erst alle zuruecksetzen (idempotent), dann Summen setzen.
  await prisma.driver.updateMany({ data: { ratingSum: 0, ratingCount: 0 } });
  for (const [driverId, a] of agg) {
    await prisma.driver.update({
      where: { id: driverId },
      data: { ratingSum: a.sum, ratingCount: a.count },
    });
  }

  const drivers = await prisma.driver.findMany({ where: { ratingCount: { gt: 0 } } });
  for (const d of drivers) {
    console.log(`  ${d.name}: Ø ${(d.ratingSum / d.ratingCount).toFixed(1)} ★ (${d.ratingCount})`);
  }
  console.log(`Backfill fertig: ${agg.size} Fahrer aktualisiert, ${rated.length} Bewertungen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
