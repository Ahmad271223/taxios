// End-to-End-Test der Echtzeitpfade (Fahrer- & Admin-Dashboard):
//   npx tsx scripts/test-realtime.ts
// 1. Login (Cookie) wie der Browser
// 2. Socket.IO-Verbindung mit Cookie-Handshake
// 3. Erwartet driver:state bzw. admin:snapshot -> beweist, dass die
//    Dashboards live Daten erhalten (kein "Einfrieren").
import { io } from "socket.io-client";

const BASE = "http://localhost:3000";

async function loginCookie(body: any): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Login fehlgeschlagen: ${res.status}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/tc_session=[^;]+/);
  if (!m) throw new Error("Kein Session-Cookie erhalten");
  return m[0];
}

function connectAndWait(cookie: string, event: string, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      extraHeaders: { Cookie: cookie },
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout: ${event} kam nicht innerhalb ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on(event, (data: any) => {
      clearTimeout(timer);
      socket.disconnect();
      resolve(data);
    });
    socket.on("connect_error", (e: any) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(e);
    });
  });
}

async function main() {
  // Fahrer
  const driverCookie = await loginCookie({ username: "fahrer1", password: "taxi123", role: "DRIVER" });
  const state = await connectAndWait(driverCookie, "driver:state");
  console.log(
    `1) FAHRER-Dashboard OK -> driver:state empfangen: name=${state.name}, status=${state.status}, aktive Fahrt=${state.activeBooking ? "ja" : "nein"}, offene Vorbestellungen=${state.openScheduled?.length ?? 0}`,
  );

  // Zweite Verbindung nacheinander (simuliert resetSocket nach Re-Login)
  const state2 = await connectAndWait(driverCookie, "driver:state");
  console.log(`2) Re-Connect OK -> driver:state erneut empfangen (status=${state2.status})`);

  // Admin
  const adminCookie = await loginCookie({ username: "admin@citytaxi.de", password: "admin123", role: "ADMIN" });
  const snap = await connectAndWait(adminCookie, "admin:snapshot");
  console.log(
    `3) ADMIN-Dashboard OK -> admin:snapshot: ${snap.drivers.length} Fahrer, ${snap.bookings.length} aktive Auftraege, ${snap.scheduled.length} Vorbestellungen`,
  );

  process.exit(0);
}

main().catch((e) => {
  console.error("TEST FEHLGESCHLAGEN:", e?.message ?? e);
  process.exit(1);
});
