/*
 * Berichtsheft-Generator – HYDROTEC Technologies AG
 * Oberfläche. Die Fachlogik steckt in kalender.js, ferien.js, zeit.js, bericht.js und pdf.js.
 * Es wird nichts gespeichert: alle Eingaben leben nur im Browser-Tab und im exportierten PDF.
 */

/* =====================================================================
 *  LISTEN ZUM PFLEGEN
 *  Einfach Namen/Abteilungen hinzufügen, entfernen oder umbenennen.
 *  „Sonstige“ (Freitext) wird automatisch als letzter Eintrag ergänzt.
 *  (Die Schulferien stehen in ferien.js.)
 * ===================================================================== */
const AZUBIS = [
  'Jeremy Turgut',
  'Berdan Öner',
  'Alicia Brandt',
  'Hijra Rasheed',
  'Tjark Elvers',
  'Dion Meier',
  'Nicole Wala'
];

const ABTEILUNGEN = [
  'Buchhaltung',
  'Einkauf',
  'Vertrieb Inland',
  'Vertrieb Export',
  'Vertrieb GaLaBau',
  'Zentrale',
  'Versand',
  'Marketing',
  'Arbeitsvorbereitung',
  'Personalabteilung'
];

/* ===================================================================== */

(function () {
  'use strict';

  const K = window.Kalender;
  const Z = window.Zeit;
  const B = window.Bericht;
  const P = window.BerichtPdf;
  const SONSTIGE = '__sonstige__';
  const TEXT_INFO = {
    Betrieb: { label: 'Tätigkeiten', placeholder: 'Welche Tätigkeiten hast du heute im Betrieb erledigt?' },
    Berufsschule: { label: 'Themen / Fächer', placeholder: 'Welche Fächer und Themen wurden behandelt?' }
  };
  const CHIP_KLASSE = { Feiertag: 'chip-feiertag', Urlaub: 'chip-urlaub', Krank: 'chip-krank', Ferien: 'chip-ferien' };

  const $ = (id) => document.getElementById(id);
  const el = (tag, klasse, text) => {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text != null) e.textContent = text;
    return e;
  };

  let z = B.neuerZustand(new Date());
  let geaendert = false;

  function markiereGeaendert() {
    geaendert = true;
    $('mailBox').hidden = true;
  }

  /* ================================================================
   *  Kopfdaten
   * ================================================================ */

  function fuelleSelect(sel, eintraege) {
    sel.add(new Option('Bitte wählen', ''));
    eintraege.forEach((e) => sel.add(new Option(e, e)));
    sel.add(new Option('Sonstige …', SONSTIGE));
  }

  function auswahlWert(selectId, freiId) {
    const sel = $(selectId);
    return (sel.value === SONSTIGE ? $(freiId).value : sel.value).replace(/\s+/g, ' ').trim();
  }

  function setzeAuswahl(selectId, freiId, wert, liste) {
    const sel = $(selectId);
    const frei = $(freiId);
    if (!wert) { sel.value = ''; frei.value = ''; }
    else if (liste.indexOf(wert) >= 0) { sel.value = wert; frei.value = ''; }
    else { sel.value = SONSTIGE; frei.value = wert; }
    frei.hidden = sel.value !== SONSTIGE;
  }

  function verbindeAuswahl(selectId, freiId, feld) {
    const sel = $(selectId);
    const frei = $(freiId);
    const uebernehmen = () => {
      z.kopf[feld] = auswahlWert(selectId, freiId);
      markiereGeaendert();
    };
    sel.addEventListener('change', () => {
      frei.hidden = sel.value !== SONSTIGE;
      if (!frei.hidden) frei.focus();
      uebernehmen();
    });
    frei.addEventListener('input', uebernehmen);
  }

  function zeichneNachweisNr() {
    const feld = $('nachweisNr');
    if (document.activeElement !== feld) feld.value = z.kopf.nachweisNr;
    const hinweis = $('nrHinweis');
    hinweis.textContent = '';
    if (!z.kopf.beginn) {
      hinweis.textContent = 'Mit Ausbildungsbeginn wird die Nr. automatisch berechnet.';
    } else if (z.kopf.nachweisNrManuell) {
      hinweis.append('Manuell geändert · ');
      const knopf = el('button', 'link-btn', 'automatisch berechnen');
      knopf.type = 'button';
      knopf.addEventListener('click', () => {
        z.kopf.nachweisNrManuell = false;
        B.aktualisiereNachweisNr(z);
        markiereGeaendert();
        zeichneNachweisNr();
      });
      hinweis.append(knopf);
    } else if (!z.kopf.nachweisNr) {
      hinweis.textContent = 'Diese Woche liegt vor dem Ausbildungsbeginn.';
    } else {
      hinweis.textContent = 'Automatisch aus dem Ausbildungsbeginn berechnet.';
    }
  }

  function zeichneKopf() {
    setzeAuswahl('name', 'nameSonstige', z.kopf.name, AZUBIS);
    setzeAuswahl('abteilung', 'abteilungSonstige', z.kopf.abteilung, ABTEILUNGEN);
    $('jahr').value = z.kopf.jahr;
    $('beginn').value = z.kopf.beginn;
    zeichneNachweisNr();
  }

  /* ================================================================
   *  Zeit-Eingabe (Stunden- und Minutenfeld)
   * ================================================================ */

  // Baut ein Std:Min-Feldpaar; liefert ein Objekt zum Aktualisieren.
  function baueZeitFeld(i, beschriftung) {
    const box = el('div', 'zeit');
    const std = el('input', 'zeit-std');
    const min = el('input', 'zeit-min');
    [std, min].forEach((f) => {
      f.type = 'text';
      f.inputMode = 'numeric';
      f.maxLength = 2;
      f.autocomplete = 'off';
      f.spellcheck = true;
      f.lang = 'de';
    });
    std.placeholder = 'Std';
    min.placeholder = 'Min';
    std.setAttribute('aria-label', 'Stunden ' + beschriftung);
    min.setAttribute('aria-label', 'Minuten ' + beschriftung);
    box.append(std, el('span', 'zeit-doppelpunkt', ':'), min);
    const fehler = el('div', 'zeit-fehler');
    fehler.setAttribute('role', 'status');

    const lesen = () => {
      const roh = std.value.trim() || min.value.trim() ? std.value.trim() + ':' + min.value.trim() : '';
      z.tage[i].zeit = roh;
      zeigeFehler();
      zeichneSummen();
      markiereGeaendert();
    };
    const zeigeFehler = () => {
      const r = Z.parseZeit(z.tage[i].zeit);
      fehler.textContent = r.fehler || '';
      box.classList.toggle('zeit-falsch', !!r.fehler);
    };
    std.addEventListener('input', () => {
      if (std.value.length === 2 && /^\d\d$/.test(std.value)) min.focus();
      lesen();
    });
    min.addEventListener('input', lesen);
    // Erst normalisieren („8:5“ → „8:05“), wenn der Fokus das ganze Zeitfeld verlässt –
    // sonst stünde beim Wechsel von Std nach Min schon „00“ im Minutenfeld.
    box.addEventListener('focusout', (e) => {
      if (box.contains(e.relatedTarget)) return;
      const r = Z.parseZeit(z.tage[i].zeit);
      if (r.minuten != null && z.tage[i].zeit) {
        z.tage[i].zeit = Z.formatZeit(r.minuten);
        std.value = String(Math.floor(r.minuten / 60));
        min.value = K.zweistellig(r.minuten % 60);
      }
    });

    function aktualisiere(aktiv) {
      std.disabled = min.disabled = !aktiv;
      if (!aktiv) {
        std.value = z.tage[i].art ? '0' : '';
        min.value = z.tage[i].art ? '00' : '';
        fehler.textContent = '';
        box.classList.remove('zeit-falsch');
        return;
      }
      const teile = z.tage[i].zeit ? z.tage[i].zeit.split(':') : ['', ''];
      if (document.activeElement !== std) std.value = teile[0] || '';
      if (document.activeElement !== min) min.value = teile[1] || '';
      zeigeFehler();
    }
    return { box, fehler, aktualisiere };
  }

  /* ================================================================
   *  Tagesbericht
   * ================================================================ */

  const karten = [];

  function baueTagesKarten() {
    const vorlage = $('tagVorlage');
    B.WOCHENTAGE.forEach((name, i) => {
      const knoten = vorlage.content.firstElementChild.cloneNode(true);
      knoten.querySelector('.tag-name').textContent = name;

      const segmente = knoten.querySelector('.segmente');
      segmente.setAttribute('aria-label', 'Art des Tages – ' + name);
      segmente.id = 'tag-' + i + '-art';
      B.ARTEN.forEach((art) => {
        const label = el('label');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'art-' + i;
        radio.value = art;
        radio.addEventListener('change', () => setzeArt(i, art));
        label.append(radio, document.createTextNode(art));
        segmente.append(label);
      });

      const text = knoten.querySelector('textarea');
      text.id = 'tag-' + i + '-text';
      knoten.querySelector('.text-label').htmlFor = text.id;
      text.addEventListener('input', () => {
        z.tage[i].text = text.value;
        wachse(text);
        markiereGeaendert();
      });

      const zeit = baueZeitFeld(i, name);
      zeit.box.id = 'tag-' + i + '-zeit';
      knoten.querySelector('.zeit-platz').append(zeit.box, zeit.fehler);

      $('tage').append(knoten);
      karten.push({ knoten, segmente, text, zeit });
    });
  }

  function chipsFuer(container, info, tag) {
    container.textContent = '';
    if (info.feiertag) container.append(el('span', 'chip chip-feiertag', 'Feiertag: ' + info.feiertag));
    if (info.abwesenheit && !info.feiertag) container.append(el('span', 'chip ' + CHIP_KLASSE[info.abwesenheit], info.abwesenheit));
    if (info.ferien && !info.gesperrt) {
      container.append(el('span', 'chip chip-ferien', info.ferienName === 'Ferientag' ? 'Ferien (Ferientag)' : 'Ferien'));
    }
    return tag;
  }

  function zeichneTagesKarte(i, info) {
    const tag = z.tage[i];
    const k = karten[i];
    const aktiv = B.istArbeitsart(tag.art);
    k.knoten.querySelector('.tag-datum').textContent = K.formatDatum(B.datumVonTag(z, i));
    chipsFuer(k.knoten.querySelector('.chips'), info, tag);
    k.knoten.classList.toggle('ist-frei', !!tag.art && !aktiv);

    k.segmente.querySelectorAll('label').forEach((label) => {
      const radio = label.querySelector('input');
      radio.checked = radio.value === tag.art;
      radio.disabled = radio.value === 'Berufsschule' && info.ferien;
      label.classList.toggle('aktiv', radio.checked);
      label.classList.toggle('gesperrt', radio.disabled);
      label.title = radio.disabled ? 'In den Ferien ist keine Berufsschule' : '';
    });

    const textInfo = TEXT_INFO[tag.art];
    k.knoten.querySelector('.text-label').textContent = textInfo ? textInfo.label : 'Tätigkeiten / Themen';
    k.text.placeholder = textInfo ? textInfo.placeholder : (tag.art ? '' : 'Bitte zuerst die Art wählen.');
    k.text.disabled = !aktiv;
    k.text.value = aktiv ? tag.text : '';
    wachse(k.text);
    k.zeit.aktualisiere(aktiv);
  }

  function setzeArt(i, art) {
    if (z.tage[i].art === art) return;
    z.tage[i].art = art;
    markiereGeaendert();
    zeichneTage();
  }

  /* ================================================================
   *  Wochenbericht
   * ================================================================ */

  const zeilen = [];

  function baueWochenleiste() {
    const leiste = $('wochenleiste');
    leiste.append(el('div', 'wl-titel', 'Wochenübersicht'));
    B.WOCHENTAGE.forEach((name, i) => {
      const zeile = el('div', 'wl-zeile');
      const tag = el('div', 'wl-tag');
      const tagName = el('strong', null, name);
      const datum = el('span', 'wl-datum');
      tag.append(tagName, datum);

      const art = el('div', 'wl-art');
      art.id = 'woche-' + i + '-art';
      const wahl = el('div', 'wl-wahl');
      wahl.setAttribute('role', 'radiogroup');
      wahl.setAttribute('aria-label', 'Art – ' + name);
      ['Betrieb', 'Berufsschule'].forEach((a) => {
        const label = el('label');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'wart-' + i;
        radio.value = a;
        radio.addEventListener('change', () => setzeArt(i, a));
        label.append(radio, document.createTextNode(a));
        wahl.append(label);
      });
      const chips = el('div', 'chips');
      art.append(wahl, chips);

      const zeit = baueZeitFeld(i, name);
      zeit.box.id = 'woche-' + i + '-zeit';
      const zeitPlatz = el('div', 'wl-zeit');
      zeitPlatz.append(zeit.box, zeit.fehler);

      zeile.append(tag, art, zeitPlatz);
      leiste.append(zeile);
      zeilen.push({ zeile, datum, wahl, chips, zeit });
    });
  }

  function zeichneWochenZeile(i, info) {
    const tag = z.tage[i];
    const r = zeilen[i];
    const datum = B.datumVonTag(z, i);
    r.datum.textContent = K.formatDatum(datum);
    r.zeile.className = 'wl-zeile' + (info.gesperrt ? ' wl-' + info.gesperrt.toLowerCase() : info.ferien ? ' wl-ferien' : '');
    r.wahl.hidden = !!info.gesperrt;
    r.wahl.querySelectorAll('label').forEach((label) => {
      const radio = label.querySelector('input');
      radio.checked = radio.value === tag.art;
      radio.disabled = radio.value === 'Berufsschule' && info.ferien;
      label.classList.toggle('aktiv', radio.checked);
      label.classList.toggle('gesperrt', radio.disabled);
      label.title = radio.disabled ? 'In den Ferien ist keine Berufsschule' : '';
    });
    r.chips.textContent = '';
    if (info.feiertag) r.chips.append(el('span', 'chip chip-feiertag', 'Feiertag · ' + info.feiertag));
    else if (info.abwesenheit) r.chips.append(el('span', 'chip ' + CHIP_KLASSE[info.abwesenheit], info.abwesenheit));
    if (info.ferien && !info.gesperrt) r.chips.append(el('span', 'chip chip-ferien', 'Ferien'));
    r.zeit.aktualisiere(B.istArbeitsart(tag.art));
  }

  function verbindeBlock(id, feld) {
    const t = $(id);
    t.addEventListener('input', () => {
      z.texte[feld] = t.value;
      wachse(t);
      markiereGeaendert();
    });
  }

  function zeichneWochenTexte() {
    [['textBetrieb', 'betrieb'], ['textUnterweisung', 'unterweisung'], ['textSchule', 'schule']].forEach(([id, feld]) => {
      const t = $(id);
      if (t.value !== z.texte[feld]) t.value = z.texte[feld];
      wachse(t);
    });
    $('blockSchule').hidden = !B.schuleMoeglich(z);
  }

  /* ================================================================
   *  Abwesenheiten
   * ================================================================ */

  function zeichneAbwesenheiten() {
    const liste = $('abwListe');
    liste.textContent = '';
    z.abwesenheiten.forEach((a, i) => {
      const zeile = el('div', 'abw-zeile');
      zeile.id = 'abw-' + i;

      const art = el('select');
      art.setAttribute('aria-label', 'Art der Abwesenheit');
      B.ABWESENHEITSARTEN.forEach((x) => art.add(new Option(x, x)));
      art.value = a.art;

      const von = el('input');
      von.type = 'date';
      von.value = a.von;
      von.setAttribute('aria-label', 'Von');
      const bis = el('input');
      bis.type = 'date';
      bis.value = a.bis;
      bis.setAttribute('aria-label', 'Bis');

      const loeschen = el('button', 'abw-loeschen', '✕');
      loeschen.type = 'button';
      loeschen.setAttribute('aria-label', 'Abwesenheit löschen');
      loeschen.title = 'Löschen';

      const fehler = el('div', 'abw-fehler');
      const pruefen = () => {
        const t = B.abwesenheitFehler(z.abwesenheiten[i]);
        fehler.textContent = t || '';
        zeile.classList.toggle('abw-falsch', !!t);
      };
      const geaendertAbw = () => {
        z.abwesenheiten[i] = { art: art.value, von: von.value, bis: bis.value };
        pruefen();
        markiereGeaendert();
        B.wendeAutomatikAn(z);
        zeichneWoche();
      };
      art.addEventListener('change', geaendertAbw);
      von.addEventListener('change', () => {
        if (von.value && !bis.value) bis.value = von.value;
        geaendertAbw();
      });
      bis.addEventListener('change', geaendertAbw);
      loeschen.addEventListener('click', () => {
        z.abwesenheiten.splice(i, 1);
        markiereGeaendert();
        B.wendeAutomatikAn(z);
        zeichneAbwesenheiten();
        zeichneWoche();
      });

      const felder = el('div', 'abw-felder');
      const lVon = el('label', 'abw-label');
      lVon.append(el('span', null, 'Von'), von);
      const lBis = el('label', 'abw-label');
      lBis.append(el('span', null, 'Bis'), bis);
      const lArt = el('label', 'abw-label');
      lArt.append(el('span', null, 'Art'), art);
      felder.append(lArt, lVon, lBis, loeschen);
      zeile.append(felder, fehler);
      liste.append(zeile);
      pruefen();
    });
    $('abwNeu').textContent = z.abwesenheiten.length ? '+ weitere Abwesenheit' : '+ Abwesenheit hinzufügen';
  }

  /* ================================================================
   *  Woche zeichnen
   * ================================================================ */

  function zeichneTage() {
    const infos = B.infosDerWoche(z);
    if (z.modus === 'tag') infos.forEach((info, i) => zeichneTagesKarte(i, info));
    else {
      infos.forEach((info, i) => zeichneWochenZeile(i, info));
      zeichneWochenTexte();
    }
    const text = B.zusammenfassung(z);
    $('zusammenfassung').hidden = !text;
    $('zusammenfassung').textContent = text ? 'Diese Woche: ' + text : '';
    zeichneSummen();
  }

  function zeichneSummen() {
    const s = B.summen(z);
    const box = $('summen');
    box.textContent = '';
    if (z.modus === 'woche') {
      const teil = (titel, wert) => {
        const d = el('div', 'summe-teil');
        d.append(el('span', null, titel), el('strong', null, Z.formatZeit(wert) + ' Std.'));
        return d;
      };
      box.append(teil('Betrieb', s.betrieb), teil('Berufsschule', s.schule));
      $('zeitBetrieb').textContent = Z.formatZeit(s.betrieb) + ' Std.';
      $('zeitSchule').textContent = Z.formatZeit(s.schule) + ' Std.';
    }
    const gesamt = el('div', 'summe-teil summe-gesamt');
    gesamt.append(el('span', null, 'Woche gesamt'), el('strong', 'summe-wert', Z.formatZeit(s.gesamt) + ' Std.'));
    box.append(gesamt);
  }

  function zeichneWoche() {
    const info = B.kwInfo(z.montag);
    $('kwTitel').textContent = info.titel;
    $('kwZeitraum').textContent = info.zeitraum;
    $('kwHeute').hidden = K.montagDerWoche(new Date()).getTime() === z.montag.getTime();
    zeichneNachweisNr();
    zeichneTage();
  }

  function zeichneModus() {
    document.querySelectorAll('input[name="modus"]').forEach((r) => {
      r.checked = r.value === z.modus;
      r.parentElement.classList.toggle('aktiv', r.checked);
    });
    $('tage').hidden = z.modus !== 'tag';
    $('wochenbericht').hidden = z.modus !== 'woche';
    $('wochenTexte').hidden = z.modus !== 'woche';
  }

  function zeichneAlles() {
    zeichneKopf();
    zeichneModus();
    zeichneAbwesenheiten();
    zeichneWoche();
    leereFehler();
  }

  // Mitwachsende Textfelder
  function wachse(t) {
    if (!t.classList.contains('wachsend') || !t.offsetParent) return;
    t.style.height = 'auto';
    t.style.height = (t.scrollHeight + 2) + 'px';
  }

  /* ================================================================
   *  Dialog
   * ================================================================ */

  function bestaetige(text) {
    const dialog = $('dialog');
    $('dialogText').textContent = text;
    if (typeof dialog.showModal !== 'function') return Promise.resolve(window.confirm(text));
    return new Promise((resolve) => {
      dialog.returnValue = '';
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ja'), { once: true });
      dialog.showModal();
      $('dialogAbbrechen').focus();
    });
  }

  /* ================================================================
   *  Woche & Modus wechseln
   * ================================================================ */

  async function wechsleWoche(montag) {
    if (B.hatText(z) && !(await bestaetige('Einträge dieser Woche verwerfen und neue Woche starten?'))) return;
    B.wechsleWoche(z, montag);
    $('mailBox').hidden = true;
    leereFehler();
    zeichneWoche();
  }

  async function wechsleModus(modus) {
    if (modus === z.modus) return;
    if (B.hatText(z) && !(await bestaetige('Einträge verwerfen und zu ' + B.MODI[modus] + ' wechseln?'))) {
      zeichneModus();
      return;
    }
    B.wechsleModus(z, modus);
    $('mailBox').hidden = true;
    leereFehler();
    zeichneModus();
    zeichneTage();
  }

  /* ================================================================
   *  Prüfung & Fehleranzeige
   * ================================================================ */

  function feldElement(feld) {
    if (feld === 'name') return $('name').value === SONSTIGE ? $('nameSonstige') : $('name');
    if (feld === 'abteilung') return $('abteilung').value === SONSTIGE ? $('abteilungSonstige') : $('abteilung');
    if (feld === 'text-betrieb') return $('textBetrieb');
    if (feld === 'text-schule') return $('textSchule');
    const m = /^tag-(\d)-(art|zeit)$/.exec(feld);
    if (m && z.modus === 'woche') return $('woche-' + m[1] + '-' + m[2]);
    return $(feld);
  }

  function leereFehler() {
    document.querySelectorAll('.ungueltig').forEach((e) => e.classList.remove('ungueltig'));
    $('fehlermeldung').hidden = true;
  }

  function zeigeFehler(fehler) {
    leereFehler();
    const elemente = [];
    fehler.forEach((f) => {
      const e = feldElement(f.feld);
      if (e) { e.classList.add('ungueltig'); elemente.push(e); }
    });
    const box = $('fehlermeldung');
    box.textContent = '';
    box.append(el('strong', null, 'Bitte fülle die rot markierten Felder aus:'));
    const ul = el('ul');
    fehler.slice(0, 6).forEach((f) => ul.append(el('li', null, f.text)));
    if (fehler.length > 6) ul.append(el('li', null, '… und ' + (fehler.length - 6) + ' weitere'));
    box.append(ul);
    box.hidden = false;
    if (elemente[0]) {
      elemente[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      const fokus = elemente[0].matches('input, select, textarea') ? elemente[0] : elemente[0].querySelector('input:not(:disabled), select, textarea');
      if (fokus) fokus.focus({ preventScroll: true });
    }
  }

  // Markierung verschwindet, sobald das Feld bearbeitet wird.
  function entferneMarkierung(e) {
    const markiert = e.target.closest && e.target.closest('.ungueltig');
    if (markiert) markiert.classList.remove('ungueltig');
    if (!document.querySelector('.ungueltig')) $('fehlermeldung').hidden = true;
  }

  /* ================================================================
   *  Export
   * ================================================================ */

  let logoDaten = null;

  // Logo über ein Canvas als JPEG-Daten-URL holen (bei file:// ggf. nicht möglich → ohne Logo).
  function ladeLogo() {
    const img = $('logo');
    const lesen = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        logoDaten = { url: c.toDataURL('image/jpeg', 0.92), verhaeltnis: c.width / c.height };
      } catch (e) {
        logoDaten = null;
      }
    };
    if (img.complete && img.naturalWidth) lesen();
    else img.addEventListener('load', lesen, { once: true });
  }

  function bibliothekenDa() {
    if (window.jspdf && window.autoTable && window.PDFLib) return true;
    alert('Die PDF-Bibliotheken konnten nicht geladen werden. Bitte die Seite neu laden.');
    return false;
  }

  function herunterladen(bytes, dateiname) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = el('a');
    a.href = url;
    a.download = dateiname;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function beschaeftigt(knopf, arbeit) {
    const text = knopf.textContent;
    knopf.disabled = true;
    knopf.textContent = 'Wird erstellt …';
    try {
      return await arbeit();
    } catch (e) {
      console.error(e);
      alert('Beim Erstellen des PDFs ist ein Fehler aufgetreten: ' + e.message);
    } finally {
      knopf.disabled = false;
      knopf.textContent = text;
    }
  }

  async function exportiere(status) {
    if (!bibliothekenDa()) return;
    const entwurf = status === 'entwurf';
    if (!entwurf) {
      const fehler = B.pruefe(z);
      if (fehler.length) { zeigeFehler(fehler); return; }
    }
    leereFehler();
    await beschaeftigt($(entwurf ? 'exportEntwurf' : 'exportFertig'), async () => {
      const doc = P.erzeugeBerichtPdf(z, { jsPDF: window.jspdf.jsPDF, autoTable: window.autoTable, logo: logoDaten, entwurf });
      const bytes = await P.bettenEin(doc.output('arraybuffer'), B.serialisiere(z, status), window.PDFLib);
      herunterladen(bytes, B.dateiname(z, entwurf));
      geaendert = false;
      if (entwurf) $('mailBox').hidden = true;
      else zeigeMail();
    });
  }

  function zeigeMail() {
    const mail = B.mailTexte(z);
    $('mailBetreff').value = mail.betreff;
    $('mailText').value = mail.text;
    $('outlookLink').href = B.mailtoLink(mail.betreff, mail.text);
    const box = $('mailBox');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function kopiere(knopf) {
    const feld = $(knopf.dataset.kopieren);
    let ok = false;
    try {
      await navigator.clipboard.writeText(feld.value);
      ok = true;
    } catch (e) {
      // Fallback für ältere Browser / unsichere Kontexte
      feld.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    knopf.textContent = ok ? 'Kopiert ✓' : 'Bitte manuell kopieren';
    knopf.classList.toggle('kopiert', ok);
    clearTimeout(knopf._timer);
    knopf._timer = setTimeout(() => {
      knopf.textContent = 'Kopieren';
      knopf.classList.remove('kopiert');
    }, 2000);
  }

  /* ================================================================
   *  PDF hochladen & weiterschreiben
   * ================================================================ */

  function meldung(text, art) {
    const m = $('uploadMeldung');
    m.textContent = text;
    m.className = 'meldung' + (art ? ' meldung-' + art : '');
    m.hidden = !text;
  }

  async function ladeBericht(datei) {
    if (!datei || !bibliothekenDa()) return;
    meldung('');
    const bytes = new Uint8Array(await datei.arrayBuffer());
    const payload = await P.leseEingebettet(bytes, window.PDFLib);
    if (!payload) {
      meldung('Diese Datei wurde nicht mit dem Berichtsheft-Generator erstellt.', 'fehler');
      return;
    }
    let geladen;
    try {
      geladen = B.deserialisiere(payload);
    } catch (e) {
      meldung(e.message, 'fehler');
      return;
    }
    if (B.hatText(z) && !(await bestaetige('Aktuelle Einträge durch das hochgeladene PDF ersetzen?'))) return;
    z = geladen.zustand;
    geaendert = false;
    $('mailBox').hidden = true;
    zeichneAlles();
    const kw = B.kwInfo(z.montag);
    meldung('„' + datei.name + '“ geladen: ' + kw.kurz + ', ' + B.MODI[z.modus] +
      (geladen.status === 'entwurf' ? ' (Entwurf)' : '') + '. Du kannst jetzt weiterschreiben.', 'ok');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================================================================
   *  Gesamt-Berichtsheft
   * ================================================================ */

  let sammlung = [];
  let auswahl = {};
  let naechsteId = 1;

  async function fuegeHinzu(dateien) {
    if (!bibliothekenDa()) return;
    for (const datei of dateien) {
      const bytes = new Uint8Array(await datei.arrayBuffer());
      const eintrag = { id: 'f' + (naechsteId++), dateiname: datei.name, bytes, ok: false, einschliessen: false };
      const payload = await P.leseEingebettet(bytes.slice(), window.PDFLib);
      if (payload) {
        try {
          const g = B.deserialisiere(payload);
          Object.assign(eintrag, { ok: true, status: g.status, exportiertAm: g.exportiertAm, zustand: g.zustand, einschliessen: g.status !== 'entwurf' });
        } catch (e) {
          eintrag.fehler = e.message;
        }
      } else {
        eintrag.fehler = 'Nicht mit dem Berichtsheft-Generator erstellt';
      }
      sammlung.push(eintrag);
    }
    zeichneSammlung();
  }

  function zeichneSammlung() {
    $('sammelBereich').hidden = sammlung.length === 0;
    const tbody = $('sammelTabelle').querySelector('tbody');
    tbody.textContent = '';
    const sortiert = sammlung.slice().sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      return a.ok ? a.zustand.montag - b.zustand.montag : 0;
    });
    sortiert.forEach((e) => {
      const tr = el('tr', e.ok ? (e.status === 'entwurf' ? 'zeile-entwurf' : '') : 'zeile-fremd');
      const mit = el('td');
      const haken = el('input');
      haken.type = 'checkbox';
      haken.checked = e.einschliessen;
      haken.disabled = !e.ok;
      haken.setAttribute('aria-label', 'In Gesamt-PDF aufnehmen: ' + e.dateiname);
      haken.addEventListener('change', () => { e.einschliessen = haken.checked; zeichneSammlung(); });
      mit.append(haken);

      const status = el('td');
      if (!e.ok) status.append(el('span', 'chip chip-krank', 'Fremde Datei'));
      else if (e.status === 'entwurf') status.append(el('span', 'chip chip-ferien', 'Entwurf'));
      else status.append(el('span', 'chip chip-feiertag', 'Fertig'));

      const kw = e.ok ? B.kwInfo(e.zustand.montag).kurz : '—';
      const loeschen = el('button', 'abw-loeschen', '✕');
      loeschen.type = 'button';
      loeschen.setAttribute('aria-label', 'Datei entfernen: ' + e.dateiname);
      loeschen.addEventListener('click', () => {
        sammlung = sammlung.filter((x) => x !== e);
        zeichneSammlung();
      });
      const datei = el('td', 'datei', e.dateiname);
      if (e.fehler) datei.append(el('div', 'klein-fehler', e.fehler));
      tr.append(mit, el('td', 'kw', kw), datei, status,
        el('td', null, e.ok ? e.zustand.kopf.name || '—' : '—'),
        el('td', null, e.ok ? e.zustand.kopf.abteilung || '—' : '—'),
        el('td', null, e.ok ? B.MODI[e.zustand.modus] : '—'));
      const td = el('td');
      td.append(loeschen);
      tr.append(td);
      tbody.append(tr);
    });
    zeichnePruefung();
  }

  function zeichnePruefung() {
    const box = $('sammelPruefung');
    box.textContent = '';
    const a = B.analysiereSammlung(sammlung, auswahl);
    $('gesamtErstellen').disabled = a.gewaehlt.length === 0;
    if (!a.gewaehlt.length) {
      box.append(el('p', 'pruef-info', 'Keine Nachweise ausgewählt.'));
      return a;
    }
    const erste = B.kwInfo(a.gewaehlt[0].zustand.montag).kurz;
    const letzte = B.kwInfo(a.gewaehlt[a.gewaehlt.length - 1].zustand.montag).kurz;
    box.append(el('p', 'pruef-info', a.gewaehlt.length + (a.gewaehlt.length === 1 ? ' Nachweis' : ' Nachweise') +
      ' · ' + erste + ' bis ' + letzte));

    const fremd = sammlung.filter((e) => !e.ok).length;
    if (fremd) box.append(el('p', 'pruef-warnung', fremd + (fremd === 1 ? ' Datei wurde' : ' Dateien wurden') + ' nicht mit dem Berichtsheft-Generator erstellt und werden ignoriert.'));
    const entwuerfe = sammlung.filter((e) => e.ok && e.status === 'entwurf');
    if (entwuerfe.length) {
      const drin = entwuerfe.filter((e) => e.einschliessen).length;
      box.append(el('p', 'pruef-warnung', entwuerfe.length + (entwuerfe.length === 1 ? ' Entwurf' : ' Entwürfe') +
        (drin ? ' – davon ' + drin + ' eingeschlossen.' : ' – nicht eingeschlossen (Haken setzen zum Aufnehmen).')));
    }
    if (a.namen.length > 1) box.append(el('p', 'pruef-warnung', 'Achtung: unterschiedliche Namen – ' + a.namen.join(', ')));

    a.duplikate.forEach((d) => {
      const fs = el('fieldset', 'duplikat');
      fs.append(el('legend', null, d.titel + ' ist mehrfach vorhanden – welche Datei gilt?'));
      d.kandidaten.forEach((k) => {
        const label = el('label');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'dup-' + d.schluessel;
        radio.checked = k.id === d.gewaehlt;
        radio.addEventListener('change', () => { auswahl[d.schluessel] = k.id; zeichnePruefung(); });
        const datum = new Date(k.exportiertAm);
        const wann = isNaN(datum) ? '' : ' – exportiert ' + K.formatDatum(datum) + ' ' + K.zweistellig(datum.getHours()) + ':' + K.zweistellig(datum.getMinutes());
        label.append(radio, document.createTextNode(' ' + k.dateiname + wann + (k.status === 'entwurf' ? ' (Entwurf)' : '')));
        fs.append(label);
      });
      box.append(fs);
    });

    box.append(a.fehlend.length
      ? el('p', 'pruef-fehlend', 'Fehlend: ' + a.fehlendText)
      : el('p', 'pruef-ok', '✓ Keine fehlenden Wochen'));
    return a;
  }

  async function erstelleGesamt() {
    if (!bibliothekenDa()) return;
    const a = B.analysiereSammlung(sammlung, auswahl);
    if (!a.gewaehlt.length) return;
    const nachId = {};
    sammlung.forEach((e) => { nachId[e.id] = e; });
    await beschaeftigt($('gesamtErstellen'), async () => {
      const bytes = await P.erzeugeGesamtPdf(a, {
        jsPDF: window.jspdf.jsPDF, autoTable: window.autoTable, PDFLib: window.PDFLib, logo: logoDaten,
        bytesVon: (id) => nachId[id].bytes.slice()
      });
      herunterladen(bytes, B.gesamtDateiname(a));
    });
  }

  /* ================================================================
   *  Tabs & Drag and Drop
   * ================================================================ */

  function zeigeTab(name) {
    const bericht = name === 'bericht';
    $('tabBericht').setAttribute('aria-selected', String(bericht));
    $('tabGesamt').setAttribute('aria-selected', String(!bericht));
    $('panelBericht').hidden = !bericht;
    $('panelGesamt').hidden = bericht;
    if (bericht) zeichneTage();
  }

  function verbindeDragDrop() {
    let tiefe = 0;
    const overlay = $('dropOverlay');
    const hatDateien = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
    document.addEventListener('dragenter', (e) => {
      if (!hatDateien(e)) return;
      tiefe++;
      overlay.firstElementChild.textContent = $('panelGesamt').hidden ? 'PDF hier ablegen zum Weiterschreiben' : 'PDFs hier ablegen';
      overlay.hidden = false;
    });
    document.addEventListener('dragleave', (e) => {
      if (!hatDateien(e)) return;
      tiefe = Math.max(0, tiefe - 1);
      if (!tiefe) overlay.hidden = true;
    });
    document.addEventListener('dragover', (e) => {
      if (hatDateien(e)) e.preventDefault();
    });
    document.addEventListener('drop', (e) => {
      if (!hatDateien(e)) return;
      e.preventDefault();
      tiefe = 0;
      overlay.hidden = true;
      const dateien = Array.from(e.dataTransfer.files);
      if (!dateien.length) return;
      if ($('panelGesamt').hidden) ladeBericht(dateien[0]);
      else fuegeHinzu(dateien);
    });
  }

  /* ================================================================
   *  Start
   * ================================================================ */

  function start() {
    fuelleSelect($('name'), AZUBIS);
    fuelleSelect($('abteilung'), ABTEILUNGEN);
    verbindeAuswahl('name', 'nameSonstige', 'name');
    verbindeAuswahl('abteilung', 'abteilungSonstige', 'abteilung');
    $('jahr').addEventListener('change', () => { z.kopf.jahr = $('jahr').value; markiereGeaendert(); });
    $('beginn').addEventListener('change', () => {
      z.kopf.beginn = K.parseIsoDatum($('beginn').value) ? $('beginn').value : '';
      z.kopf.nachweisNrManuell = false;
      B.aktualisiereNachweisNr(z);
      markiereGeaendert();
      zeichneNachweisNr();
    });
    $('nachweisNr').addEventListener('input', () => {
      const feld = $('nachweisNr');
      feld.value = feld.value.replace(/\D/g, '');
      z.kopf.nachweisNr = feld.value;
      z.kopf.nachweisNrManuell = !!z.kopf.beginn;
      markiereGeaendert();
    });
    $('nachweisNr').addEventListener('blur', zeichneNachweisNr);

    document.querySelectorAll('input[name="modus"]').forEach((r) => {
      r.addEventListener('change', () => wechsleModus(r.value));
    });

    baueTagesKarten();
    baueWochenleiste();
    verbindeBlock('textBetrieb', 'betrieb');
    verbindeBlock('textUnterweisung', 'unterweisung');
    verbindeBlock('textSchule', 'schule');

    $('abwNeu').addEventListener('click', () => {
      z.abwesenheiten.push({ art: 'Urlaub', von: '', bis: '' });
      markiereGeaendert();
      zeichneAbwesenheiten();
      const selects = $('abwListe').querySelectorAll('select');
      selects[selects.length - 1].focus();
    });

    $('kwZurueck').addEventListener('click', () => wechsleWoche(K.addTage(z.montag, -7)));
    $('kwVor').addEventListener('click', () => wechsleWoche(K.addTage(z.montag, 7)));
    $('kwHeute').addEventListener('click', () => wechsleWoche(K.montagDerWoche(new Date())));

    $('exportEntwurf').addEventListener('click', () => exportiere('entwurf'));
    $('exportFertig').addEventListener('click', () => exportiere('fertig'));
    document.querySelectorAll('[data-kopieren]').forEach((b) => b.addEventListener('click', () => kopiere(b)));

    $('uploadKnopf').addEventListener('click', () => $('uploadDatei').click());
    $('uploadDatei').addEventListener('change', () => {
      const datei = $('uploadDatei').files[0];
      $('uploadDatei').value = '';
      ladeBericht(datei);
    });

    $('tabBericht').addEventListener('click', () => zeigeTab('bericht'));
    $('tabGesamt').addEventListener('click', () => zeigeTab('gesamt'));
    $('sammelKnopf').addEventListener('click', () => $('sammelDatei').click());
    $('sammelDatei').addEventListener('change', () => {
      const dateien = Array.from($('sammelDatei').files);
      $('sammelDatei').value = '';
      fuegeHinzu(dateien);
    });
    $('sammelLeeren').addEventListener('click', () => { sammlung = []; auswahl = {}; zeichneSammlung(); });
    $('gesamtErstellen').addEventListener('click', erstelleGesamt);
    verbindeDragDrop();

    ['input', 'change', 'click'].forEach((t) => document.addEventListener(t, entferneMarkierung, true));
    window.addEventListener('resize', () => document.querySelectorAll('textarea.wachsend').forEach(wachse));
    window.addEventListener('beforeunload', (e) => {
      if (!geaendert) return;
      e.preventDefault();
      e.returnValue = '';
    });

    zeichneAlles();
    ladeLogo();
  }

  start();
})();
