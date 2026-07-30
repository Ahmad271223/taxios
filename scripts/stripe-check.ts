// Prueft den Stripe-Schluessel: Gueltigkeit, Berechtigungen fuer
// Checkout-Sessions und Connect-Konten (Express).
//   npx tsx scripts/stripe-check.ts
import "../src/server/env";
import Stripe from "stripe";

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.log("Kein STRIPE_SECRET_KEY in .env");
    process.exit(1);
  }
  console.log(`Schluessel-Typ: ${key.slice(0, 8)}... (${key.startsWith("rk_") ? "Restricted Key" : "Secret Key"}, ${key.includes("_test_") ? "TESTMODUS" : "LIVE"})`);
  const stripe = new Stripe(key);

  // 1) Grundfunktion: Balance lesen
  try {
    const bal = await stripe.balance.retrieve();
    const avail = bal.available?.[0];
    console.log(`1) Verbindung OK | Guthaben: ${(avail?.amount ?? 0) / 100} ${avail?.currency?.toUpperCase() ?? ""}`);
  } catch (e: any) {
    console.log(`1) Verbindung/Balance FEHLER: ${e?.message}`);
  }

  // 2) Checkout-Session-Berechtigung (nur Lesen der Liste als Permission-Test)
  try {
    await stripe.checkout.sessions.list({ limit: 1 });
    console.log("2) Checkout-Sessions: Berechtigung OK");
  } catch (e: any) {
    console.log(`2) Checkout-Sessions FEHLER: ${e?.code ?? ""} ${e?.message}`);
  }

  // 3) Connect: Konten lesen + testweise Express-Konto anlegen
  try {
    await stripe.accounts.list({ limit: 1 });
    console.log("3) Connect-Konten lesen: OK");
  } catch (e: any) {
    console.log(`3) Connect-Konten lesen FEHLER: ${e?.code ?? ""} ${e?.message}`);
  }
  try {
    const acct = await stripe.accounts.create({
      type: "express",
      country: "DE",
      email: "permission-test@example.com",
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });
    console.log(`4) Express-Konto anlegen: OK (${acct.id}) -> wird wieder geloescht`);
    await stripe.accounts.del(acct.id);
    console.log("   Testkonto geloescht.");
  } catch (e: any) {
    console.log(`4) Express-Konto anlegen FEHLER: ${e?.code ?? ""} ${e?.message}`);
  }
}

main().catch((e) => {
  console.error("Stripe-Check fehlgeschlagen:", e?.message ?? e);
  process.exit(1);
});
