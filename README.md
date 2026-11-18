# Berichtsheft-Generator – HYDROTEC Technologies AG

Web-App, mit der die Auszubildenden der HYDROTEC Technologies AG ihre wöchentlichen
Ausbildungsnachweise (Berichtsheft) schreiben, als PDF exportieren, später weiterschreiben
und am Ende zu einem Gesamt-Berichtsheft zusammenführen.

## Funktionen

### Bericht schreiben

- **Kopfdaten:** Name, Abteilung (beide auch als Freitext über „Sonstige“), Ausbildungsjahr,
  Ausbildungsbeginn und Nachweis-Nr.
- **Nachweis-Nr.:** Ist der Ausbildungsbeginn eingetragen, wird die Nr. automatisch berechnet
  (Woche des Ausbildungsbeginns = Nr. 1, jede Kalenderwoche zählt, auch Urlaubswochen).
  Sie kann manuell überschrieben werden; „automatisch berechnen“ stellt sie wieder zurück.
- **Tagesbericht | Wochenbericht** (Umschalter unter den Kopfdaten, Standard: Tagesbericht)
  - *Tagesbericht:* eine Karte pro Tag mit Art (Betrieb, Berufsschule, Urlaub, Krank, Feiertag), Text und Zeit.
  - *Wochenbericht:* kompakte Wochenübersicht (Tag, Art, Zeit) und drei mitwachsende Textfelder:
    „Betriebliche Tätigkeiten“ (Pflicht bei mind. einem Betriebstag), „Unterweisungen / Schulungen“
    (optional) und „Berufsschule – Themen / Fächer“ (Pflicht bei mind. einem Schultag, ausgeblendet,
    wenn in der Woche kein Schultag möglich ist).
  - Wechsel mit bereits eingetragenem Text nur nach Rückfrage. Kopfdaten, KW und Abwesenheiten bleiben.
- **Zeiten in Std:Min** (Stunden- und Minutenfeld, 0:00 bis 12:00). Nichts ist vorbelegt.
  Summen immer in Std:Min, im Wochenbericht zusätzlich getrennt nach Betrieb und Berufsschule.
- **Kalenderwoche:** Beim Öffnen die aktuelle ISO-Woche; ◀ ▶ und „Zur aktuellen Woche“.
  Beim Wochenwechsel werden Tage, Zeiten und Texte geleert (mit Rückfrage, wenn Text vorhanden ist).
  Kopfdaten, Modus, Ausbildungsbeginn und Abwesenheiten bleiben, die Nachweis-Nr. wird neu berechnet.
- **Abwesenheiten & Ferien:** Einträge mit Art (Urlaub, Krank, Ferien) und Von-/Bis-Datum, auch über
  mehrere Wochen. Jede Woche zeigt automatisch ihren Anteil. *Ferien* steht für bewegliche Ferientage
  der Schule: Betrieb möglich, Berufsschule nicht.
- **Automatik:** Gesetzliche Feiertage in Niedersachsen (Ostern nach Gauß/Meeus) und die Schulferien
  Niedersachsen werden erkannt. Feiertage haben Vorrang vor Ferien und Abwesenheiten, Krank vor Urlaub.
  An Ferientagen ist „Berufsschule“ nicht wählbar. Unter der Wochenübersicht steht eine Zusammenfassung,
  z. B. „Krank: 04.11.–05.11.2026 (2 Tage) · Feiertag: 31.10. Reformationstag · Ferien: 12.10.–16.10.2026“.
- **Export**
  - *Als Entwurf exportieren:* ohne Prüfung, diagonaler Stempel „ENTWURF“, Dateiname mit `_Entwurf`.
  - *Fertig exportieren:* prüft Name, Abteilung, Ausbildungsjahr, Nachweis-Nr., Art und Zeit an jedem
    Tag sowie die Pflichttexte. Fehlende Felder werden rot markiert. Danach erscheint die Mail-Box.
  - Dateiname: `Berichtsheft_Nachname_KW44_2026_Abteilung.pdf`
- **Mail-Vorlage:** Betreff und Mailtext (mit Nachweis-Nr. und Berichtsart) mit „Kopieren“-Buttons,
  dazu „In Outlook öffnen“ (mailto-Link ohne festen Empfänger). Das PDF muss man selbst anhängen.
- **PDF hochladen & weiterschreiben:** Jedes exportierte PDF (Entwurf oder fertig) enthält unsichtbar
  alle Formulardaten. Per Button oder Drag & Drop hochladen: Das Formular wird komplett wiederhergestellt
  und springt zur richtigen KW.

### Gesamt-Berichtsheft erstellen

Im zweiten Tab mehrere exportierte PDFs auswählen oder hineinziehen. Die App
- sortiert nach Jahr/KW, markiert fremde Dateien und Entwürfe (Entwürfe sind standardmäßig
  ausgeschlossen, per Haken einschließbar),
- warnt bei unterschiedlichen Namen,
- lässt bei doppelten Wochen wählen, welche Datei gilt (Standard: die zuletzt exportierte),
- zeigt fehlende Wochen zwischen Ausbildungsbeginn (sonst erster Woche) und letzter Woche,
- erstellt ein PDF mit Deckblatt, Übersichtstabelle und allen Originalseiten in der richtigen
  Reihenfolge: `Berichtsheft_Gesamt_Nachname_KW05-2026_bis_KW44-2026.pdf`.

### Datenschutz

Es wird **nichts gespeichert und nichts hochgeladen**: kein Server, kein localStorage, keine Cookies.
Die Daten leben nur im Formular und im exportierten PDF. Beim Verlassen der Seite mit ungespeicherten
Eingaben warnt der Browser.

## Pflege

### Namen und Abteilungen

Ganz oben in [`public/app.js`](public/app.js):

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

Einträge hinzufügen, löschen oder umbenennen (in einfachen Anführungszeichen, mit Komma getrennt).
„Sonstige“ wird automatisch angehängt.

### Schulferien

Ganz oben in [`public/ferien.js`](public/ferien.js) steht die Liste `SCHULFERIEN`, aktuell bis
einschließlich Weihnachten 2027/28. **Für 2028 ergänzen**, z. B.:

```js
{ name: 'Osterferien', von: '2028-MM-TT', bis: '2028-MM-TT' },
{ name: 'Ferientag',   von: '2028-MM-TT', bis: '2028-MM-TT' },   // einzelner Tag: von = bis
```

Datum im Format JJJJ-MM-TT, beide Tage inklusive, Liste chronologisch sortiert. Ein Test prüft
die Reihenfolge. Die offiziellen Termine veröffentlicht das Niedersächsische Kultusministerium.
Die gesetzlichen Feiertage werden berechnet und müssen nicht gepflegt werden.

Nach dem Commit auf `main` ist jede Änderung automatisch online (siehe Deployment).

## Projektstruktur

```
public/                   ← alles, was ausgeliefert wird (kein Build-Schritt)
  index.html, style.css
  app.js                  ← Oberfläche, Namens- und Abteilungslisten
  kalender.js             ← ISO-Kalenderwochen, Ostern, Feiertage
  ferien.js               ← Schulferien Niedersachsen (Liste zum Pflegen)
  zeit.js                 ← Std:Min parsen, formatieren, summieren
  bericht.js              ← Fachlogik: Abwesenheiten, Nachweis-Nr., Prüfung, JSON, Sammel-Analyse
  pdf.js                  ← PDF-Erzeugung, Daten einbetten/auslesen, Gesamt-PDF
  logo.jpg
  vendor/                 ← jsPDF, jspdf-autotable, pdf-lib (lokal, kein CDN)
tests/                    ← Unit-Tests (Node) und Browser-Test (Playwright)
wrangler.jsonc            ← Cloudflare-Konfiguration (nur Static Assets)
```

Die Logik-Module funktionieren im Browser und in Node.js und sind dadurch ohne Browser testbar.

### Eingebettete Daten

Beim Export wird `B.serialisiere(…)` als JSON zweifach ins PDF geschrieben: als Dateianhang
`berichtsheft.json` und als Base64-Eintrag `HydrotecBerichtsheft` im Dokument-Info-Verzeichnis
(Rückfallebene). Das JSON hat die Felder `schema: "hydrotec-berichtsheft"` und `version: 1`.
Bei Änderungen am Format die Version erhöhen und in `migriere()` (bericht.js) alte Versionen umwandeln,
damit ältere PDFs weiter hochgeladen werden können.

## Lokal ausprobieren

Einen statischen Webserver im Ordner `public` starten, z. B.:

```bash
cd public && python3 -m http.server 8080
```

Dann <http://localhost:8080> öffnen.

## Tests

Unit-Tests (Node.js 18+, keine Installation nötig):

```bash
node --test tests/kalender.test.js tests/ferien-zeit.test.js tests/bericht.test.js tests/pdf.test.js
```

Browser-Tests (klicken die App in Chromium durch; benötigen [Playwright](https://playwright.dev),
werden sonst übersprungen):

```bash
node --test tests/browser.test.js
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

Die Dateien in `public/vendor/` stammen aus npm-Paketen (alle MIT-lizenziert):

| Datei | Paket | Version |
|---|---|---|
| `jspdf.umd.min.js` | [`jspdf`](https://www.npmjs.com/package/jspdf) (`dist/`) | 4.2.1 |
| `jspdf.plugin.autotable.min.js` | [`jspdf-autotable`](https://www.npmjs.com/package/jspdf-autotable) (`dist/`) | 5.0.9 |
| `pdf-lib.min.js` | [`pdf-lib`](https://www.npmjs.com/package/pdf-lib) (`dist/`) | 1.17.1 |

Zum Aktualisieren die neuen Dateien aus den Paketen an dieselbe Stelle kopieren und die Tests laufen lassen.
