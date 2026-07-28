// Echte SMS-Benachrichtigungen via Twilio.
// Aktiv, sobald TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM gesetzt sind.
// Ohne Konfiguration wird nur geloggt (kein Fehler, kein Versand).

import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;
let initialized = false;

function getClient() {
  if (initialized) return client;
  initialized = true;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token && sid.startsWith("AC")) {
    try {
      client = twilio(sid, token);
    } catch {
      client = null;
    }
  }
  return client;
}

export function smsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  );
}

export function baseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

// Deutsche Rufnummern grob normalisieren (0511... -> +49511...).
function normalizePhone(p: string): string {
  const s = (p ?? "").replace(/[^\d+]/g, "");
  if (!s) return s;
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return "+49" + s.slice(1);
  return "+" + s;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const c = getClient();
  const from = process.env.TWILIO_FROM;
  const normalized = normalizePhone(to);
  if (!c || !from || !normalized) {
    console.log(`[SMS (nicht konfiguriert) -> ${to}] ${body}`);
    return;
  }
  try {
    const opts: any = { to: normalized, body };
    if (from.startsWith("MG")) opts.messagingServiceSid = from;
    else opts.from = from;
    await c.messages.create(opts);
  } catch (err: any) {
    console.error("Twilio SMS Fehler:", err?.message ?? err);
  }
}
