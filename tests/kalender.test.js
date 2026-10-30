// Tests für public/kalender.js – ausführen mit:  node --test tests/kalender.test.js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../public/kalender.js');

function kw(tag, monat, jahr) {
  return K.isoWoche(K.datum(jahr, monat, tag));
}

test('ISO-Kalenderwochen inkl. Jahreswechsel', () => {
  assert.deepEqual(kw(26, 10, 2026), { woche: 44, jahr: 2026 });
  assert.deepEqual(kw(30, 10, 2026), { woche: 44, jahr: 2026 });
  assert.deepEqual(kw(28, 12, 2026), { woche: 53, jahr: 2026 });
  assert.deepEqual(kw(1, 1, 2027), { woche: 53, jahr: 2026 });
  assert.deepEqual(kw(3, 1, 2027), { woche: 53, jahr: 2026 });
  assert.deepEqual(kw(4, 1, 2027), { woche: 1, jahr: 2027 });
  assert.deepEqual(kw(31, 12, 2029), { woche: 1, jahr: 2030 });
  assert.deepEqual(kw(1, 1, 2026), { woche: 1, jahr: 2026 });
  assert.deepEqual(kw(29, 12, 2025), { woche: 1, jahr: 2026 });
  assert.deepEqual(kw(1, 1, 2021), { woche: 53, jahr: 2020 });
});

test('Montag einer KW', () => {
  assert.equal(K.formatDatum(K.montagVonKW(44, 2026)), '26.10.2026');
  assert.equal(K.formatDatum(K.montagVonKW(53, 2026)), '28.12.2026');
  assert.equal(K.formatDatum(K.montagVonKW(1, 2027)), '04.01.2027');
  assert.equal(K.formatDatum(K.montagVonKW(1, 2030)), '31.12.2029');
  assert.equal(K.formatDatum(K.montagDerWoche(K.datum(2027, 1, 1))), '28.12.2026');
});

test('Wochen durchblättern bleibt konsistent (2020–2035)', () => {
  let montag = K.montagVonKW(1, 2020);
  let vorher = K.isoWoche(montag);
  for (let i = 0; i < 52 * 16; i++) {
    montag = K.addTage(montag, 7);
    const jetzt = K.isoWoche(montag);
    assert.equal(montag.getDay(), 1);
    if (jetzt.jahr === vorher.jahr) {
      assert.equal(jetzt.woche, vorher.woche + 1);
    } else {
      assert.equal(jetzt.woche, 1);
      assert.ok(vorher.woche === 52 || vorher.woche === 53);
    }
    vorher = jetzt;
  }
});

test('Ostersonntag', () => {
  assert.equal(K.formatDatum(K.ostersonntag(2024)), '31.03.2024');
  assert.equal(K.formatDatum(K.ostersonntag(2025)), '20.04.2025');
  assert.equal(K.formatDatum(K.ostersonntag(2026)), '05.04.2026');
  assert.equal(K.formatDatum(K.ostersonntag(2027)), '28.03.2027');
  assert.equal(K.formatDatum(K.ostersonntag(2028)), '16.04.2028');
});

function feiertage(jahr) {
  return K.feiertageNiedersachsen(jahr).map((f) => K.formatDatum(f.datum) + ' ' + f.name);
}

test('Feiertage Niedersachsen 2026', () => {
  assert.deepEqual(feiertage(2026), [
    '01.01.2026 Neujahr',
    '03.04.2026 Karfreitag',
    '06.04.2026 Ostermontag',
    '01.05.2026 Tag der Arbeit (1. Mai)',
    '14.05.2026 Christi Himmelfahrt',
    '25.05.2026 Pfingstmontag',
    '03.10.2026 Tag der Deutschen Einheit',
    '31.10.2026 Reformationstag',
    '25.12.2026 1. Weihnachtstag',
    '26.12.2026 2. Weihnachtstag'
  ]);
});

test('Feiertage Niedersachsen 2027', () => {
  assert.deepEqual(feiertage(2027), [
    '01.01.2027 Neujahr',
    '26.03.2027 Karfreitag',
    '29.03.2027 Ostermontag',
    '01.05.2027 Tag der Arbeit (1. Mai)',
    '06.05.2027 Christi Himmelfahrt',
    '17.05.2027 Pfingstmontag',
    '03.10.2027 Tag der Deutschen Einheit',
    '31.10.2027 Reformationstag',
    '25.12.2027 1. Weihnachtstag',
    '26.12.2027 2. Weihnachtstag'
  ]);
});

test('feiertagName', () => {
  assert.equal(K.feiertagName(K.datum(2027, 1, 1)), 'Neujahr');
  assert.equal(K.feiertagName(K.datum(2026, 4, 3)), 'Karfreitag');
  assert.equal(K.feiertagName(K.datum(2026, 10, 30)), null);
  assert.equal(K.feiertagName(K.datum(2026, 12, 24)), null);
});
