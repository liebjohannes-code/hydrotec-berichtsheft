/*
 * Zeitangaben im Format Std:Min (z. B. 8:45). Intern wird in Minuten gerechnet.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Zeit = factory();
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var MAX_MINUTEN = 12 * 60;

  // Wandelt eine Eingabe wie „8:45“, „8:“, „:30“, „8“ in Minuten um.
  // Ergebnis: { leer: true } | { minuten: 525 } | { fehler: 'Text' }
  function parseZeit(eingabe) {
    var s = String(eingabe == null ? '' : eingabe).trim();
    if (s === '' || s === ':') return { leer: true };
    var teile = s.split(':');
    if (teile.length > 2) return { fehler: 'Bitte im Format Std:Min eingeben, z. B. 8:45.' };
    var std = teile[0].trim();
    var min = teile.length === 2 ? teile[1].trim() : '';
    if (!/^\d{0,2}$/.test(std) || !/^\d{0,2}$/.test(min)) {
      return { fehler: 'Bitte nur Ziffern eingeben, z. B. 8:45.' };
    }
    var h = std === '' ? 0 : parseInt(std, 10);
    var m = min === '' ? 0 : parseInt(min, 10);
    if (m > 59) return { fehler: 'Minuten müssen zwischen 0 und 59 liegen.' };
    if (h > 12 || h * 60 + m > MAX_MINUTEN) return { fehler: 'Höchstens 12:00 Std. pro Tag.' };
    return { minuten: h * 60 + m };
  }

  // 525 → „8:45“
  function formatZeit(minuten) {
    var n = Math.max(0, Math.round(minuten || 0));
    var m = n % 60;
    return Math.floor(n / 60) + ':' + (m < 10 ? '0' : '') + m;
  }

  // Normalisiert eine gültige Eingabe („8:5“ → „8:05“), sonst unverändert.
  function normalisiere(eingabe) {
    var r = parseZeit(eingabe);
    return r.minuten != null ? formatZeit(r.minuten) : String(eingabe == null ? '' : eingabe);
  }

  function summe(liste) {
    return liste.reduce(function (s, n) { return s + (n || 0); }, 0);
  }

  return {
    MAX_MINUTEN: MAX_MINUTEN,
    parseZeit: parseZeit,
    formatZeit: formatZeit,
    normalisiere: normalisiere,
    summe: summe
  };
});
