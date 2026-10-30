# Berichtsheft-Generator – HYDROTEC Technologies AG

Schlanke Web-App, mit der die Auszubildenden der HYDROTEC Technologies AG ihren
wöchentlichen Ausbildungsnachweis (Berichtsheft) ausfüllen und als PDF exportieren.

## Was die App macht

- **Kopfdaten:** Name, Abteilung und Ausbildungsjahr per Dropdown (Name und Abteilung auch als Freitext über „Sonstige“).
- **Kalenderwoche:** Beim Öffnen wird automatisch die aktuelle ISO-Kalenderwoche angezeigt. Mit ◀ ▶ blättert man zur Vor- oder Folgewoche. Die Eingaben bleiben dabei erhalten.
- **Tage Montag bis Freitag:** Für jeden Tag wählt man Betrieb, Berufsschule, Urlaub, Krank oder Feiertag. Bei Betrieb und Berufsschule trägt man Tätigkeiten bzw. Themen und die Stunden ein (Standard: 8 h Betrieb, 6 h Schule).
- **Feiertage Niedersachsen** werden automatisch erkannt (Ostern wird per Gauß/Meeus-Formel berechnet, keine API) und können manuell überschrieben werden.
- **PDF-Export** (A4, im Browser mit jsPDF): Logo, Kopfdaten, Wochentabelle, Wochensumme, Unterschriftslinien, Fußzeile mit Seitenzahl.
  Dateiname: `Berichtsheft_Nachname_KW44_2026_Abteilung.pdf`
- **Mail-Vorlage:** Nach dem Export erscheinen Betreff und Mailtext mit „Kopieren“-Buttons.
- **Datenschutz:** Es wird **nichts gespeichert**: kein Server, kein localStorage, keine Cookies. Beim Verlassen der Seite mit ungespeicherten Eingaben warnt der Browser.

## Namen und Abteilungen ändern

Ganz oben in [`public/app.js`](public/app.js) stehen zwei Listen:

```js
const AZUBIS = [
  'Jeremy Turgut',
  'Berdan Öner',
  // …
];

const ABTEILUNGEN = [
  'Buchhaltung',
  'Einkauf',
  // …
];
```

Einträge einfach hinzufügen, löschen oder umbenennen (jeweils in einfachen
Anführungszeichen, mit Komma getrennt). Der Eintrag „Sonstige“ wird automatisch
angehängt. Nach dem Commit auf `main` ist die Änderung automatisch online (siehe unten).

## Projektstruktur

```
public/                 ← alles, was ausgeliefert wird
  index.html
  style.css
  app.js                ← App-Logik, Namens- und Abteilungslisten
  kalender.js           ← Kalenderwochen, Ostern, Feiertage
  logo.jpg
  vendor/               ← jsPDF + jspdf-autotable (lokal, kein CDN)
tests/kalender.test.js  ← Tests für KW- und Feiertagsberechnung
wrangler.jsonc          ← Cloudflare-Konfiguration (nur Static Assets)
```

Es gibt kein Framework und keinen Build-Schritt.

## Lokal ausprobieren

Einen beliebigen statischen Webserver im Ordner `public` starten, z. B.:

```bash
cd public && python3 -m http.server 8080
```

Dann <http://localhost:8080> öffnen. (Direktes Öffnen der `index.html` per Doppelklick
funktioniert auch, dann fehlt aber ggf. das Logo im PDF.)

Tests (Node.js 18+):

```bash
node --test tests/kalender.test.js
```

## Deployment über Cloudflare Workers

Die App läuft als **Cloudflare Worker mit Static Assets**, also ohne Worker-Script.
`wrangler.jsonc` liefert nur den Ordner `./public` aus.

Einmalige Einrichtung:

1. Im Cloudflare-Dashboard **Workers & Pages → Erstellen → Worker → „Import a repository“** wählen.
2. GitHub verbinden und dieses Repository auswählen.
3. Einstellungen:
   - Production branch: `main`
   - Build command: *leer lassen*
   - Deploy command: `npx wrangler deploy` (Standard)
4. Speichern und deployen. Die App ist danach unter `https://hydrotec-berichtsheft.<account>.workers.dev`
   erreichbar. Eine eigene Domain kann unter *Settings → Domains & Routes* ergänzt werden.

Danach wird jeder Push auf `main` automatisch veröffentlicht. Für Pull Requests
erzeugt Cloudflare Vorschau-Versionen.

Manuelles Deployment (optional, mit installiertem Node.js):

```bash
npx wrangler deploy
```

## Bibliotheken aktualisieren

Die Dateien in `public/vendor/` stammen aus den npm-Paketen
[`jspdf`](https://www.npmjs.com/package/jspdf) (`dist/jspdf.umd.min.js`, v4.2.1) und
[`jspdf-autotable`](https://www.npmjs.com/package/jspdf-autotable)
(`dist/jspdf.plugin.autotable.min.js`, v5.0.9), beide MIT-lizenziert.
Zum Aktualisieren die neuen Dateien aus den Paketen an dieselbe Stelle kopieren.
