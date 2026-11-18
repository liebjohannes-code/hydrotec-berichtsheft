// Tests für public/pdf.js: echte PDFs erzeugen, Formulardaten einbetten und wieder auslesen,
// Gesamt-PDF zusammenführen.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { jsPDF } = require('../public/vendor/jspdf.umd.min.js');
const { autoTable } = require('../public/vendor/jspdf.plugin.autotable.min.js');
const PDFLib = require('../public/vendor/pdf-lib.min.js');
const K = require('../public/kalender.js');
const B = require('../public/bericht.js');
const P = require('../public/pdf.js');

const LIBS = { jsPDF, autoTable };

function tagesbericht(kw) {
  const z = B.neuerZustand(K.montagVonKW(kw, 2026));
  Object.assign(z.kopf, { name: 'Jürgen Şahin', abteilung: 'Einkauf', jahr: '1', beginn: '2026-08-03', nachweisNr: '' });
  B.aktualisiereNachweisNr(z);
  z.tage.forEach((t, i) => Object.assign(t, { art: 'Betrieb', zeit: '8:00', text: 'Bestellungen bearbeitet, Tag ' + (i + 1) }));
  return B.wendeAutomatikAn(z);
}

function wochenbericht() {
  const z = B.neuerZustand(K.montagVonKW(45, 2026));
  z.modus = 'woche';
  Object.assign(z.kopf, { name: 'Nicole Wala', abteilung: 'Zentrale', jahr: '3', beginn: '', nachweisNr: '61', nachweisNrManuell: true });
  z.abwesenheiten = [{ art: 'Krank', von: '2026-11-05', bis: '2026-11-06' }];
  B.wendeAutomatikAn(z);
  Object.assign(z.tage[0], { art: 'Betrieb', zeit: '8:45' });
  Object.assign(z.tage[1], { art: 'Berufsschule', zeit: '6:00' });
  Object.assign(z.tage[2], { art: 'Betrieb', zeit: '8:15' });
  z.texte = { betrieb: 'Post verteilt\nTelefonzentrale', unterweisung: '', schule: 'Deutsch: Geschäftsbriefe' };
  return z;
}

async function exportiere(z, status) {
  const doc = P.erzeugeBerichtPdf(z, Object.assign({ entwurf: status === 'entwurf' }, LIBS));
  const payload = B.serialisiere(z, status);
  return { bytes: await P.bettenEin(doc.output('arraybuffer'), payload, PDFLib), payload };
}

async function seitenInhalte(bytes) {
  const pdf = await PDFLib.PDFDocument.load(bytes);
  return pdf.getPages().map((p) => {
    const c = p.node.Contents();
    const stream = c instanceof PDFLib.PDFArray ? c.lookup(0) : c;
    return Buffer.from(PDFLib.decodePDFRawStream(stream).decode()).toString('latin1');
  });
}

for (const [art, erzeugen] of [['Tagesbericht', () => tagesbericht(44)], ['Wochenbericht', wochenbericht]]) {
  for (const status of ['fertig', 'entwurf']) {
    test(`JSON-Roundtrip über das PDF: ${art}, ${status}`, async () => {
      const z = erzeugen();
      const { bytes, payload } = await exportiere(z, status);
      const gelesen = await P.leseEingebettet(bytes, PDFLib);
      assert.deepEqual(gelesen, payload);
      const { zustand, status: s } = B.deserialisiere(gelesen);
      assert.equal(s, status);
      assert.deepEqual(B.serialisiere(zustand, status, new Date(payload.exportiertAm)), payload);

      const inhalt = (await seitenInhalte(bytes)).join('\n');
      assert.equal(inhalt.includes('(ENTWURF)'), status === 'entwurf');
    });
  }
}

test('Rückfallebene: Daten aus dem Info-Verzeichnis, wenn der Anhang fehlt', async () => {
  const { bytes, payload } = await exportiere(wochenbericht(), 'fertig');
  const pdf = await PDFLib.PDFDocument.load(bytes);
  pdf.catalog.delete(PDFLib.PDFName.of('Names'));
  const ohneAnhang = await pdf.save();
  assert.deepEqual(await P.leseEingebettet(ohneAnhang, PDFLib), payload);
});

test('Fremde Dateien liefern null', async () => {
  const fremd = new jsPDF();
  fremd.text('Hallo', 10, 10);
  assert.equal(await P.leseEingebettet(fremd.output('arraybuffer'), PDFLib), null);
  assert.equal(await P.leseEingebettet(new TextEncoder().encode('kein PDF'), PDFLib), null);
});

test('Nicht darstellbare Zeichen werden für die PDF-Schrift angenähert', () => {
  assert.equal(P.pdfText('Jürgen Şahin – ığ ✓ €'), 'Jürgen Sahin – ig x €');
  assert.equal(P.pdfText('Emoji 😀 weg'), 'Emoji  weg');
});

test('Gesamt-PDF: Deckblatt + Originalseiten in KW-Reihenfolge, unverändert', async () => {
  const dateien = {};
  const eintraege = [];
  for (const kw of [47, 44, 46]) {
    const z = tagesbericht(kw);
    if (kw === 46) z.tage[0].text = 'Sehr langer Bericht. '.repeat(400); // erzwingt mehrere Seiten
    const { bytes, payload } = await exportiere(z, 'fertig');
    const id = 'kw' + kw;
    dateien[id] = bytes;
    const gelesen = B.deserialisiere(await P.leseEingebettet(bytes, PDFLib));
    eintraege.push({ id, ok: true, status: gelesen.status, exportiertAm: payload.exportiertAm, zustand: gelesen.zustand, einschliessen: true });
  }
  const analyse = B.analysiereSammlung(eintraege);
  assert.equal(analyse.fehlendText, 'KW 32–43/2026, KW 45/2026');

  const gesamt = await P.erzeugeGesamtPdf(analyse, Object.assign({ PDFLib, bytesVon: (id) => dateien[id] }, LIBS));
  const seiten = await seitenInhalte(gesamt);
  const erwartet = [];
  for (const id of ['kw44', 'kw46', 'kw47']) erwartet.push(...(await seitenInhalte(dateien[id])));
  const deckblatt = seiten.length - erwartet.length;
  assert.ok(deckblatt >= 1);
  assert.ok(erwartet.length >= 4);
  assert.deepEqual(seiten.slice(deckblatt), erwartet);
  assert.ok(seiten[0].includes('(Ausbildungsnachweise)'));
  assert.ok(seiten[0].includes('KW 32-43/2026, KW 45/2026') || seiten[0].includes('KW 32\x9643/2026, KW 45/2026'));
});
