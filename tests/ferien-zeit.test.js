// Tests für Schulferien (public/ferien.js) und Std:Min (public/zeit.js)
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../public/kalender.js');
const F = require('../public/ferien.js');
const Z = require('../public/zeit.js');

const ferien = (t, m, j) => F.schulferienAm(K.datum(j, m, t));

test('Schulferien 2026', () => {
  assert.equal(ferien(5, 1, 2026), 'Weihnachtsferien');
  assert.equal(ferien(6, 1, 2026), null);
  assert.equal(ferien(2, 2, 2026), 'Halbjahresferien');
  assert.equal(ferien(3, 2, 2026), 'Halbjahresferien');
  assert.equal(ferien(4, 2, 2026), null);
  assert.equal(ferien(23, 3, 2026), 'Osterferien');
  assert.equal(ferien(7, 4, 2026), 'Osterferien');
  assert.equal(ferien(8, 4, 2026), null);
  assert.equal(ferien(15, 5, 2026), 'Ferientag');
  assert.equal(ferien(14, 5, 2026), null); // Himmelfahrt ist Feiertag, kein Ferientag
  assert.equal(ferien(26, 5, 2026), 'Ferientag');
  assert.equal(ferien(1, 7, 2026), null);
  assert.equal(ferien(2, 7, 2026), 'Sommerferien');
  assert.equal(ferien(12, 8, 2026), 'Sommerferien');
  assert.equal(ferien(13, 8, 2026), null);
  assert.equal(ferien(12, 10, 2026), 'Herbstferien');
  assert.equal(ferien(24, 10, 2026), 'Herbstferien');
  assert.equal(ferien(26, 10, 2026), null);
});

test('Schulferien 2027 inkl. Weihnachten über den Jahreswechsel', () => {
  assert.equal(ferien(22, 12, 2026), null);
  assert.equal(ferien(23, 12, 2026), 'Weihnachtsferien');
  assert.equal(ferien(31, 12, 2026), 'Weihnachtsferien');
  assert.equal(ferien(1, 1, 2027), 'Weihnachtsferien');
  assert.equal(ferien(9, 1, 2027), 'Weihnachtsferien');
  assert.equal(ferien(11, 1, 2027), null);
  assert.equal(ferien(1, 2, 2027), 'Halbjahresferien');
  assert.equal(ferien(2, 2, 2027), 'Halbjahresferien');
  assert.equal(ferien(22, 3, 2027), 'Osterferien');
  assert.equal(ferien(3, 4, 2027), 'Osterferien');
  assert.equal(ferien(5, 4, 2027), null);
  assert.equal(ferien(7, 5, 2027), 'Ferientag');
  assert.equal(ferien(18, 5, 2027), 'Ferientag');
  assert.equal(ferien(8, 7, 2027), 'Sommerferien');
  assert.equal(ferien(18, 8, 2027), 'Sommerferien');
  assert.equal(ferien(19, 8, 2027), null);
  assert.equal(ferien(16, 10, 2027), 'Herbstferien');
  assert.equal(ferien(30, 10, 2027), 'Herbstferien');
  assert.equal(ferien(23, 12, 2027), 'Weihnachtsferien');
  assert.equal(ferien(8, 1, 2028), 'Weihnachtsferien');
  assert.equal(ferien(10, 1, 2028), null);
});

test('Ferienliste ist sortiert und plausibel', () => {
  F.SCHULFERIEN.forEach((f, i) => {
    assert.ok(K.parseIsoDatum(f.von) && K.parseIsoDatum(f.bis), f.von);
    assert.ok(f.von <= f.bis, f.von);
    if (i) assert.ok(F.SCHULFERIEN[i - 1].bis < f.von, f.von);
  });
});

test('Std:Min parsen', () => {
  assert.deepEqual(Z.parseZeit('8:45'), { minuten: 525 });
  assert.deepEqual(Z.parseZeit('5:00'), { minuten: 300 });
  assert.deepEqual(Z.parseZeit('8'), { minuten: 480 });
  assert.deepEqual(Z.parseZeit('8:'), { minuten: 480 });
  assert.deepEqual(Z.parseZeit(':30'), { minuten: 30 });
  assert.deepEqual(Z.parseZeit('0:00'), { minuten: 0 });
  assert.deepEqual(Z.parseZeit('12:00'), { minuten: 720 });
  assert.deepEqual(Z.parseZeit(' 7 : 05 '), { minuten: 425 });
  assert.deepEqual(Z.parseZeit(''), { leer: true });
  assert.deepEqual(Z.parseZeit(':'), { leer: true });
  assert.deepEqual(Z.parseZeit(null), { leer: true });
  assert.match(Z.parseZeit('8:60').fehler, /Minuten/);
  assert.match(Z.parseZeit('12:01').fehler, /12:00/);
  assert.match(Z.parseZeit('13:00').fehler, /12:00/);
  assert.match(Z.parseZeit('acht').fehler, /Ziffern/);
  assert.match(Z.parseZeit('8:4a').fehler, /Ziffern/);
  assert.match(Z.parseZeit('-1:00').fehler, /Ziffern/);
  assert.match(Z.parseZeit('1:2:3').fehler, /Format/);
});

test('Std:Min formatieren und summieren', () => {
  assert.equal(Z.formatZeit(525), '8:45');
  assert.equal(Z.formatZeit(0), '0:00');
  assert.equal(Z.formatZeit(5), '0:05');
  assert.equal(Z.formatZeit(2400), '40:00');
  assert.equal(Z.normalisiere('8:5'), '8:05');
  assert.equal(Z.normalisiere('8'), '8:00');
  assert.equal(Z.normalisiere('xx'), 'xx');
  const summe = Z.summe(['8:45', '8:45', '7:30', '6:00', '8:00'].map((s) => Z.parseZeit(s).minuten));
  assert.equal(Z.formatZeit(summe), '39:00');
  assert.equal(Z.formatZeit(Z.summe([480, 480, 480, 480, 480])), '40:00');
});
