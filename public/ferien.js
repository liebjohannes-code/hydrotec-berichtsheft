/* =====================================================================
 *  SCHULFERIEN NIEDERSACHSEN – ZUM PFLEGEN
 *  Je Eintrag: erster und letzter Ferientag (JJJJ-MM-TT, beide inklusive).
 *  Einzelne bewegliche Ferientage: von = bis.
 *  Quelle: Niedersächsisches Kultusministerium.
 *  TODO: für 2028 ergänzen (Weihnachten 2027/28 ist bereits enthalten).
 * ===================================================================== */
var SCHULFERIEN = [
  // 2025/26
  { name: 'Weihnachtsferien', von: '2025-12-22', bis: '2026-01-05' },

  // 2026
  { name: 'Halbjahresferien', von: '2026-02-02', bis: '2026-02-03' },
  { name: 'Osterferien', von: '2026-03-23', bis: '2026-04-07' },
  { name: 'Ferientag', von: '2026-05-15', bis: '2026-05-15' },
  { name: 'Ferientag', von: '2026-05-26', bis: '2026-05-26' },
  { name: 'Sommerferien', von: '2026-07-02', bis: '2026-08-12' },
  { name: 'Herbstferien', von: '2026-10-12', bis: '2026-10-24' },
  { name: 'Weihnachtsferien', von: '2026-12-23', bis: '2027-01-09' },

  // 2027
  { name: 'Halbjahresferien', von: '2027-02-01', bis: '2027-02-02' },
  { name: 'Osterferien', von: '2027-03-22', bis: '2027-04-03' },
  { name: 'Ferientag', von: '2027-05-07', bis: '2027-05-07' },
  { name: 'Ferientag', von: '2027-05-18', bis: '2027-05-18' },
  { name: 'Sommerferien', von: '2027-07-08', bis: '2027-08-18' },
  { name: 'Herbstferien', von: '2027-10-16', bis: '2027-10-30' },
  { name: 'Weihnachtsferien', von: '2027-12-23', bis: '2028-01-08' }

  // 2028: hier ergänzen
];

/* ===================================================================== */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./kalender.js'), SCHULFERIEN);
  } else {
    root.Ferien = factory(root.Kalender, SCHULFERIEN);
  }
})(typeof window !== 'undefined' ? window : this, function (K, liste) {
  'use strict';

  // Name der Schulferien an Datum d oder null.
  function schulferienAm(d) {
    var iso = K.isoDatum(d);
    for (var i = 0; i < liste.length; i++) {
      if (iso >= liste[i].von && iso <= liste[i].bis) return liste[i].name;
    }
    return null;
  }

  return { SCHULFERIEN: liste, schulferienAm: schulferienAm };
});
