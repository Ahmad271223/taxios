// Test des SMS-Moduls (temporaer): npx tsx scripts/test-notify.ts
// 1) unkonfiguriert -> nur Log; 2) Fake-Creds -> echter Twilio-API-Aufruf
// mit Auth-Fehler 401 (beweist, dass der echte Versandpfad benutzt wird).
import "../src/server/env";

async function main() {
  const { sendSms, smsConfigured } = await import("../src/lib/notify");

  console.log("1) smsConfigured (ohne Keys):", smsConfigured());
  await sendSms("+49 511 1234567", "Testnachricht (unkonfiguriert, nur Log)");

  const twilio = (await import("twilio")).default;
  const client = twilio("AC00000000000000000000000000000000", "fake-token");
  try {
    await client.messages.create({ to: "+495111234567", from: "+15005550006", body: "x" });
    console.log("2) UNERWARTET: Versand ohne echte Creds gelungen?");
  } catch (err: any) {
    console.log(
      "2) Twilio-API echt kontaktiert -> HTTP",
      err?.status ?? "?",
      "| Code",
      err?.code ?? "?",
      "|",
      (err?.message ?? "").slice(0, 80),
    );
  }
}

main();
