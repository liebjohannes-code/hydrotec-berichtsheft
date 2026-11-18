// Browser-Tests der Oberfläche – ausführen mit:  node --test tests/browser.test.js
// Benötigt Playwright mit Chromium; ist es nicht installiert, wird der Test übersprungen.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* nicht installiert */ }

const { jsPDF } = require('../public/vendor/jspdf.umd.min.js');
const { autoTable } = require('../public/vendor/jspdf.plugin.autotable.min.js');
const PDFLib = require('../public/vendor/pdf-lib.min.js');
const K = require('../public/kalender.js');
const B = require('../public/bericht.js');
const P = require('../public/pdf.js');

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'berichtsheft-test-'));

function starteServer() {
  const server = http.createServer((req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const datei = path.join(PUBLIC, pfad === '/' ? 'index.html' : pfad);
    if (!datei.startsWith(PUBLIC) || !fs.existsSync(datei)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    fs.createReadStream(datei).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Feste „Heute“-Zeit: Freitag, 30.10.2026 → KW 44
function festesDatum() {
  const Echt = Date;
  const jetzt = new Echt(2026, 9, 30, 10, 0, 0).getTime();
  // eslint-disable-next-line no-global-assign
  Date = class extends Echt {
    constructor(...a) { if (a.length) super(...a); else super(jetzt); }
    static now() { return jetzt; }
  };
}

async function seitenInhalte(bytes) {
  const pdf = await PDFLib.PDFDocument.load(bytes);
  return pdf.getPages().map((p) => {
    const c = p.node.Contents();
    const stream = c instanceof PDFLib.PDFArray ? c.lookup(0) : c;
    return Buffer.from(PDFLib.decodePDFRawStream(stream).decode()).toString('latin1');
  });
}

// Erzeugt ein Generator-PDF direkt mit den Modulen (für den Sammel-Test).
async function generatorPdf(kw, status, name) {
  const z = B.neuerZustand(K.montagVonKW(kw, 2026));
  Object.assign(z.kopf, { name: name || 'Alicia Brandt', abteilung: 'Einkauf', jahr: '2', beginn: '2026-10-19' });
  B.aktualisiereNachweisNr(z);
  z.tage.forEach((t, i) => Object.assign(t, { art: 'Betrieb', zeit: '8:00', text: 'KW ' + kw + ' Tag ' + (i + 1) }));
  B.wendeAutomatikAn(z);
  const doc = P.erzeugeBerichtPdf(z, { jsPDF, autoTable, entwurf: status === 'entwurf' });
  const payload = B.serialisiere(z, status, new Date(Date.UTC(2026, 10, kw - 40)));
  const datei = path.join(TMP, B.dateiname(z, status === 'entwurf'));
  fs.writeFileSync(datei, await P.bettenEin(doc.output('arraybuffer'), payload, PDFLib));
  return datei;
}

test('Berichtsheft-Generator im Browser', { skip: !playwright && 'Playwright nicht installiert' }, async (t) => {
  const server = await starteServer();
  const browser = await playwright.chromium.launch();
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  t.after(async () => { await browser.close(); server.close(); fs.rmSync(TMP, { recursive: true, force: true }); });

  async function neueSeite(viewport) {
    const ctx = await browser.newContext({ acceptDownloads: true, timezoneId: 'Europe/Berlin', viewport: viewport || { width: 1200, height: 900 } });
    await ctx.addInitScript(festesDatum);
    const p = await ctx.newPage();
    p.fehler = [];
    p.on('pageerror', (e) => p.fehler.push(e.message));
    await p.goto(url);
    return p;
  }

  const titel = (p) => p.textContent('#kwTitel');
  const warteAufTitel = (p, w) => p.waitForFunction((w) => document.querySelector('#kwTitel').textContent === w, w, { timeout: 5000 });
  const tagArt = (p, i, art) => p.locator('#tag-' + i + '-art label', { hasText: art }).click();
  const wocheArt = (p, i, art) => p.locator('#woche-' + i + '-art label', { hasText: art }).click();
  async function zeit(p, prefix, i, std, min) {
    await p.fill('#' + prefix + '-' + i + '-zeit .zeit-std', std);
    await p.fill('#' + prefix + '-' + i + '-zeit .zeit-min', min);
  }
  async function kopf(p) {
    await p.selectOption('#name', 'Berdan Öner');
    await p.selectOption('#abteilung', 'Vertrieb GaLaBau');
    await p.selectOption('#jahr', '2');
    await p.fill('#beginn', '2025-08-01');
    await p.dispatchEvent('#beginn', 'change');
  }
  async function speichere(p, knopf) {
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click(knopf)]);
    const datei = path.join(TMP, dl.suggestedFilename());
    await dl.saveAs(datei);
    return { name: dl.suggestedFilename(), datei, payload: await P.leseEingebettet(fs.readFileSync(datei), PDFLib) };
  }
  async function modusWoche(p) {
    await p.click('.modus label:has-text("Wochenbericht")');
    await p.waitForSelector('#wochenleiste', { state: 'visible' });
  }

  await t.test('Tagesbericht: Prüfung, Std:Min, Export, Mail und Outlook-Link', async () => {
    const p = await neueSeite();
    assert.equal(await titel(p), 'KW 44 / 2026');
    await p.click('#exportFertig');
    const markiert = await p.$$eval('.ungueltig', (a) => a.map((x) => x.id));
    assert.deepEqual(markiert, ['name', 'abteilung', 'jahr', 'nachweisNr', 'tag-0-art', 'tag-1-art', 'tag-2-art', 'tag-3-art', 'tag-4-art']);
    assert.ok(await p.isVisible('#fehlermeldung'));

    await kopf(p);
    assert.equal(await p.inputValue('#nachweisNr'), '66');
    for (let i = 0; i < 5; i++) {
      await tagArt(p, i, i === 2 ? 'Berufsschule' : 'Betrieb');
      await p.fill('#tag-' + i + '-text', 'Tätigkeit ' + i);
      await zeit(p, 'tag', i, '8', i === 1 ? '45' : '00');
    }
    await zeit(p, 'tag', 3, '8', '75');
    assert.equal(await p.textContent('#tag-3-zeit + .zeit-fehler'), 'Minuten müssen zwischen 0 und 59 liegen.');
    await p.click('#exportFertig');
    assert.deepEqual(await p.$$eval('.ungueltig', (a) => a.map((x) => x.id)), ['tag-3-zeit']);
    await zeit(p, 'tag', 3, '7', '30');
    await tagArt(p, 4, 'Urlaub');
    assert.equal(await p.textContent('#summen .summe-wert'), '32:15 Std.'); // 8:00 + 8:45 + 8:00 + 7:30

    const ex = await speichere(p, '#exportFertig');
    assert.equal(ex.name, 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau.pdf');
    assert.equal(ex.payload.status, 'fertig');
    assert.equal(ex.payload.daten.tage[1].zeit, '8:45');

    const betreff = 'Berichtsheft – Berdan Öner – KW 44/2026 – Vertrieb GaLaBau';
    assert.equal(await p.inputValue('#mailBetreff'), betreff);
    const text = await p.inputValue('#mailText');
    assert.match(text, /Ausbildungsnachweis Nr\. 66 \(Tagesbericht\) für die KW 44\/2026 \(26\.10\.–30\.10\.2026\)/);
    assert.equal(await p.getAttribute('#outlookLink', 'href'), B.mailtoLink(betreff, text));
    assert.ok((await p.getAttribute('#outlookLink', 'href')).startsWith('mailto:?subject=Berichtsheft%20%E2%80%93%20Berdan%20%C3%96ner'));
    assert.match(await p.textContent('.outlook-hinweis'), /Bitte das heruntergeladene PDF anhängen/);

    // Wochenwechsel: Abbrechen behält, Ja leert Tage – Kopf, Modus und Abwesenheiten bleiben, Nr. steigt
    await p.click('#kwVor');
    assert.equal(await p.textContent('#dialogText'), 'Einträge dieser Woche verwerfen und neue Woche starten?');
    await p.click('#dialogAbbrechen');
    assert.equal(await titel(p), 'KW 44 / 2026');
    assert.equal(await p.inputValue('#tag-0-text'), 'Tätigkeit 0');
    await p.click('#kwVor');
    await p.click('#dialogJa');
    await warteAufTitel(p, 'KW 45 / 2026');
    assert.equal(await p.inputValue('#tag-0-text'), '');
    assert.equal(await p.inputValue('#nachweisNr'), '67');
    assert.equal(await p.inputValue('#name'), 'Berdan Öner');
    assert.deepEqual(p.fehler, []);
  });

  await t.test('Wochenbericht komplett ausfüllen und fertig exportieren', async () => {
    const p = await neueSeite();
    await kopf(p);
    await p.click('#kwVor');
    await warteAufTitel(p, 'KW 45 / 2026');
    await modusWoche(p);
    // Krank Do–Fr (geht in die nächste Woche weiter)
    await p.click('#abwNeu');
    await p.selectOption('#abw-0 select', 'Krank');
    await p.fill('#abw-0 input[aria-label="Von"]', '2026-11-05');
    await p.dispatchEvent('#abw-0 input[aria-label="Von"]', 'change');
    await p.fill('#abw-0 input[aria-label="Bis"]', '2026-11-10');
    await p.dispatchEvent('#abw-0 input[aria-label="Bis"]', 'change');
    assert.equal(await p.textContent('#zusammenfassung'), 'Diese Woche: Krank: 05.11.–06.11.2026 (2 Tage)');
    assert.equal(await p.isVisible('#woche-3-art .wl-wahl'), false);

    await p.click('#exportFertig');
    assert.deepEqual(await p.$$eval('.ungueltig', (a) => a.map((x) => x.id)), ['woche-0-art', 'woche-1-art', 'woche-2-art']);
    await wocheArt(p, 0, 'Betrieb');
    await zeit(p, 'woche', 0, '8', '45');
    await wocheArt(p, 1, 'Berufsschule');
    await zeit(p, 'woche', 1, '6', '00');
    await wocheArt(p, 2, 'Betrieb');
    await zeit(p, 'woche', 2, '8', '15');
    assert.equal(await p.textContent('#zeitBetrieb'), '17:00 Std.');
    assert.equal(await p.textContent('#zeitSchule'), '6:00 Std.');
    await p.click('#exportFertig');
    assert.deepEqual(await p.$$eval('.ungueltig', (a) => a.map((x) => x.id)), ['textBetrieb', 'textSchule']);
    await p.fill('#textBetrieb', 'Angebote erstellt\nKundentermine vorbereitet\nLager geprüft');
    await p.fill('#textSchule', 'Wirtschaft: Kaufvertrag');
    const h1 = await p.$eval('#textBetrieb', (e) => e.offsetHeight);
    await p.fill('#textBetrieb', 'Angebote erstellt\n'.repeat(15));
    assert.ok(await p.$eval('#textBetrieb', (e) => e.offsetHeight) > h1, 'Textfeld wächst mit');
    assert.equal(await p.textContent('#summen .summe-wert'), '23:00 Std.');

    const ex = await speichere(p, '#exportFertig');
    assert.equal(ex.name, 'Berichtsheft_Oener_KW45_2026_Vertrieb-GaLaBau.pdf');
    assert.equal(ex.payload.daten.modus, 'woche');
    assert.deepEqual(ex.payload.daten.tage.map((x) => x.art), ['Betrieb', 'Berufsschule', 'Betrieb', 'Krank', 'Krank']);
    assert.equal(ex.payload.daten.kopf.nachweisNr, '67');
    assert.match(await p.inputValue('#mailText'), /Nr\. 67 \(Wochenbericht\)/);

    // Nächste Woche: Abwesenheit bleibt und zeigt ihren Anteil
    await p.click('#kwVor');
    await p.click('#dialogJa');
    await warteAufTitel(p, 'KW 46 / 2026');
    assert.equal(await p.textContent('#zusammenfassung'), 'Diese Woche: Krank: 09.11.–10.11.2026 (2 Tage)');
    assert.equal(await p.inputValue('#textBetrieb'), '');
    assert.ok(await p.isChecked('input[name="modus"][value="woche"]'));
    assert.deepEqual(p.fehler, []);
  });

  await t.test('Moduswechsel mit Text fragt nach', async () => {
    const p = await neueSeite();
    await tagArt(p, 0, 'Betrieb');
    await p.fill('#tag-0-text', 'Inventur');
    await p.click('.modus label:has-text("Wochenbericht")');
    assert.equal(await p.textContent('#dialogText'), 'Einträge verwerfen und zu Wochenbericht wechseln?');
    await p.click('#dialogAbbrechen');
    await p.waitForFunction(() => document.querySelector('input[name="modus"][value="tag"]').checked);
    assert.equal(await p.inputValue('#tag-0-text'), 'Inventur');
    await p.click('.modus label:has-text("Wochenbericht")');
    await p.click('#dialogJa');
    await p.waitForSelector('#wochenleiste', { state: 'visible' });
    await p.click('.modus label:has-text("Tagesbericht")'); // ohne Text: kein Dialog
    assert.equal(await p.isVisible('#dialog'), false);
    assert.equal(await p.inputValue('#tag-0-text'), '');
  });

  await t.test('Ferienwoche blendet die Berufsschule aus', async () => {
    const p = await neueSeite();
    await modusWoche(p);
    for (let i = 0; i < 2; i++) await p.click('#kwZurueck');
    await warteAufTitel(p, 'KW 42 / 2026');
    assert.equal(await p.textContent('#zusammenfassung'), 'Diese Woche: Ferien: 12.10.–16.10.2026');
    assert.equal(await p.isVisible('#blockSchule'), false);
    assert.equal(await p.isDisabled('#woche-0-art input[value="Berufsschule"]'), true);
    assert.equal(await p.isDisabled('#woche-0-art input[value="Betrieb"]'), false);
    await p.click('#kwVor');
    await warteAufTitel(p, 'KW 43 / 2026'); // Herbstferien gehen bis 24.10.
    assert.equal(await p.isVisible('#blockSchule'), false);
    await p.click('#kwVor');
    await warteAufTitel(p, 'KW 44 / 2026');
    assert.equal(await p.isVisible('#blockSchule'), true);
    assert.equal(await p.isDisabled('#woche-0-art input[value="Berufsschule"]'), false);
  });

  await t.test('Entwurf exportieren → hochladen → weiterschreiben → fertig exportieren', async () => {
    const p = await neueSeite();
    await kopf(p);
    await modusWoche(p);
    await wocheArt(p, 0, 'Betrieb');
    await zeit(p, 'woche', 0, '8', '00');
    await p.fill('#textUnterweisung', 'Brandschutzunterweisung');
    const entwurf = await speichere(p, '#exportEntwurf');
    assert.equal(entwurf.name, 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau_Entwurf.pdf');
    assert.equal(entwurf.payload.status, 'entwurf');
    assert.equal(await p.isVisible('#mailBox'), false);
    assert.ok((await seitenInhalte(fs.readFileSync(entwurf.datei))).join('').includes('(ENTWURF)'));

    // Neue Sitzung: andere Woche, etwas Text → Hochladen fragt nach und springt zur KW aus dem PDF
    const q = await neueSeite();
    await q.click('#kwVor');
    await tagArt(q, 0, 'Betrieb');
    await q.fill('#tag-0-text', 'wird ersetzt');
    await q.setInputFiles('#uploadDatei', entwurf.datei);
    await q.waitForSelector('#dialog[open]');
    assert.equal(await q.textContent('#dialogText'), 'Aktuelle Einträge durch das hochgeladene PDF ersetzen?');
    await q.click('#dialogJa');
    await warteAufTitel(q, 'KW 44 / 2026');
    assert.match(await q.textContent('#uploadMeldung'), /geladen: KW 44\/2026, Wochenbericht \(Entwurf\)/);
    assert.ok(await q.isChecked('input[name="modus"][value="woche"]'));
    assert.equal(await q.inputValue('#name'), 'Berdan Öner');
    assert.equal(await q.inputValue('#beginn'), '2025-08-01');
    assert.equal(await q.inputValue('#textUnterweisung'), 'Brandschutzunterweisung');
    assert.equal(await q.inputValue('#woche-0-zeit .zeit-std'), '8');
    assert.ok(await q.isChecked('#woche-0-art input[value="Betrieb"]'));

    // weiterschreiben und fertig exportieren
    for (let i = 1; i < 5; i++) {
      await wocheArt(q, i, 'Betrieb');
      await zeit(q, 'woche', i, '8', '00');
    }
    await q.fill('#textBetrieb', 'Ausschreibungen geprüft');
    const fertig = await speichere(q, '#exportFertig');
    assert.equal(fertig.name, 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau.pdf');
    assert.equal(fertig.payload.status, 'fertig');
    assert.equal(fertig.payload.daten.texte.unterweisung, 'Brandschutzunterweisung');
    assert.ok(await q.isVisible('#mailBox'));

    // Fremde Datei
    const fremd = path.join(TMP, 'fremd.pdf');
    const doc = new jsPDF();
    doc.text('Irgendein PDF', 10, 10);
    fs.writeFileSync(fremd, Buffer.from(doc.output('arraybuffer')));
    await q.setInputFiles('#uploadDatei', fremd);
    await q.waitForSelector('#uploadMeldung.meldung-fehler');
    assert.equal(await q.textContent('#uploadMeldung'), 'Diese Datei wurde nicht mit dem Berichtsheft-Generator erstellt.');
    assert.equal(await titel(q), 'KW 44 / 2026');
    assert.deepEqual(q.fehler, []);
  });

  await t.test('Sammel-PDF aus 3 Wochen mit Lücke', async () => {
    const dateien = [
      await generatorPdf(47, 'fertig'),
      await generatorPdf(44, 'fertig'),
      await generatorPdf(46, 'entwurf'),
      await generatorPdf(45, 'fertig')
    ];
    const ersatz47 = await generatorPdf(47, 'fertig');
    const fremd = path.join(TMP, 'fremd2.pdf');
    fs.writeFileSync(fremd, 'kein PDF');

    const p = await neueSeite();
    await p.click('#tabGesamt');
    await p.setInputFiles('#sammelDatei', [dateien[0], dateien[1], dateien[2], fremd]);
    await p.waitForSelector('#sammelTabelle tbody tr:nth-child(4)');
    assert.deepEqual(await p.$$eval('#sammelTabelle tbody td.kw', (a) => a.map((x) => x.textContent)), ['KW 44/2026', 'KW 46/2026', 'KW 47/2026', '—']);
    assert.deepEqual(await p.$$eval('#sammelTabelle tbody input[type=checkbox]', (a) => a.map((x) => [x.checked, x.disabled])),
      [[true, false], [false, false], [true, false], [false, true]]);
    assert.ok(await p.isVisible('.zeile-fremd'));
    // Entwurf KW 46 ausgeschlossen, Beginn 19.10. (KW 43) → KW 43, 45, 46 fehlen
    assert.equal(await p.textContent('.pruef-fehlend'), 'Fehlend: KW 43/2026, KW 45–46/2026');

    // Entwurf einschließen und KW 45 nachreichen → nur KW 43 fehlt
    await p.locator('#sammelTabelle tbody tr', { hasText: 'Entwurf' }).locator('input[type=checkbox]').check();
    await p.setInputFiles('#sammelDatei', dateien[3]);
    await p.waitForFunction(() => document.querySelector('.pruef-fehlend') && document.querySelector('.pruef-fehlend').textContent === 'Fehlend: KW 43/2026');
    // Entwurf wieder raus → Lücke KW 46 (3 Wochen mit einer Lücke im Zeitraum)
    await p.locator('#sammelTabelle tbody tr', { hasText: 'Entwurf' }).locator('input[type=checkbox]').uncheck();
    assert.equal(await p.textContent('.pruef-fehlend'), 'Fehlend: KW 43/2026, KW 46/2026');

    // doppelte Woche: Standard ist die zuletzt exportierte
    await p.setInputFiles('#sammelDatei', ersatz47);
    await p.waitForSelector('.duplikat');
    assert.match(await p.textContent('.duplikat legend'), /KW 47\/2026 ist mehrfach vorhanden/);
    assert.equal(await p.$$eval('.duplikat input:checked', (a) => a.length), 1);

    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#gesamtErstellen')]);
    assert.equal(dl.suggestedFilename(), 'Berichtsheft_Gesamt_Brandt_KW44-2026_bis_KW47-2026.pdf');
    const gesamtDatei = path.join(TMP, dl.suggestedFilename());
    await dl.saveAs(gesamtDatei);
    const seiten = await seitenInhalte(fs.readFileSync(gesamtDatei));
    const erwartet = [];
    for (const d of [dateien[1], dateien[3], dateien[0]]) erwartet.push(...(await seitenInhalte(fs.readFileSync(d))));
    assert.deepEqual(seiten.slice(seiten.length - erwartet.length), erwartet, 'Originalseiten in KW-Reihenfolge');
    assert.ok(seiten[0].includes('KW 43/2026, KW 46/2026'), 'Deckblatt nennt die fehlenden Wochen');
    assert.deepEqual(p.fehler, []);
  });

  await t.test('Handy-Ansicht 375 px ohne seitliches Scrollen', async () => {
    const p = await neueSeite({ width: 375, height: 800 });
    const breite = () => p.evaluate(() => document.documentElement.scrollWidth);
    await p.click('#abwNeu');
    assert.equal(await breite(), 375);
    await modusWoche(p);
    assert.equal(await breite(), 375);
    await p.click('#tabGesamt');
    await p.setInputFiles('#sammelDatei', await generatorPdf(44, 'fertig', 'Hijra Rasheed'));
    await p.waitForSelector('#sammelTabelle tbody tr');
    assert.equal(await breite(), 375);
  });
});
