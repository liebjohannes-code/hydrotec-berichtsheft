// Browser-Test der Oberfläche – ausführen mit:  node --test tests/browser.test.js
// Benötigt Playwright mit Chromium; ist es nicht installiert, wird der Test übersprungen.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let playwright = null;
try { playwright = require('playwright'); } catch (e) { /* nicht installiert */ }

const PUBLIC = path.join(__dirname, '..', 'public');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg' };

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

test('Berichtsheft-Generator im Browser', { skip: !playwright && 'Playwright nicht installiert' }, async (t) => {
  const server = await starteServer();
  const browser = await playwright.chromium.launch();
  t.after(async () => { await browser.close(); server.close(); });

  const ctx = await browser.newContext({ acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  // Feste „Heute“-Zeit: Freitag, 30.10.2026 → KW 44
  await ctx.addInitScript(() => {
    const Echt = Date;
    const jetzt = new Echt(2026, 9, 30, 10, 0, 0).getTime();
    // eslint-disable-next-line no-global-assign
    Date = class extends Echt {
      constructor(...a) { if (a.length) super(...a); else super(jetzt); }
      static now() { return jetzt; }
    };
  });
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', (e) => fehler.push(e.message));
  await p.goto('http://127.0.0.1:' + server.address().port + '/');

  const titel = () => p.textContent('#kwTitel');
  const warteAufTitel = (t) => p.waitForFunction((t) => document.querySelector('#kwTitel').textContent === t, t, { timeout: 5000 });
  const typen = () => p.$$eval('.segmente label.aktiv', (a) => a.map((x) => x.textContent));
  const texte = () => p.$$eval('.tag textarea', (a) => a.map((x) => x.value));

  await t.test('lädt aktuelle KW', async () => {
    assert.equal(await titel(), 'KW 44 / 2026');
    assert.equal(await p.textContent('#kwZeitraum'), '26.10.2026 – 30.10.2026');
  });

  await t.test('Pflichtfelder werden markiert', async () => {
    await p.click('#pdfExport');
    const markiert = await p.$$eval('.ungueltig', (a) => a.map((x) => x.id));
    assert.deepEqual(markiert, ['name', 'abteilung', 'jahr', 'text-0', 'text-1', 'text-2', 'text-3', 'text-4']);
  });

  await t.test('Export mit Dateiname und Mailtext', async () => {
    await p.selectOption('#name', 'Berdan Öner');
    await p.selectOption('#abteilung', 'Vertrieb GaLaBau');
    await p.selectOption('#jahr', '2');
    for (let i = 0; i < 4; i++) await p.fill('#text-' + i, 'Tätigkeit ' + i);
    await p.click('.tag:nth-child(3) .segmente label:nth-child(2)'); // Mi: Berufsschule
    await p.click('.tag:nth-child(5) .segmente label:nth-child(3)'); // Fr: Urlaub
    await p.fill('#std-1', '7.5');
    assert.equal(await p.textContent('#wochensumme'), '29,5 Std.');

    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#pdfExport')]);
    assert.equal(dl.suggestedFilename(), 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau.pdf');
    assert.equal(await p.inputValue('#mailBetreff'), 'Berichtsheft – Berdan Öner – KW 44/2026 – Vertrieb GaLaBau');
    assert.match(await p.inputValue('#mailText'), /KW 44\/2026 \(26\.10\.–30\.10\.2026\) aus der Abteilung Vertrieb GaLaBau/);
  });

  await t.test('Wochenwechsel: Abbrechen behält Einträge', async () => {
    await p.click('#kwVor');
    assert.ok(await p.isVisible('#wocheDialog'));
    assert.equal(await p.textContent('#wocheDialogText'), 'Einträge dieser Woche verwerfen und neue Woche starten?');
    await p.click('#wocheAbbrechen');
    assert.ok(!(await p.isVisible('#wocheDialog')));
    assert.equal(await titel(), 'KW 44 / 2026');
    assert.deepEqual(await texte(), ['Tätigkeit 0', 'Tätigkeit 1', 'Tätigkeit 2', 'Tätigkeit 3', '']);
    assert.deepEqual(await typen(), ['Betrieb', 'Betrieb', 'Berufsschule', 'Betrieb', 'Urlaub']);
  });

  await t.test('Wochenwechsel: Ja leert Tage, Kopfdaten bleiben', async () => {
    await p.click('#kwVor');
    await p.click('#wocheJa');
    await warteAufTitel('KW 45 / 2026');
    assert.deepEqual(await texte(), ['', '', '', '', '']);
    assert.deepEqual(await typen(), ['Betrieb', 'Betrieb', 'Betrieb', 'Betrieb', 'Betrieb']);
    assert.equal(await p.textContent('#wochensumme'), '40 Std.');
    assert.equal(await p.inputValue('#name'), 'Berdan Öner');
    assert.equal(await p.inputValue('#abteilung'), 'Vertrieb GaLaBau');
    assert.equal(await p.inputValue('#jahr'), '2');
    assert.ok(!(await p.isVisible('#mailBox')));
  });

  await t.test('ohne Text kein Dialog; Feiertage werden gesetzt', async () => {
    for (let i = 0; i < 8; i++) {
      await p.click('#kwVor');
      assert.ok(!(await p.isVisible('#wocheDialog')));
    }
    assert.equal(await titel(), 'KW 53 / 2026');
    assert.equal(await p.textContent('#kwZeitraum'), '28.12.2026 – 01.01.2027');
    assert.deepEqual(await typen(), ['Betrieb', 'Betrieb', 'Betrieb', 'Betrieb', 'Feiertag']);
    assert.deepEqual(await p.$$eval('.feiertag-badge:not([hidden])', (a) => a.map((x) => x.textContent)), ['Feiertag: Neujahr']);
  });

  await t.test('„Zur aktuellen Woche“ fragt bei Text ebenfalls nach', async () => {
    await p.fill('#text-0', 'Inventur');
    await p.click('#kwHeute');
    assert.ok(await p.isVisible('#wocheDialog'));
    await p.click('#wocheJa');
    await warteAufTitel('KW 44 / 2026');
    assert.deepEqual(await texte(), ['', '', '', '', '']);
  });

  assert.deepEqual(fehler, []);
});
