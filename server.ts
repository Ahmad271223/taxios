// Custom-Server: Next.js + Express + Socket.IO + Dispatch-Engine in EINEM
// Prozess. Start: npm run dev
import "./src/server/env"; // muss zuerst stehen (laedt .env)

import { createServer } from "http";
import express from "express";
import next from "next";
import { Server as IOServer } from "socket.io";

import { Dispatcher } from "./src/server/dispatch";
import { registerSockets } from "./src/server/realtime";
import { Simulator } from "./src/server/simulator";
import { setRuntime } from "./src/server/runtime";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const nextApp = next({ dev });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  const httpServer = createServer(app);
  const io = new IOServer(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // Dispatch-Engine initialisieren und global verfuegbar machen.
  const dispatcher = new Dispatcher(io);
  await dispatcher.init();
  setRuntime({ io, dispatcher });

  const realDrivers = new Set<string>();
  registerSockets(io, dispatcher, realDrivers);

  // GPS-Simulator (optional, fuer Demo ohne echte Smartphones).
  if (process.env.ENABLE_SIMULATOR === "1") {
    const sim = new Simulator(dispatcher, realDrivers);
    await sim.start();
  }

  // Alle uebrigen Requests an Next.js durchreichen.
  app.all("*", (req, res) => handle(req, res));

  httpServer.listen(port, () => {
    console.log(`\n  ➜  TaxiConnect läuft auf http://localhost:${port}`);
    console.log(`     Plattform/Registrierung: http://localhost:${port}/`);
    console.log(`     Kunde (Demo-Firma):      http://localhost:${port}/c/citytaxi`);
    console.log(`     Fahrer:                  http://localhost:${port}/fahrer  (fahrer1..6 / taxi123)`);
    console.log(`     Zentrale:                http://localhost:${port}/admin   (admin@citytaxi.de / admin123)\n`);
  });
}

main().catch((err) => {
  console.error("Serverstart fehlgeschlagen:", err);
  process.exit(1);
});
