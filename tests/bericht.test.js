// Tests für die Fachlogik (public/bericht.js)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../public/kalender.js');
const B = require('../public/bericht.js');

function zustand(tag, monat, jahr, felder) {
  const z = B.neuerZustand(K.datum(jahr, monat, tag));
  Object.assign(z, felder || {});
  return B.wendeAutomatikAn(z);
}

function woche(z) {
  return B.kwInfo(z.montag).titel;
}

test('Nachweis-Nr.: Startwoche = 1', () => {
  // 01.08.2026 ist ein Samstag → Woche ab 27.07.2026 (KW 31) ist Nr. 1
  assert.equal(B.nachweisNrAuto('2026-08-01', K.montagVonKW(31, 2026)), 1);
  assert.equal(B.nachweisNrAuto('2026-08-01', K.montagVonKW(32, 2026)), 2);
  assert.equal(B.nachweisNrAuto('2026-08-01', K.montagVonKW(44, 2026)), 14);
  assert.equal(B.nachweisNrAuto('2026-08-01', K.montagVonKW(30, 2026)), '');
  assert.equal(B.nachweisNrAuto('', K.montagVonKW(30, 2026)), '');
});

test('Nachweis-Nr. über den Jahreswechsel und KW 53', () => {
  // Beginn Mo 03.08.2026 (KW 32)
  assert.equal(B.nachweisNrAuto('2026-08-03', K.montagVonKW(52, 2026)), 21);
  assert.equal(B.nachweisNrAuto('2026-08-03', K.montagVonKW(53, 2026)), 22);
  assert.equal(B.nachweisNrAuto('2026-08-03', K.montagVonKW(1, 2027)), 23);
  assert.equal(B.nachweisNrAuto('2026-08-03', K.montagVonKW(31, 2029)), 157); // 22 + 52 + 52 + 31 (2026 hat KW 53)
  // Beginn an einem Freitag im alten Jahr, der zu KW 53 gehört
  assert.equal(B.nachweisNrAuto('2027-01-01', K.montagVonKW(53, 2026)), 1);
  assert.equal(B.nachweisNrAuto('2027-01-01', K.montagVonKW(1, 2027)), 2);
});

test('Nachweis-Nr. beim Wochenwechsel: automatisch, manuell, ohne Beginn', () => {
  const z = zustand(26, 10, 2026);
  z.kopf.beginn = '2026-08-03';
  B.aktualisiereNachweisNr(z);
  assert.equal(z.kopf.nachweisNr, '13');
  z.kopf.nachweisNr = '99';
  z.kopf.nachweisNrManuell = true;
  B.aktualisiereNachweisNr(z);
  assert.equal(z.kopf.nachweisNr, '99');
  B.wechsleWoche(z, K.addTage(z.montag, 7));
  assert.equal(z.kopf.nachweisNr, '14');
  assert.equal(z.kopf.nachweisNrManuell, false);

  const ohne = zustand(26, 10, 2026);
  ohne.kopf.nachweisNr = '5';
  B.wechsleWoche(ohne, K.addTage(ohne.montag, 14));
  assert.equal(ohne.kopf.nachweisNr, '7');
  B.wechsleWoche(ohne, K.addTage(ohne.montag, -70));
  assert.equal(ohne.kopf.nachweisNr, '');
});

test('Feiertage werden automatisch gesetzt (Vorrang vor Ferien und Abwesenheit)', () => {
  const z = zustand(28, 12, 2026, {
    abwesenheiten: [{ art: 'Urlaub', von: '2026-12-21', bis: '2027-01-08' }]
  });
  assert.equal(woche(z), 'KW 53 / 2026');
  assert.deepEqual(z.tage.map((t) => t.art), ['Urlaub', 'Urlaub', 'Urlaub', 'Urlaub', 'Feiertag']);
  assert.equal(B.zusammenfassung(z), 'Urlaub: 28.12.–31.12.2026 (4 Tage) · Feiertag: 01.01. Neujahr');
});

test('Abwesenheit über mehrere Wochen: jede Woche zeigt ihren Anteil', () => {
  const abw = [{ art: 'Krank', von: '2026-11-04', bis: '2026-11-12' }];
  const kw45 = zustand(2, 11, 2026, { abwesenheiten: abw });
  assert.deepEqual(kw45.tage.map((t) => t.art), ['', '', 'Krank', 'Krank', 'Krank']);
  assert.equal(B.zusammenfassung(kw45), 'Krank: 04.11.–06.11.2026 (3 Tage)');

  B.wechsleWoche(kw45, K.addTage(kw45.montag, 7));
  assert.equal(woche(kw45), 'KW 46 / 2026');
  assert.deepEqual(kw45.tage.map((t) => t.art), ['Krank', 'Krank', 'Krank', 'Krank', '']);
  assert.equal(B.zusammenfassung(kw45), 'Krank: 09.11.–12.11.2026 (4 Tage)');

  B.wechsleWoche(kw45, K.addTage(kw45.montag, 7));
  assert.deepEqual(kw45.tage.map((t) => t.art), ['', '', '', '', '']);
  assert.equal(B.zusammenfassung(kw45), '');
});

test('Krank hat Vorrang vor Urlaub, einzelne Tage mit Anzahl', () => {
  const z = zustand(2, 11, 2026, {
    abwesenheiten: [
      { art: 'Urlaub', von: '2026-11-02', bis: '2026-11-03' },
      { art: 'Krank', von: '2026-11-03', bis: '2026-11-03' },
      { art: 'Urlaub', von: '2026-11-06', bis: '2026-11-06' }
    ]
  });
  assert.deepEqual(z.tage.map((t) => t.art), ['Urlaub', 'Krank', '', '', 'Urlaub']);
  assert.equal(B.zusammenfassung(z), 'Urlaub: 02.11.2026 (1 Tag), 06.11.2026 (1 Tag) · Krank: 03.11.2026 (1 Tag)');
});

test('Ferien: Schule gesperrt, Betrieb erlaubt; Ferienwoche ohne Schultag', () => {
  const herbst = zustand(12, 10, 2026, { modus: 'woche' });
  assert.equal(B.schuleMoeglich(herbst), false);
  assert.equal(B.zusammenfassung(herbst), 'Ferien: 12.10.–16.10.2026');
  herbst.tage[0].art = 'Berufsschule';
  B.wendeAutomatikAn(herbst);
  assert.equal(herbst.tage[0].art, '');

  // beweglicher Ferientag als Abwesenheit „Ferien“ und Himmelfahrt-Woche 2026
  const mai = zustand(11, 5, 2026, { modus: 'woche', abwesenheiten: [{ art: 'Ferien', von: '2026-05-12', bis: '2026-05-12' }] });
  assert.deepEqual(B.infosDerWoche(mai).map((i) => i.ferien), [false, true, false, false, true]);
  assert.deepEqual(mai.tage.map((t) => t.art), ['', '', '', 'Feiertag', '']);
  assert.equal(B.schuleMoeglich(mai), true);
  assert.equal(B.zusammenfassung(mai), 'Feiertag: 14.05. Christi Himmelfahrt · Ferien: 12.05.2026, 15.05.2026');
});

test('ungültige Abwesenheiten werden ignoriert und gemeldet', () => {
  assert.equal(B.abwesenheitFehler({ art: 'Urlaub', von: '', bis: '' }), null);
  assert.match(B.abwesenheitFehler({ art: 'Urlaub', von: '2026-11-02', bis: '' }), /Bis-Datum/);
  assert.match(B.abwesenheitFehler({ art: 'Urlaub', von: '2026-11-05', bis: '2026-11-02' }), /vor dem Von-Datum/);
  const z = zustand(2, 11, 2026, { abwesenheiten: [{ art: 'Urlaub', von: '2026-11-05', bis: '2026-11-02' }] });
  assert.deepEqual(z.tage.map((t) => t.art), ['', '', '', '', '']);
});

test('Tagesbericht: manuelles Überschreiben eines Feiertags bleibt erhalten', () => {
  const z = zustand(28, 12, 2026);
  assert.equal(z.tage[4].art, 'Feiertag');
  z.tage[4].art = 'Betrieb';
  B.wendeAutomatikAn(z);
  assert.equal(z.tage[4].art, 'Betrieb');
  // Im Wochenbericht ist der Feiertag fest
  B.wechsleModus(z, 'woche');
  z.tage[4].art = 'Betrieb';
  B.wendeAutomatikAn(z);
  assert.equal(z.tage[4].art, 'Feiertag');
});

test('Summen in Std:Min, getrennt nach Betrieb und Schule', () => {
  const z = zustand(2, 11, 2026, { modus: 'woche' });
  const werte = [['Betrieb', '8:45'], ['Berufsschule', '6:00'], ['Betrieb', '7:30'], ['Betrieb', '8:00'], ['Berufsschule', '5:15']];
  werte.forEach(([art, zeit], i) => Object.assign(z.tage[i], { art, zeit }));
  assert.deepEqual(B.summen(z), { betrieb: 1455, schule: 675, gesamt: 2130 });
  z.tage[1].zeit = '8:99'; // ungültig → zählt nicht
  assert.equal(B.summen(z).schule, 315);
  z.tage[0].art = 'Urlaub';
  assert.equal(B.summen(z).betrieb, 930);
});

test('Prüfung für den fertigen Export (beide Modi)', () => {
  const z = zustand(2, 11, 2026);
  let felder = B.pruefe(z).map((f) => f.feld);
  assert.deepEqual(felder, ['name', 'abteilung', 'jahr', 'nachweisNr',
    'tag-0-art', 'tag-1-art', 'tag-2-art', 'tag-3-art', 'tag-4-art']);

  Object.assign(z.kopf, { name: 'Dion Meier', abteilung: 'Einkauf', jahr: '1', nachweisNr: '3' });
  z.tage.forEach((t) => { t.art = 'Betrieb'; t.zeit = '8:00'; t.text = 'x'; });
  z.tage[1].zeit = '';
  z.tage[2].zeit = '9:75';
  z.tage[3].text = ' ';
  felder = B.pruefe(z).map((f) => f.feld);
  assert.deepEqual(felder, ['tag-1-zeit', 'tag-2-zeit', 'tag-3-text']);

  B.wechsleModus(z, 'woche');
  z.tage.forEach((t, i) => { t.art = i === 2 ? 'Berufsschule' : 'Betrieb'; t.zeit = '8:00'; });
  assert.deepEqual(B.pruefe(z).map((f) => f.feld), ['text-betrieb', 'text-schule']);
  z.texte.betrieb = 'Angebote';
  z.texte.schule = 'Mathe';
  z.abwesenheiten.push({ art: 'Urlaub', von: '2026-11-20', bis: '2026-11-19' });
  assert.deepEqual(B.pruefe(z).map((f) => f.feld), ['abw-0']);
  z.abwesenheiten = [];
  assert.deepEqual(B.pruefe(z), []);
});

test('hatText, Moduswechsel und Wochenwechsel leeren Einträge', () => {
  const z = zustand(2, 11, 2026, { abwesenheiten: [{ art: 'Krank', von: '2026-11-06', bis: '2026-11-06' }] });
  Object.assign(z.kopf, { name: 'Tjark Elvers', abteilung: 'Versand', jahr: '3' });
  assert.equal(B.hatText(z), false);
  z.tage[0].art = 'Urlaub';
  z.tage[0].text = 'versteckter Text';
  assert.equal(B.hatText(z), false);
  z.tage[1].art = 'Betrieb';
  z.tage[1].text = 'Inventur';
  assert.equal(B.hatText(z), true);
  B.wechsleModus(z, 'woche');
  assert.equal(B.hatText(z), false);
  assert.equal(z.kopf.name, 'Tjark Elvers');
  assert.equal(z.tage[4].art, 'Krank');
  z.texte.unterweisung = 'Brandschutz';
  assert.equal(B.hatText(z), true);
  B.wechsleWoche(z, K.addTage(z.montag, 7));
  assert.equal(B.hatText(z), false);
  assert.equal(z.modus, 'woche');
  assert.equal(z.abwesenheiten.length, 1);
});

test('Dateinamen, Mailtext und mailto-Link', () => {
  const z = zustand(26, 10, 2026);
  Object.assign(z.kopf, { name: 'Berdan Öner', abteilung: 'Vertrieb GaLaBau', jahr: '2', nachweisNr: '14' });
  assert.equal(B.dateiname(z), 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau.pdf');
  assert.equal(B.dateiname(z, true), 'Berichtsheft_Oener_KW44_2026_Vertrieb-GaLaBau_Entwurf.pdf');
  assert.equal(B.dateiname(B.neuerZustand(K.datum(2027, 1, 1)), true), 'Berichtsheft_Unbenannt_KW53_2026_Entwurf.pdf');

  const mail = B.mailTexte(z);
  assert.equal(mail.betreff, 'Berichtsheft – Berdan Öner – KW 44/2026 – Vertrieb GaLaBau');
  assert.equal(mail.text,
    'Hallo,\n\nanbei mein Ausbildungsnachweis Nr. 14 (Tagesbericht) für die KW 44/2026 (26.10.–30.10.2026) ' +
    'aus der Abteilung Vertrieb GaLaBau.\n\nViele Grüße\nBerdan Öner\nAuszubildende/r im 2. Ausbildungsjahr\nHYDROTEC Technologies AG');
  z.modus = 'woche';
  assert.match(B.mailTexte(z).text, /Nr\. 14 \(Wochenbericht\)/);

  const link = B.mailtoLink('Betreff – ä', 'Zeile 1\nZeile 2 & mehr');
  assert.equal(link, 'mailto:?subject=Betreff%20%E2%80%93%20%C3%A4&body=Zeile%201%0D%0AZeile%202%20%26%20mehr');
});

test('JSON-Serialisierung: Roundtrip und Schema-Prüfung', () => {
  const z = zustand(28, 12, 2026, { modus: 'woche', abwesenheiten: [{ art: 'Ferien', von: '2026-12-28', bis: '2026-12-28' }] });
  Object.assign(z.kopf, { name: 'Hijra Rasheed', abteilung: 'Marketing', jahr: '2', beginn: '2025-08-01', nachweisNr: '74' });
  z.tage[0].art = 'Betrieb';
  z.tage[0].zeit = '7:45';
  z.texte.betrieb = 'Messe vorbereitet – „Grüße“ ✓';
  const json = B.serialisiere(z, 'entwurf', new Date('2026-12-30T10:00:00Z'));
  assert.equal(json.schema, 'hydrotec-berichtsheft');
  assert.equal(json.version, 1);
  assert.equal(json.status, 'entwurf');
  assert.deepEqual(json.daten.woche, { jahr: 2026, kw: 53 });

  const zurueck = B.deserialisiere(JSON.parse(JSON.stringify(json)));
  assert.equal(zurueck.status, 'entwurf');
  assert.equal(zurueck.exportiertAm, '2026-12-30T10:00:00.000Z');
  assert.deepEqual(B.serialisiere(zurueck.zustand, 'entwurf', new Date('2026-12-30T10:00:00Z')), json);

  assert.throws(() => B.deserialisiere({ schema: 'etwas-anderes' }), /Kein Berichtsheft/);
  assert.throws(() => B.deserialisiere(Object.assign({}, json, { version: 99 })), /neueren Version/);
});

test('Sammlung: Sortierung, Lücken, Duplikate, Entwürfe, Namen', () => {
  let n = 0;
  function eintrag(kw, jahr, extra) {
    const z = B.neuerZustand(K.montagVonKW(kw, jahr));
    z.kopf.name = 'Alicia Brandt';
    z.kopf.beginn = '';
    const e = { id: 'd' + (++n), ok: true, status: 'fertig', exportiertAm: '2026-11-0' + n + 'T10:00:00Z', zustand: z, einschliessen: true };
    if (extra) extra(e);
    return e;
  }
  const liste = [
    eintrag(47, 2026),
    eintrag(44, 2026),
    eintrag(46, 2026),
    eintrag(46, 2026, (e) => { e.exportiertAm = '2026-11-20T10:00:00Z'; }),
    eintrag(45, 2026, (e) => { e.status = 'entwurf'; e.einschliessen = false; }),
    { id: 'fremd', ok: false, einschliessen: false }
  ];
  let a = B.analysiereSammlung(liste);
  assert.deepEqual(a.gewaehlt.map((e) => B.kwInfo(e.zustand.montag).kurz), ['KW 44/2026', 'KW 46/2026', 'KW 47/2026']);
  assert.equal(a.fehlendText, 'KW 45/2026');
  assert.equal(a.duplikate.length, 1);
  assert.equal(a.duplikate[0].gewaehlt, 'd4'); // zuletzt exportiert
  assert.deepEqual(a.namen, ['Alicia Brandt']);

  a = B.analysiereSammlung(liste, { '2026-46': 'd3' });
  assert.equal(a.gewaehlt[1].id, 'd3');

  liste[4].einschliessen = true;
  liste[4].zustand.kopf.name = 'Alicia Brand';
  a = B.analysiereSammlung(liste);
  assert.equal(a.fehlend.length, 0);
  assert.deepEqual(a.namen, ['Alicia Brandt', 'Alicia Brand']);

  // Ausbildungsbeginn vor der ersten Woche → Lücke am Anfang
  liste[1].zustand.kopf.beginn = '2026-10-12';
  a = B.analysiereSammlung(liste);
  assert.equal(a.fehlendText, 'KW 42–43/2026');
  assert.equal(B.gesamtDateiname(a), 'Berichtsheft_Gesamt_Brandt_KW44-2026_bis_KW47-2026.pdf');
});

test('KW-Listen zusammenfassen (inkl. Jahreswechsel)', () => {
  const m = (kw, j) => K.montagVonKW(kw, j);
  assert.equal(B.formatKwListe([m(12, 2026), m(13, 2026), m(14, 2026), m(30, 2026)]), 'KW 12–14/2026, KW 30/2026');
  assert.equal(B.formatKwListe([m(1, 2027), m(53, 2026)]), 'KW 53/2026–KW 1/2027');
  assert.equal(B.formatKwListe([]), '');
});
