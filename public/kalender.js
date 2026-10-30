/*
 * Kalender-Hilfsfunktionen: ISO-8601-Kalenderwochen, Osterdatum und
 * gesetzliche Feiertage in Niedersachsen.
 * Reine Funktionen ohne DOM – laufen im Browser (window.Kalender) und in Node (Tests).
 */
(function (root) {
  'use strict';

  // Datum ohne Uhrzeit anlegen (12:00 Uhr, damit Sommer-/Winterzeit nie einen Tag verschiebt).
  function datum(jahr, monat, tag) {
    return new Date(jahr, monat - 1, tag, 12, 0, 0, 0);
  }

  function addTage(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }

  function gleicherTag(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  // Montag der Woche, in der d liegt.
  function montagDerWoche(d) {
    var basis = datum(d.getFullYear(), d.getMonth() + 1, d.getDate());
    var wochentag = (basis.getDay() + 6) % 7; // Mo = 0 … So = 6
    return addTage(basis, -wochentag);
  }

  // ISO-8601-Kalenderwoche: { woche, jahr }. Das Jahr ist das ISO-Wochenjahr
  // (z. B. gehört der 01.01.2027 zur KW 53 / 2026).
  function isoWoche(d) {
    var donnerstag = addTage(montagDerWoche(d), 3);
    var jahr = donnerstag.getFullYear();
    var ersterJan = datum(jahr, 1, 1);
    var tageSeitJan = Math.round((donnerstag - ersterJan) / 86400000);
    return { woche: Math.floor(tageSeitJan / 7) + 1, jahr: jahr };
  }

  // Montag der ISO-Woche `woche` im ISO-Wochenjahr `jahr`.
  function montagVonKW(woche, jahr) {
    // Der 4. Januar liegt immer in KW 1.
    return addTage(montagDerWoche(datum(jahr, 1, 4)), (woche - 1) * 7);
  }

  // Ostersonntag nach dem Gauß/Meeus-Algorithmus (gregorianischer Kalender).
  function ostersonntag(jahr) {
    var a = jahr % 19;
    var b = Math.floor(jahr / 100);
    var c = jahr % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var monat = Math.floor((h + l - 7 * m + 114) / 31);
    var tag = ((h + l - 7 * m + 114) % 31) + 1;
    return datum(jahr, monat, tag);
  }

  // Gesetzliche Feiertage Niedersachsen für ein Kalenderjahr.
  function feiertageNiedersachsen(jahr) {
    var ostern = ostersonntag(jahr);
    return [
      { datum: datum(jahr, 1, 1), name: 'Neujahr' },
      { datum: addTage(ostern, -2), name: 'Karfreitag' },
      { datum: addTage(ostern, 1), name: 'Ostermontag' },
      { datum: datum(jahr, 5, 1), name: 'Tag der Arbeit (1. Mai)' },
      { datum: addTage(ostern, 39), name: 'Christi Himmelfahrt' },
      { datum: addTage(ostern, 50), name: 'Pfingstmontag' },
      { datum: datum(jahr, 10, 3), name: 'Tag der Deutschen Einheit' },
      { datum: datum(jahr, 10, 31), name: 'Reformationstag' },
      { datum: datum(jahr, 12, 25), name: '1. Weihnachtstag' },
      { datum: datum(jahr, 12, 26), name: '2. Weihnachtstag' }
    ];
  }

  // Name des Feiertags an Datum d oder null.
  function feiertagName(d) {
    var liste = feiertageNiedersachsen(d.getFullYear());
    for (var i = 0; i < liste.length; i++) {
      if (gleicherTag(liste[i].datum, d)) return liste[i].name;
    }
    return null;
  }

  function zweistellig(n) {
    return (n < 10 ? '0' : '') + n;
  }

  // TT.MM.JJJJ
  function formatDatum(d) {
    return zweistellig(d.getDate()) + '.' + zweistellig(d.getMonth() + 1) + '.' + d.getFullYear();
  }

  var api = {
    datum: datum,
    addTage: addTage,
    montagDerWoche: montagDerWoche,
    isoWoche: isoWoche,
    montagVonKW: montagVonKW,
    ostersonntag: ostersonntag,
    feiertageNiedersachsen: feiertageNiedersachsen,
    feiertagName: feiertagName,
    formatDatum: formatDatum,
    zweistellig: zweistellig
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Kalender = api;
  }
})(typeof window !== 'undefined' ? window : this);
