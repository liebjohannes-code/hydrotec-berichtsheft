/*
 * Fachlogik des Berichtshefts – ohne DOM, damit sie in Node getestet werden kann.
 * Zustand eines Berichts:
 *   { modus: 'tag'|'woche', kopf: {...}, montag: Date, tage: [5 × {art, zeit, text, auto}],
 *     texte: {betrieb, unterweisung, schule}, abwesenheiten: [{art, von, bis}] }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./kalender.js'), require('./ferien.js'), require('./zeit.js'));
  } else {
    root.Bericht = factory(root.Kalender, root.Ferien, root.Zeit);
  }
})(typeof window !== 'undefined' ? window : this, function (K, F, Z) {
  'use strict';

  var SCHEMA = 'hydrotec-berichtsheft';
  var SCHEMA_VERSION = 1;

  var WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  var ARTEN = ['Betrieb', 'Berufsschule', 'Urlaub', 'Krank', 'Feiertag'];
  var ABWESENHEITSARTEN = ['Urlaub', 'Krank', 'Ferien'];
  var MODI = { tag: 'Tagesbericht', woche: 'Wochenbericht' };

  /* ---------- Grundzustand ---------- */

  function leererTag() {
    return { art: '', zeit: '', text: '', auto: null };
  }

  function leereTexte() {
    return { betrieb: '', unterweisung: '', schule: '' };
  }

  function neuerZustand(heute) {
    var z = {
      modus: 'tag',
      kopf: { name: '', abteilung: '', jahr: '', beginn: '', nachweisNr: '', nachweisNrManuell: false },
      montag: K.montagDerWoche(heute || new Date()),
      tage: WOCHENTAGE.map(leererTag),
      texte: leereTexte(),
      abwesenheiten: []
    };
    wendeAutomatikAn(z);
    return z;
  }

  function istArbeitsart(art) {
    return art === 'Betrieb' || art === 'Berufsschule';
  }

  function datumVonTag(z, i) {
    return K.addTage(z.montag, i);
  }

  function kwInfo(montag) {
    var kw = K.isoWoche(montag);
    var fr = K.addTage(montag, 4);
    var kurz = montag.getFullYear() === fr.getFullYear()
      ? K.formatKurz(montag) + '–' + K.formatDatum(fr)
      : K.formatDatum(montag) + '–' + K.formatDatum(fr);
    return {
      woche: kw.woche,
      jahr: kw.jahr,
      titel: 'KW ' + kw.woche + ' / ' + kw.jahr,
      kurz: 'KW ' + kw.woche + '/' + kw.jahr,
      zeitraum: K.formatDatum(montag) + ' – ' + K.formatDatum(fr),
      zeitraumKurz: kurz
    };
  }

  /* ---------- Abwesenheiten, Ferien, Feiertage ---------- */

  // Liefert für einen Abwesenheits-Eintrag eine Fehlermeldung oder null.
  // Komplett leere Zeilen gelten als „noch nicht ausgefüllt“ und werden ignoriert.
  function abwesenheitFehler(a) {
    if (!a.von && !a.bis) return null;
    var von = K.parseIsoDatum(a.von);
    var bis = K.parseIsoDatum(a.bis);
    if (!von || !bis) return 'Bitte Von- und Bis-Datum angeben.';
    if (bis < von) return 'Das Bis-Datum liegt vor dem Von-Datum.';
    return null;
  }

  function gueltigeAbwesenheiten(liste) {
    return (liste || []).filter(function (a) {
      return a.von && a.bis && !abwesenheitFehler(a) && ABWESENHEITSARTEN.indexOf(a.art) >= 0;
    });
  }

  // Was steht an diesem Datum fest? Gesetzliche Feiertage haben Vorrang,
  // dann Krank vor Urlaub; Ferien sperren nur die Berufsschule.
  function tagInfo(d, abwesenheiten) {
    var iso = K.isoDatum(d);
    var feiertag = K.feiertagName(d);
    var krank = false, urlaub = false, ferienAbw = false;
    gueltigeAbwesenheiten(abwesenheiten).forEach(function (a) {
      if (iso < a.von || iso > a.bis) return;
      if (a.art === 'Krank') krank = true;
      else if (a.art === 'Urlaub') urlaub = true;
      else if (a.art === 'Ferien') ferienAbw = true;
    });
    var schulferien = F.schulferienAm(d);
    var abwesenheit = krank ? 'Krank' : urlaub ? 'Urlaub' : null;
    return {
      feiertag: feiertag,
      abwesenheit: abwesenheit,
      ferien: !!(schulferien || ferienAbw),
      ferienName: schulferien || (ferienAbw ? 'Ferientag' : null),
      gesperrt: feiertag ? 'Feiertag' : abwesenheit
    };
  }

  function infosDerWoche(z) {
    return z.tage.map(function (_, i) { return tagInfo(datumVonTag(z, i), z.abwesenheiten); });
  }

  // Setzt Feiertag/Urlaub/Krank automatisch und entfernt „Berufsschule“ an Ferientagen.
  // Im Tagesbericht bleibt eine manuelle Änderung erhalten, solange sich die Automatik nicht ändert.
  function wendeAutomatikAn(z) {
    infosDerWoche(z).forEach(function (info, i) {
      var tag = z.tage[i];
      var neu = info.gesperrt;
      if (neu) {
        if (z.modus === 'woche' || tag.auto !== neu || tag.art === '' || tag.art === tag.auto) tag.art = neu;
        tag.auto = neu;
      } else {
        if (tag.auto && tag.art === tag.auto) tag.art = '';
        tag.auto = null;
        if (z.modus === 'woche' && !istArbeitsart(tag.art)) tag.art = '';
      }
      if (info.ferien && tag.art === 'Berufsschule') tag.art = '';
    });
    return z;
  }

  // Ist in dieser Woche überhaupt ein Berufsschultag möglich?
  function schuleMoeglich(z) {
    return infosDerWoche(z).some(function (info) { return !info.gesperrt && !info.ferien; });
  }

  // Zusammenfassung der Woche, z. B. „Krank: 04.11.–05.11.2026 (2 Tage) · Feiertag: 31.10. Reformationstag“
  function zusammenfassung(z) {
    var infos = infosDerWoche(z);
    var kategorien = z.tage.map(function (tag, i) {
      if (tag.art === 'Urlaub' || tag.art === 'Krank' || tag.art === 'Feiertag') return tag.art;
      if (!tag.art && infos[i].gesperrt) return infos[i].gesperrt;
      return infos[i].ferien ? 'Ferien' : null;
    });

    function bereiche(kat) {
      var laeufe = [];
      kategorien.forEach(function (k, i) {
        if (k !== kat) return;
        var letzter = laeufe[laeufe.length - 1];
        if (letzter && letzter.bis === i - 1) letzter.bis = i;
        else laeufe.push({ von: i, bis: i });
      });
      return laeufe;
    }

    function zeitraum(lauf, mitAnzahl) {
      var a = datumVonTag(z, lauf.von);
      var b = datumVonTag(z, lauf.bis);
      var n = lauf.bis - lauf.von + 1;
      var text = lauf.von === lauf.bis
        ? K.formatDatum(a)
        : (a.getFullYear() === b.getFullYear() ? K.formatKurz(a) : K.formatDatum(a)) + '–' + K.formatDatum(b);
      return mitAnzahl ? text + ' (' + n + (n === 1 ? ' Tag)' : ' Tage)') : text;
    }

    var teile = [];
    ['Urlaub', 'Krank'].forEach(function (kat) {
      var l = bereiche(kat);
      if (l.length) teile.push(kat + ': ' + l.map(function (x) { return zeitraum(x, true); }).join(', '));
    });
    var feiertage = [];
    kategorien.forEach(function (k, i) {
      if (k === 'Feiertag') {
        feiertage.push(K.formatKurz(datumVonTag(z, i)) + ' ' + (infos[i].feiertag || 'Feiertag'));
      }
    });
    if (feiertage.length) teile.push('Feiertag: ' + feiertage.join(', '));
    var ferien = bereiche('Ferien');
    if (ferien.length) teile.push('Ferien: ' + ferien.map(function (x) { return zeitraum(x, false); }).join(', '));
    return teile.join(' · ');
  }

  /* ---------- Zeiten ---------- */

  function tagMinuten(tag) {
    if (!istArbeitsart(tag.art)) return 0;
    return Z.parseZeit(tag.zeit).minuten || 0;
  }

  function summen(z) {
    var s = { betrieb: 0, schule: 0, gesamt: 0 };
    z.tage.forEach(function (tag) {
      var m = tagMinuten(tag);
      if (tag.art === 'Betrieb') s.betrieb += m;
      if (tag.art === 'Berufsschule') s.schule += m;
      s.gesamt += m;
    });
    return s;
  }

  /* ---------- Nachweis-Nr. ---------- */

  // Woche des Ausbildungsbeginns = Nr. 1. Vor Ausbildungsbeginn: ''.
  function nachweisNrAuto(beginnIso, montag) {
    var beginn = K.parseIsoDatum(beginnIso);
    if (!beginn) return '';
    var n = K.wochenZwischen(beginn, montag) + 1;
    return n >= 1 ? n : '';
  }

  function aktualisiereNachweisNr(z) {
    if (z.kopf.beginn && !z.kopf.nachweisNrManuell) {
      z.kopf.nachweisNr = String(nachweisNrAuto(z.kopf.beginn, z.montag));
    }
    return z;
  }

  /* ---------- Wechsel von Woche / Modus ---------- */

  function hatText(z) {
    var tageText = z.tage.some(function (t) { return istArbeitsart(t.art) && t.text.trim() !== ''; });
    var blockText = Object.keys(z.texte).some(function (k) { return z.texte[k].trim() !== ''; });
    return tageText || blockText;
  }

  function leereEintraege(z) {
    z.tage = WOCHENTAGE.map(leererTag);
    z.texte = leereTexte();
    return wendeAutomatikAn(z);
  }

  // Neue Woche: Tage, Zeiten und Texte leeren; Nachweis-Nr. neu berechnen.
  function wechsleWoche(z, montag) {
    var alt = z.montag;
    z.montag = K.montagDerWoche(montag);
    leereEintraege(z);
    if (z.kopf.beginn) {
      z.kopf.nachweisNrManuell = false;
      aktualisiereNachweisNr(z);
    } else if (/^\d+$/.test(z.kopf.nachweisNr)) {
      var n = parseInt(z.kopf.nachweisNr, 10) + K.wochenZwischen(alt, z.montag);
      z.kopf.nachweisNr = n >= 1 ? String(n) : '';
    }
    return z;
  }

  function wechsleModus(z, modus) {
    z.modus = modus;
    return leereEintraege(z);
  }

  /* ---------- Prüfung für den fertigen Export ---------- */

  // Liefert eine Liste { feld, text } – leer, wenn alles passt.
  function pruefe(z) {
    var f = [];
    function fehler(feld, text) { f.push({ feld: feld, text: text }); }

    if (!z.kopf.name.trim()) fehler('name', 'Name fehlt.');
    if (!z.kopf.abteilung.trim()) fehler('abteilung', 'Abteilung fehlt.');
    if (!z.kopf.jahr) fehler('jahr', 'Ausbildungsjahr fehlt.');
    if (!/^\d+$/.test(String(z.kopf.nachweisNr)) || parseInt(z.kopf.nachweisNr, 10) < 1) {
      fehler('nachweisNr', 'Nachweis-Nr. fehlt.');
    }
    if (z.kopf.beginn && !K.parseIsoDatum(z.kopf.beginn)) fehler('beginn', 'Ausbildungsbeginn ist ungültig.');

    (z.abwesenheiten || []).forEach(function (a, i) {
      var t = abwesenheitFehler(a);
      if (t) fehler('abw-' + i, t);
    });

    z.tage.forEach(function (tag, i) {
      if (!tag.art) { fehler('tag-' + i + '-art', 'Art fehlt (' + WOCHENTAGE[i] + ').'); return; }
      if (!istArbeitsart(tag.art)) return;
      var zeit = Z.parseZeit(tag.zeit);
      if (zeit.leer) fehler('tag-' + i + '-zeit', 'Zeit fehlt (' + WOCHENTAGE[i] + ').');
      else if (zeit.fehler) fehler('tag-' + i + '-zeit', zeit.fehler);
      if (z.modus === 'tag' && !tag.text.trim()) fehler('tag-' + i + '-text', 'Text fehlt (' + WOCHENTAGE[i] + ').');
    });

    if (z.modus === 'woche') {
      var arten = z.tage.map(function (t) { return t.art; });
      if (arten.indexOf('Betrieb') >= 0 && !z.texte.betrieb.trim()) {
        fehler('text-betrieb', 'Betriebliche Tätigkeiten fehlen.');
      }
      if (arten.indexOf('Berufsschule') >= 0 && schuleMoeglich(z) && !z.texte.schule.trim()) {
        fehler('text-schule', 'Berufsschul-Themen fehlen.');
      }
    }
    return f;
  }

  /* ---------- Dateinamen & Mail ---------- */

  // Für Dateinamen: Umlaute ersetzen, Leerzeichen → Bindestrich, Sonderzeichen entfernen.
  function dateinamenTeil(s) {
    return String(s || '')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/-+/g, '-');
  }

  function nachname(name) {
    var teile = String(name || '').trim().split(/\s+/);
    return teile[teile.length - 1] || '';
  }

  function dateiname(z, entwurf) {
    var kw = kwInfo(z.montag);
    var abt = dateinamenTeil(z.kopf.abteilung);
    return 'Berichtsheft_' + (dateinamenTeil(nachname(z.kopf.name)) || 'Unbenannt') +
      '_KW' + K.zweistellig(kw.woche) + '_' + kw.jahr +
      (abt ? '_' + abt : '') + (entwurf ? '_Entwurf' : '') + '.pdf';
  }

  function mailTexte(z) {
    var kw = kwInfo(z.montag);
    var name = z.kopf.name.trim();
    return {
      betreff: 'Berichtsheft – ' + name + ' – ' + kw.kurz + ' – ' + z.kopf.abteilung,
      text:
        'Hallo,\n\n' +
        'anbei mein Ausbildungsnachweis Nr. ' + z.kopf.nachweisNr + ' (' + MODI[z.modus] + ') für die ' +
        kw.kurz + ' (' + kw.zeitraumKurz + ') aus der Abteilung ' + z.kopf.abteilung + '.\n\n' +
        'Viele Grüße\n' +
        name + '\n' +
        'Auszubildende/r im ' + z.kopf.jahr + '. Ausbildungsjahr\n' +
        'HYDROTEC Technologies AG'
    };
  }

  // mailto-Link ohne Empfänger; Zeilenumbrüche als CRLF (Outlook).
  function mailtoLink(betreff, text) {
    return 'mailto:?subject=' + encodeURIComponent(betreff) +
      '&body=' + encodeURIComponent(String(text).replace(/\r?\n/g, '\r\n'));
  }

  /* ---------- JSON (wird ins PDF eingebettet) ---------- */

  function serialisiere(z, status, jetzt) {
    var kw = K.isoWoche(z.montag);
    return {
      schema: SCHEMA,
      version: SCHEMA_VERSION,
      status: status === 'entwurf' ? 'entwurf' : 'fertig',
      exportiertAm: (jetzt || new Date()).toISOString(),
      daten: {
        modus: z.modus,
        kopf: {
          name: z.kopf.name, abteilung: z.kopf.abteilung, jahr: z.kopf.jahr, beginn: z.kopf.beginn,
          nachweisNr: String(z.kopf.nachweisNr), nachweisNrManuell: !!z.kopf.nachweisNrManuell
        },
        woche: { jahr: kw.jahr, kw: kw.woche },
        tage: z.tage.map(function (t) { return { art: t.art, zeit: t.zeit, text: t.text, auto: t.auto }; }),
        texte: { betrieb: z.texte.betrieb, unterweisung: z.texte.unterweisung, schule: z.texte.schule },
        abwesenheiten: z.abwesenheiten.map(function (a) { return { art: a.art, von: a.von, bis: a.bis }; })
      }
    };
  }

  // Ältere Schema-Versionen hier auf die aktuelle heben (bisher gibt es nur Version 1).
  function migriere(obj) {
    return obj;
  }

  function str(v) { return v == null ? '' : String(v); }

  // JSON → { zustand, status, exportiertAm }. Wirft bei ungültigen Daten einen Error.
  function deserialisiere(obj) {
    if (!obj || obj.schema !== SCHEMA) throw new Error('Kein Berichtsheft-Datensatz.');
    if (typeof obj.version !== 'number' || obj.version > SCHEMA_VERSION) {
      throw new Error('Diese Datei stammt aus einer neueren Version des Berichtsheft-Generators.');
    }
    obj = migriere(obj);
    var d = obj.daten || {};
    var w = d.woche || {};
    if (!(w.kw >= 1 && w.kw <= 53 && w.jahr > 2000)) throw new Error('Kalenderwoche fehlt.');
    var montag = K.montagVonKW(w.kw, w.jahr);
    var kopf = d.kopf || {};
    var texte = d.texte || {};
    var z = {
      modus: d.modus === 'woche' ? 'woche' : 'tag',
      kopf: {
        name: str(kopf.name), abteilung: str(kopf.abteilung), jahr: str(kopf.jahr), beginn: str(kopf.beginn),
        nachweisNr: str(kopf.nachweisNr), nachweisNrManuell: !!kopf.nachweisNrManuell
      },
      montag: montag,
      tage: WOCHENTAGE.map(function (_, i) {
        var t = (d.tage || [])[i] || {};
        return {
          art: ARTEN.indexOf(t.art) >= 0 ? t.art : '',
          zeit: str(t.zeit),
          text: str(t.text),
          auto: ARTEN.indexOf(t.auto) >= 0 ? t.auto : null
        };
      }),
      texte: { betrieb: str(texte.betrieb), unterweisung: str(texte.unterweisung), schule: str(texte.schule) },
      abwesenheiten: (d.abwesenheiten || []).map(function (a) {
        return { art: ABWESENHEITSARTEN.indexOf(a.art) >= 0 ? a.art : 'Urlaub', von: str(a.von), bis: str(a.bis) };
      })
    };
    wendeAutomatikAn(z);
    return { zustand: z, status: obj.status === 'entwurf' ? 'entwurf' : 'fertig', exportiertAm: str(obj.exportiertAm) };
  }

  /* ---------- Sammel-PDF ---------- */

  function wochenSchluessel(montag) {
    var kw = K.isoWoche(montag);
    return kw.jahr + '-' + K.zweistellig(kw.woche);
  }

  // Fasst aufeinanderfolgende Wochen zusammen: „KW 12–14/2026, KW 30/2026“
  function formatKwListe(montage) {
    var gruppen = [];
    montage.slice().sort(function (a, b) { return a - b; }).forEach(function (m) {
      var g = gruppen[gruppen.length - 1];
      if (g && K.wochenZwischen(g.bis, m) === 1) g.bis = m;
      else gruppen.push({ von: m, bis: m });
    });
    return gruppen.map(function (g) {
      var a = K.isoWoche(g.von);
      var b = K.isoWoche(g.bis);
      if (g.von.getTime() === g.bis.getTime()) return 'KW ' + a.woche + '/' + a.jahr;
      if (a.jahr === b.jahr) return 'KW ' + a.woche + '–' + b.woche + '/' + a.jahr;
      return 'KW ' + a.woche + '/' + a.jahr + '–KW ' + b.woche + '/' + b.jahr;
    }).join(', ');
  }

  // eintraege: [{ id, ok, status, exportiertAm, zustand, einschliessen }]
  // auswahl:   { 'JJJJ-KW': id } – welche Datei bei doppelten Wochen gilt
  function analysiereSammlung(eintraege, auswahl) {
    auswahl = auswahl || {};
    var gruppen = {};
    eintraege.forEach(function (e) {
      if (!e.ok || !e.einschliessen) return;
      var key = wochenSchluessel(e.zustand.montag);
      (gruppen[key] = gruppen[key] || []).push(e);
    });

    var gewaehlt = [];
    var duplikate = [];
    Object.keys(gruppen).forEach(function (key) {
      var kandidaten = gruppen[key].slice().sort(function (a, b) {
        return a.exportiertAm < b.exportiertAm ? 1 : a.exportiertAm > b.exportiertAm ? -1 : 0;
      });
      var wahl = kandidaten.filter(function (k) { return k.id === auswahl[key]; })[0] || kandidaten[0];
      gewaehlt.push(wahl);
      if (kandidaten.length > 1) {
        duplikate.push({ schluessel: key, titel: kwInfo(wahl.zustand.montag).kurz, kandidaten: kandidaten, gewaehlt: wahl.id });
      }
    });
    gewaehlt.sort(function (a, b) { return a.zustand.montag - b.zustand.montag; });
    duplikate.sort(function (a, b) { return a.schluessel < b.schluessel ? -1 : 1; });

    var namen = [];
    gewaehlt.forEach(function (e) {
      var n = e.zustand.kopf.name.trim();
      if (n && namen.indexOf(n) < 0) namen.push(n);
    });

    var ergebnis = { gewaehlt: gewaehlt, duplikate: duplikate, namen: namen, fehlend: [], fehlendText: '', beginn: '' };
    if (!gewaehlt.length) return ergebnis;

    var mitBeginn = gewaehlt.filter(function (e) { return K.parseIsoDatum(e.zustand.kopf.beginn); });
    ergebnis.beginn = mitBeginn.length ? mitBeginn[mitBeginn.length - 1].zustand.kopf.beginn : '';
    var erste = gewaehlt[0].zustand.montag;
    var letzte = gewaehlt[gewaehlt.length - 1].zustand.montag;
    var start = ergebnis.beginn ? K.montagDerWoche(K.parseIsoDatum(ergebnis.beginn)) : erste;
    if (start > erste) start = erste;

    var vorhanden = {};
    gewaehlt.forEach(function (e) { vorhanden[wochenSchluessel(e.zustand.montag)] = true; });
    for (var m = start, n = 0; m <= letzte && n < 1000; m = K.addTage(m, 7), n++) {
      if (!vorhanden[wochenSchluessel(m)]) ergebnis.fehlend.push(m);
    }
    ergebnis.fehlendText = formatKwListe(ergebnis.fehlend);
    return ergebnis;
  }

  function gesamtDateiname(analyse) {
    var g = analyse.gewaehlt;
    var a = K.isoWoche(g[0].zustand.montag);
    var b = K.isoWoche(g[g.length - 1].zustand.montag);
    var name = dateinamenTeil(nachname(analyse.namen[0])) || 'Unbenannt';
    return 'Berichtsheft_Gesamt_' + name +
      '_KW' + K.zweistellig(a.woche) + '-' + a.jahr +
      '_bis_KW' + K.zweistellig(b.woche) + '-' + b.jahr + '.pdf';
  }

  return {
    SCHEMA: SCHEMA,
    SCHEMA_VERSION: SCHEMA_VERSION,
    WOCHENTAGE: WOCHENTAGE,
    ARTEN: ARTEN,
    ABWESENHEITSARTEN: ABWESENHEITSARTEN,
    MODI: MODI,
    neuerZustand: neuerZustand,
    istArbeitsart: istArbeitsart,
    datumVonTag: datumVonTag,
    kwInfo: kwInfo,
    abwesenheitFehler: abwesenheitFehler,
    tagInfo: tagInfo,
    infosDerWoche: infosDerWoche,
    wendeAutomatikAn: wendeAutomatikAn,
    schuleMoeglich: schuleMoeglich,
    zusammenfassung: zusammenfassung,
    tagMinuten: tagMinuten,
    summen: summen,
    nachweisNrAuto: nachweisNrAuto,
    aktualisiereNachweisNr: aktualisiereNachweisNr,
    hatText: hatText,
    wechsleWoche: wechsleWoche,
    wechsleModus: wechsleModus,
    pruefe: pruefe,
    dateinamenTeil: dateinamenTeil,
    nachname: nachname,
    dateiname: dateiname,
    mailTexte: mailTexte,
    mailtoLink: mailtoLink,
    serialisiere: serialisiere,
    deserialisiere: deserialisiere,
    formatKwListe: formatKwListe,
    analysiereSammlung: analysiereSammlung,
    gesamtDateiname: gesamtDateiname
  };
});
