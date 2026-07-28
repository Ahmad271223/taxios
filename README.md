# 🚕 TaxiConnect

Moderne, kostengünstige **Taxi-Vermittlungsplattform** für ein Unternehmen mit 6 Fahrern –
mit **automatischer GPS-Fahrerzuweisung**, Echtzeit-Tracking und Verwaltungszentrale.
Läuft komplett im Browser, ohne App-Installation, auf Smartphone, Tablet und Desktop.

---

## ✨ Funktionen (Phase 1 – umgesetzt)

**Kunde**
- Taxi sofort bestellen oder vorbestellen (Datum/Uhrzeit)
- Adress-Autovervollständigung (OpenStreetMap)
- Automatische **Preisvorschau** (Entfernung, Fahrzeit, Preisspanne)
- **Live-Auftragsverfolgung** mit Karte: *Auftrag eingegangen → Fahrer gefunden →
  unterwegs → angekommen → Fahrt läuft → beendet*
- Fahrerinformationen (Name, Fahrzeug, Kennzeichen, geschätzte Ankunft)

**Automatische Vermittlung**
- Jeder Fahrer sendet seine GPS-Position laufend an die Zentrale
- Der **nächstgelegene freie Fahrer** wird automatisch ermittelt (Luftlinie/Haversine)
- 30-Sekunden-Annahmefenster – bei Ablehnung/Timeout geht der Auftrag automatisch
  an den nächsten Fahrer
- Wird kein Fahrer gefunden, wird erneut zugewiesen, sobald ein Fahrer frei wird

**Fahrer**
- Login, Status (Frei / Besetzt / Pause / Offline)
- Auftragsangebote mit Countdown – annehmen oder ablehnen
- Aktiver Auftrag mit „Navigation starten" (Google Maps), Angekommen / Fahrt starten / Beenden
- Vorbestellungen reservieren, Tageseinnahmen, letzte Fahrten

**Administrator / Zentrale**
- Dashboard: aktive/freie/besetzte Fahrer, aktive Aufträge, Umsatz, Ø Fahrpreis
- **Live-Karte** mit allen Fahrerstandorten (farbig nach Status) und Abholpunkten
- Auftragsüberwachung mit Stornierung
- Fahrer- und Fahrzeugverwaltung
- Vorbestellungsliste

---

## 🧰 Technologie

| Bereich        | Technologie |
|----------------|-------------|
| Frontend       | Next.js 14 (App Router, React 18), Tailwind CSS |
| Backend        | Node.js + Express, in den Next.js-Server integriert |
| Echtzeit       | Socket.IO (WebSockets) |
| Datenbank      | Prisma ORM + SQLite (1-Zeilen-Umstieg auf PostgreSQL) |
| Karten/Geo     | OpenStreetMap + Leaflet, Nominatim (Geocoding), OSRM (Route/Distanz) |
| Auth           | JWT im httpOnly-Cookie, bcrypt-Passwörter, Rollen (Admin/Fahrer) |

Alle Kartendienste sind **kostenlos und ohne API-Key** nutzbar.

---

## 🚀 Schnellstart

Voraussetzung: Node.js 18+ (getestet mit Node 24).

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Datenbank anlegen + Beispieldaten (Admin + 6 Fahrer)
npm run setup

# 3. Server starten
npm run dev
```

Dann im Browser öffnen: **http://localhost:3000**

### Multi-Mandant (mehrere Taxiunternehmen)

Jedes Taxiunternehmen legt unter **`/registrieren`** einen eigenen Account an (Firmenname,
Adresse, Telefon, E-Mail, Passwort) und erhält einen eigenen Kunden-Buchungslink
**`/c/<slug>`**. Fahrer, Preise und Aufträge sind pro Firma vollständig getrennt.

### Demo-Zugänge

| Bereich   | URL                  | Login |
|-----------|----------------------|-------|
| Plattform | `/`                  | – (Registrierung / Login) |
| Kunde     | `/c/citytaxi`        | – (kein Login) |
| Fahrer    | `/fahrer`            | `fahrer1` … `fahrer6` / `taxi123` |
| Zentrale  | `/admin`             | `admin@citytaxi.de` / `admin123` |

Die Tarife (Tag / Nacht / Wochenende / Grundpreis) sind je Firma unter **`/admin/preise`**
einstellbar und werden automatisch je nach Wochentag und Uhrzeit angewendet.

> **GPS-Simulator:** Standardmäßig (`ENABLE_SIMULATOR=1`) bewegen sich die 6 Fahrer
> automatisch auf der Karte und nehmen Aufträge an – so lässt sich der komplette Ablauf
> ohne echte Smartphones testen. Sobald sich ein echter Fahrer einloggt (z. B. `fahrer1`),
> übernimmt die echte Person die Kontrolle über diesen Fahrer; die übrigen bleiben simuliert.

**Ablauf zum Ausprobieren:** Auf `/` „Taxi jetzt bestellen", Adressen wählen (z. B. zwei
Orte in Hannover, etwa Kröpcke → Maschsee), bestellen → die Tracking-Seite zeigt live, wie ein Fahrer zugewiesen wird
und auf der Karte zur Abholung fährt. Parallel auf `/admin` (Login admin/admin123) die
Live-Karte beobachten.

---

## ⚙️ Konfiguration (`.env`)

```ini
DATABASE_URL="file:./dev.db"   # SQLite (Dev). Für PostgreSQL siehe unten.
AUTH_SECRET="..."              # In Produktion zwingend ändern!
PORT=3000
DEFAULT_LAT=52.375892          # Stadt-Mittelpunkt (Seed + Simulator): Hannover
DEFAULT_LNG=9.732010
ENABLE_SIMULATOR=1             # 0 = Simulator aus
TARIFF_BASE=3.90               # Grundpreis €
TARIFF_PER_KM=2.20             # € pro km
TARIFF_PER_MIN=0.40            # € pro Minute
```

### Umstieg auf PostgreSQL (Produktion)

1. In `prisma/schema.prisma` `provider = "sqlite"` → `provider = "postgresql"`
2. In `.env`: `DATABASE_URL="postgresql://user:pass@host:5432/taxiconnect"`
3. `npx prisma migrate dev` (oder `npm run setup`)

### Google Maps statt OpenStreetMap

Geocoding/Routing/Karten sind in `src/lib/geo.ts` bzw. `src/components/Map.tsx` gekapselt
und können dort gegen die Google-Maps-APIs ausgetauscht werden.

---

## 📁 Projektstruktur

```
server.ts                  Custom-Server: Next.js + Express + Socket.IO + Dispatch
prisma/
  schema.prisma            Datenmodell (Admin, Driver, Booking)
  seed.ts                  Beispieldaten (Admin + 6 Fahrer)
src/
  server/
    dispatch.ts            Dispatch-Engine (GPS-Zuweisung, 30s-Timeout, Reassignment)
    realtime.ts            Socket.IO-Handler (Auth via Cookie, Rooms)
    simulator.ts           GPS-Simulator für virtuelle Fahrer
    serialize.ts           DTO-Serialisierung
    runtime.ts             Bridge (globalThis) zwischen Server & Next-Route-Handlern
  lib/
    geo.ts                 Haversine, Nominatim-Geocoding, OSRM-Routing, Preislogik
    auth.ts / session.ts   JWT, bcrypt, Rollen
    status.ts / format.ts  Status-Labels, Formatierung
  components/              Map, BookingForm, TrackingView, DriverPortal, AdminDashboard …
  app/
    page.tsx               Kunden-Startseite
    buchen/                Sofort- & Vorbestellung
    verfolgen/[id]/        Live-Tracking
    fahrer/                Fahrerportal + Login
    admin/                 Zentrale (Dashboard, Fahrerverwaltung) + Login
    api/                   Route-Handler (auth, geocode, quote, bookings, admin, driver)
```

---

## 🔐 Sicherheit

- Passwörter mit **bcrypt** gehasht
- Sessions als **signiertes JWT im httpOnly-Cookie**, Rollen-/Rechteprüfung serverseitig
- In Produktion zusätzlich: **HTTPS** (Reverse Proxy), `AUTH_SECRET` setzen,
  `secure`-Cookies (automatisch bei `NODE_ENV=production`)
- DSGVO: nur notwendige Personendaten werden gespeichert; Aufträge können archiviert/gelöscht werden

---

## 📱 SMS-Benachrichtigungen (Twilio – echt)

Kunden erhalten automatisch SMS bei: Bestellung eingegangen, Fahrer unterwegs
(mit Fahrzeug + Tracking-Link), Fahrer angekommen, Fahrt beendet (mit Preis).

Einrichtung (https://console.twilio.com):
```ini
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+49xxxxxxxxxx        # Twilio-Nummer ODER Messaging-Service (MG...)
APP_BASE_URL=https://ihre-domain.de
```
Ohne diese Werte werden SMS nur ins Server-Log geschrieben (kein Fehler).
Schnelltest: `npx tsx scripts/test-notify.ts`

## 💳 Kartenzahlung mit Stripe Connect

Jede Firma verbindet ihr **eigenes Stripe-Konto** (Express-Onboarding unter
`/admin/zahlungen`). Zahlt der Kunde nach der Fahrt per Karte, geht das Geld
als *Destination Charge* **direkt an das Konto der Firma** – optional abzüglich
einer Plattform-Provision (`PLATFORM_FEE_PERCENT`).

Ablauf: Kunde wählt bei der Buchung „💳 Karte" → nach Fahrtende erscheint auf der
Tracking-Seite „Jetzt mit Karte bezahlen" → Stripe Checkout → Webhook markiert
die Fahrt als bezahlt.

Einrichtung (https://dashboard.stripe.com):
```ini
STRIPE_SECRET_KEY=sk_live_...     # oder sk_test_... zum Testen
STRIPE_WEBHOOK_SECRET=whsec_...   # Webhook-Endpoint: /api/stripe/webhook
PLATFORM_FEE_PERCENT=0            # optionale Provision in %
APP_BASE_URL=https://ihre-domain.de
```
Im Stripe-Dashboard: **Connect** aktivieren (Express-Konten) und einen Webhook
auf `https://<domain>/api/stripe/webhook` mit den Events
`checkout.session.completed` und `account.updated` anlegen.
Lokal testen: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## 🗺️ Roadmap

- PayPal / Apple Pay / Google Pay (via Stripe Checkout aktivierbar)
- **Phase 3:** Native Apps (Android / iOS)
- E-Mail/Push-Benachrichtigungen (SMS bereits umgesetzt)

---

*Erstellt als kleines bis mittleres Softwareprojekt – ein vollständiger,
digitalisierter Vermittlungsprozess mit automatischer GPS-Zuweisung.*
