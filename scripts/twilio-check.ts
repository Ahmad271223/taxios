// Prueft die Twilio-Zugangsdaten: Kontostatus, Guthaben, verifizierte
// Empfaenger (wichtig bei Trial-Konten) und eigene Nummern.
//   npx tsx scripts/twilio-check.ts [testnummer]
import "../src/server/env";
import twilio from "twilio";

async function main() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM!;
  if (!sid || !token) {
    console.log("Keine Twilio-Zugangsdaten in .env");
    process.exit(1);
  }
  const client = twilio(sid, token);

  // 1) Konto
  const acct = await client.api.v2010.accounts(sid).fetch();
  console.log(`1) Konto: "${acct.friendlyName}" | Status: ${acct.status} | Typ: ${acct.type}`);

  // 2) Guthaben
  try {
    const bal = await client.balance.fetch();
    console.log(`2) Guthaben: ${bal.balance} ${bal.currency}`);
  } catch {
    console.log("2) Guthaben: nicht abrufbar");
  }

  // 3) Eigene Twilio-Nummern
  const nums = await client.incomingPhoneNumbers.list({ limit: 5 });
  console.log(`3) Twilio-Nummern: ${nums.map((n) => n.phoneNumber).join(", ") || "keine"} (FROM=${from})`);

  // 4) Verifizierte Empfaenger (Trial darf NUR an diese senden)
  const verified = await client.outgoingCallerIds.list({ limit: 10 });
  console.log(`4) Verifizierte Empfaenger: ${verified.map((v) => v.phoneNumber).join(", ") || "KEINE"}`);

  // 5) Optional: Test-SMS an angegebene oder erste verifizierte Nummer
  const target = process.argv[2] ?? verified[0]?.phoneNumber;
  if (target) {
    try {
      const msg = await client.messages.create({
        to: target,
        from,
        body: "TaxiConnect Test-SMS: Twilio ist korrekt eingerichtet! 🚕",
      });
      console.log(`5) Test-SMS an ${target}: SID ${msg.sid} | Status: ${msg.status}`);
    } catch (err: any) {
      console.log(`5) Test-SMS an ${target} FEHLGESCHLAGEN: Code ${err?.code} | ${err?.message}`);
    }
  } else {
    console.log("5) Keine Zielnummer fuer Test-SMS (keine verifizierte Nummer vorhanden).");
  }
}

main().catch((e) => {
  console.error("Twilio-Check fehlgeschlagen:", e?.message ?? e);
  process.exit(1);
});
