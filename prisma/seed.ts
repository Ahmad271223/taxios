import "../src/server/env"; // .env laden, bevor PrismaClient initialisiert wird
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CENTER_LAT = Number(process.env.DEFAULT_LAT ?? 52.375892);
const CENTER_LNG = Number(process.env.DEFAULT_LNG ?? 9.732010);

function jitter(value: number, spread = 0.03): number {
  return value + (Math.random() - 0.5) * spread * 2;
}

const DRIVERS = [
  { username: "fahrer1", name: "Murat Demir", phone: "+49 511 1000001", vehicleModel: "Mercedes E-Klasse", vehiclePlate: "H-TX 1001", vehicleColor: "Beige", vehicleSeats: 4 },
  { username: "fahrer2", name: "Anna Schmidt", phone: "+49 511 1000002", vehicleModel: "VW Passat", vehiclePlate: "H-TX 1002", vehicleColor: "Schwarz", vehicleSeats: 4 },
  { username: "fahrer3", name: "Kemal Yilmaz", phone: "+49 511 1000003", vehicleModel: "Toyota Prius", vehiclePlate: "H-TX 1003", vehicleColor: "Weiss", vehicleSeats: 4 },
  { username: "fahrer4", name: "Maria Rossi", phone: "+49 511 1000004", vehicleModel: "Skoda Octavia", vehiclePlate: "H-TX 1004", vehicleColor: "Silber", vehicleSeats: 4 },
  { username: "fahrer5", name: "Tom Becker", phone: "+49 511 1000005", vehicleModel: "Mercedes V-Klasse", vehiclePlate: "H-TX 1005", vehicleColor: "Beige", vehicleSeats: 7 },
  { username: "fahrer6", name: "Lena Wagner", phone: "+49 511 1000006", vehicleModel: "BMW 5er", vehiclePlate: "H-TX 1006", vehicleColor: "Dunkelblau", vehicleSeats: 4 },
];

async function main() {
  console.log("Seed: Datenbank wird befuellt ...");

  const pass = await bcrypt.hash("admin123", 10);
  const company = await prisma.company.upsert({
    where: { slug: "citytaxi" },
    update: {},
    create: {
      name: "CityTaxi Hannover",
      slug: "citytaxi",
      address: "Bahnhofstraße 1, 30159 Hannover",
      phone: "0511 123456",
      email: "admin@citytaxi.de",
      passwordHash: pass,
      pricing: {
        create: {
          basePrice: 4.0,
          perKmDay: 2.5,
          perKmNight: 3.2,
          perKmWeekend: 2.8,
          perMinute: 0.0,
          nightStartHour: 22,
          nightEndHour: 6,
        },
      },
    },
  });
  console.log(`  Firma angelegt: ${company.name} (Login: admin@citytaxi.de / admin123)`);
  console.log(`  Kunden-Buchungslink: /c/${company.slug}`);

  const driverPass = await bcrypt.hash("taxi123", 10);
  for (const d of DRIVERS) {
    await prisma.driver.upsert({
      where: { username: d.username },
      update: {
        companyId: company.id,
        name: d.name,
        phone: d.phone,
        vehicleModel: d.vehicleModel,
        vehiclePlate: d.vehiclePlate,
        vehicleColor: d.vehicleColor,
        vehicleSeats: d.vehicleSeats,
        status: "FREI",
        lat: jitter(CENTER_LAT),
        lng: jitter(CENTER_LNG),
        lastSeenAt: new Date(),
      },
      create: {
        companyId: company.id,
        username: d.username,
        passwordHash: driverPass,
        name: d.name,
        phone: d.phone,
        status: "FREI",
        lat: jitter(CENTER_LAT),
        lng: jitter(CENTER_LNG),
        lastSeenAt: new Date(),
        vehicleModel: d.vehicleModel,
        vehiclePlate: d.vehiclePlate,
        vehicleColor: d.vehicleColor,
        vehicleSeats: d.vehicleSeats,
      },
    });
  }
  console.log(`  ${DRIVERS.length} Fahrer angelegt (Login: fahrer1..fahrer6 / taxi123)`);
  console.log("Seed abgeschlossen.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
