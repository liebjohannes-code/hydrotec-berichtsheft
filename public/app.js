/*
 * Berichtsheft-Generator – HYDROTEC Technologies AG
 * Es wird nichts gespeichert: alle Eingaben leben nur im Browser-Tab.
 */

/* =====================================================================
 *  LISTEN ZUM PFLEGEN
 *  Einfach Namen/Abteilungen hinzufügen, entfernen oder umbenennen.
 *  „Sonstige“ (Freitext) wird automatisch als letzter Eintrag ergänzt.
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
  const SONSTIGE = '__sonstige__';
  const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];
  const TYPEN = ['Betrieb', 'Berufsschule', 'Urlaub', 'Krank', 'Feiertag'];
  const STANDARD_STUNDEN = { Betrieb: 8, Berufsschule: 6, Urlaub: 0, Krank: 0, Feiertag: 0 };
  const TEXT_INFO = {
    Betrieb: { label: 'Tätigkeiten', placeholder: 'Welche Tätigkeiten hast du heute im Betrieb erledigt?' },
    Berufsschule: { label: 'Themen / Fächer', placeholder: 'Welche Fächer und Themen wurden behandelt?' }
  };
  const FARBE = { grau: [127, 127, 127], dunkel: [74, 74, 74], mint: [77, 229, 178], mintHell: [230, 251, 244], blau: [0, 115, 191] };

  const $ = (id) => document.getElementById(id);

  const zustand = {
    montag: K.montagDerWoche(new Date()),
    tage: WOCHENTAGE.map(() => ({ typ: 'Betrieb', text: '', stunden: 8, feiertag: null })),
    geaendert: false
  };

  /* ---------- Hilfsfunktionen ---------- */

  function istArbeitstag(typ) {
    return typ === 'Betrieb' || typ === 'Berufsschule';
  }

  function formatStunden(n) {
    return String(Math.round(n * 100) / 100).replace('.', ',');
  }

  function parseStunden(wert) {
    const n = parseFloat(String(wert).replace(',', '.'));
    if (!isFinite(n) || n < 0) return 0;
    return Math.min(24, Math.round(n * 2) / 2);
  }

  function datumVonTag(i) {
    return K.addTage(zustand.montag, i);
  }

  function kwInfo() {
    const kw = K.isoWoche(zustand.montag);
    const mo = datumVonTag(0);
    const fr = datumVonTag(4);
    const kurz = mo.getFullYear() === fr.getFullYear()
      ? K.zweistellig(mo.getDate()) + '.' + K.zweistellig(mo.getMonth() + 1) + '.–' + K.formatDatum(fr)
      : K.formatDatum(mo) + '–' + K.formatDatum(fr);
    return {
      woche: kw.woche,
      jahr: kw.jahr,
      zeitraum: K.formatDatum(mo) + ' – ' + K.formatDatum(fr),
      zeitraumKurz: kurz
    };
  }

  function wochensumme() {
    return zustand.tage.reduce((s, t) => s + (istArbeitstag(t.typ) ? t.stunden : 0), 0);
  }

  function auswahlWert(selectId, freitextId) {
    const sel = $(selectId);
    if (sel.value === SONSTIGE) return $(freitextId).value.trim();
    return sel.value;
  }

  // Für Dateinamen: Umlaute ersetzen, Leerzeichen → Bindestrich, Sonderzeichen entfernen.
  function dateinamenTeil(s) {
    return s
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^A-Za-z0-9._-]/g, '')
      .replace(/-+/g, '-');
  }

  function markiereGeaendert() {
    zustand.geaendert = true;
    $('mailBox').hidden = true;
    if (!document.querySelector('.ungueltig')) $('fehlermeldung').hidden = true;
  }

  /* ---------- Kopfdaten ---------- */

  function fuelleSelect(sel, eintraege, platzhalter) {
    sel.add(new Option(platzhalter, ''));
    eintraege.forEach((e) => sel.add(new Option(e, e)));
    sel.add(new Option('Sonstige …', SONSTIGE));
  }

  function verbindeSonstige(selectId, freitextId) {
    const sel = $(selectId);
    const frei = $(freitextId);
    sel.addEventListener('change', () => {
      frei.hidden = sel.value !== SONSTIGE;
      if (!frei.hidden) frei.focus();
      sel.classList.remove('ungueltig');
      frei.classList.remove('ungueltig');
      markiereGeaendert();
    });
    frei.addEventListener('input', () => {
      frei.classList.remove('ungueltig');
      markiereGeaendert();
    });
  }

  /* ---------- Tage ---------- */

  const karten = [];

  function baueTage() {
    const vorlage = $('tagVorlage');
    const container = $('tage');
    WOCHENTAGE.forEach((name, i) => {
      const knoten = vorlage.content.firstElementChild.cloneNode(true);
      knoten.querySelector('.tag-name').textContent = name;

      const segmente = knoten.querySelector('.segmente');
      segmente.setAttribute('aria-label', 'Art des Tages – ' + name);
      TYPEN.forEach((typ) => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'typ-' + i;
        radio.value = typ;
        radio.addEventListener('change', () => setzeTyp(i, typ));
        label.append(radio, document.createTextNode(typ));
        segmente.append(label);
      });

      const text = knoten.querySelector('textarea');
      text.id = 'text-' + i;
      knoten.querySelector('.text-label').htmlFor = text.id;
      text.addEventListener('input', () => {
        zustand.tage[i].text = text.value;
        text.classList.remove('ungueltig');
        markiereGeaendert();
      });

      const std = knoten.querySelector('input[type="number"]');
      std.id = 'std-' + i;
      knoten.querySelector('.std-label').htmlFor = std.id;
      std.addEventListener('input', () => {
        zustand.tage[i].stunden = parseStunden(std.value);
        aktualisiereSumme();
        markiereGeaendert();
      });
      std.addEventListener('change', () => {
        std.value = zustand.tage[i].stunden;
      });

      container.append(knoten);
      karten.push({ knoten, text, std, segmente });
    });
  }

  function setzeTyp(i, typ) {
    const tag = zustand.tage[i];
    if (tag.typ === typ) return;
    tag.typ = typ;
    tag.stunden = STANDARD_STUNDEN[typ];
    markiereGeaendert();
    zeichneTag(i);
    aktualisiereSumme();
  }

  function zeichneTag(i) {
    const tag = zustand.tage[i];
    const k = karten[i];
    const aktiv = istArbeitstag(tag.typ);

    k.knoten.querySelector('.tag-datum').textContent = K.formatDatum(datumVonTag(i));
    const badge = k.knoten.querySelector('.feiertag-badge');
    badge.hidden = !tag.feiertag;
    badge.textContent = tag.feiertag ? 'Feiertag: ' + tag.feiertag : '';
    k.knoten.classList.toggle('ist-frei', !aktiv);

    k.segmente.querySelectorAll('label').forEach((label) => {
      const radio = label.querySelector('input');
      radio.checked = radio.value === tag.typ;
      label.classList.toggle('aktiv', radio.checked);
    });

    const info = TEXT_INFO[tag.typ];
    k.knoten.querySelector('.text-label').textContent = info ? info.label : 'Tätigkeiten / Themen';
    k.text.placeholder = info ? info.placeholder : '';
    k.text.disabled = !aktiv;
    k.text.value = aktiv ? tag.text : '';
    if (!aktiv) {
      k.text.classList.remove('ungueltig');
      if (!document.querySelector('.ungueltig')) $('fehlermeldung').hidden = true;
    }

    k.std.disabled = !aktiv;
    k.std.value = aktiv ? tag.stunden : 0;
  }

  function aktualisiereSumme() {
    $('wochensumme').textContent = formatStunden(wochensumme()) + ' Std.';
  }

  /* ---------- Kalenderwoche ---------- */

  // Feiertage für die aktuelle Woche neu bestimmen. Alle anderen Eingaben bleiben.
  function berechneFeiertage() {
    zustand.tage.forEach((tag, i) => {
      const name = K.feiertagName(datumVonTag(i));
      tag.feiertag = name;
      if (name) {
        tag.typ = 'Feiertag';
        tag.stunden = 0;
      } else if (tag.typ === 'Feiertag') {
        tag.typ = 'Betrieb';
        tag.stunden = STANDARD_STUNDEN.Betrieb;
      }
    });
  }

  function zeichneWoche() {
    const info = kwInfo();
    $('kwTitel').textContent = 'KW ' + info.woche + ' / ' + info.jahr;
    $('kwZeitraum').textContent = info.zeitraum;
    const heute = K.montagDerWoche(new Date());
    $('kwHeute').hidden = heute.getTime() === zustand.montag.getTime();
    zustand.tage.forEach((_, i) => zeichneTag(i));
    aktualisiereSumme();
  }

  function wechsleWoche(montag) {
    zustand.montag = montag;
    berechneFeiertage();
    $('mailBox').hidden = true;
    zeichneWoche();
  }

  /* ---------- Prüfung ---------- */

  function pruefe() {
    const fehler = [];
    const markiere = (el) => { el.classList.add('ungueltig'); fehler.push(el); };

    [['name', 'nameSonstige'], ['abteilung', 'abteilungSonstige']].forEach(([selId, freiId]) => {
      const sel = $(selId);
      if (!sel.value) markiere(sel);
      else if (sel.value === SONSTIGE && !$(freiId).value.trim()) markiere($(freiId));
    });
    if (!$('jahr').value) markiere($('jahr'));

    zustand.tage.forEach((tag, i) => {
      if (istArbeitstag(tag.typ) && !tag.text.trim()) markiere(karten[i].text);
    });

    const meldung = $('fehlermeldung');
    meldung.hidden = fehler.length === 0;
    if (fehler.length) {
      meldung.textContent = 'Bitte fülle die rot markierten Felder aus.';
      fehler[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      fehler[0].focus({ preventScroll: true });
    }
    return fehler.length === 0;
  }

  /* ---------- PDF ---------- */

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

  function erstellePdf(daten) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const seiteB = doc.internal.pageSize.getWidth();
    const seiteH = doc.internal.pageSize.getHeight();
    const rand = 15;
    const unten = 22;

    // Kopf: Logo + Titel
    if (logoDaten) {
      const h = 10;
      doc.addImage(logoDaten.url, 'JPEG', rand, 12, h * logoDaten.verhaeltnis, h);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...FARBE.grau);
    doc.text('Ausbildungsnachweis', seiteB - rand, 20, { align: 'right' });
    doc.setDrawColor(...FARBE.mint);
    doc.setLineWidth(0.8);
    doc.line(rand, 27, seiteB - rand, 27);

    // Kopfdaten
    window.autoTable(doc, {
      startY: 31,
      margin: { left: rand, right: rand },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 10, textColor: FARBE.dunkel, cellPadding: { top: 1.2, bottom: 1.2, left: 0, right: 2 } },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: FARBE.grau, cellWidth: 32 },
        1: { cellWidth: 63 },
        2: { fontStyle: 'bold', textColor: FARBE.grau, cellWidth: 30 },
        3: {}
      },
      body: [
        ['Name:', daten.name, 'Kalenderwoche:', 'KW ' + daten.kw.woche + ' / ' + daten.kw.jahr],
        ['Abteilung:', daten.abteilung, 'Zeitraum:', daten.kw.zeitraum],
        ['Ausbildungsjahr:', daten.jahr + '. Ausbildungsjahr', '', '']
      ]
    });

    // Wochentabelle
    const zeilen = zustand.tage.map((tag, i) => {
      const arbeit = istArbeitstag(tag.typ);
      let art = tag.typ;
      if (tag.typ === 'Feiertag' && tag.feiertag) art += '\n(' + tag.feiertag + ')';
      return [
        WOCHENTAGE[i] + '\n' + K.formatDatum(datumVonTag(i)),
        art,
        arbeit ? tag.text.trim() : '–',
        formatStunden(arbeit ? tag.stunden : 0)
      ];
    });

    window.autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      margin: { left: rand, right: rand, top: 20, bottom: unten },
      theme: 'grid',
      head: [['Tag', 'Art', 'Tätigkeiten / Themen', 'Stunden']],
      body: zeilen,
      foot: [['', '', 'Wochensumme', formatStunden(daten.summe)]],
      showFoot: 'lastPage',
      showHead: 'everyPage',
      rowPageBreak: 'auto',
      styles: {
        font: 'helvetica', fontSize: 10, textColor: FARBE.dunkel,
        lineColor: [210, 214, 218], lineWidth: 0.2, cellPadding: 2.5, valign: 'top', overflow: 'linebreak'
      },
      headStyles: { fillColor: FARBE.blau, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: FARBE.mintHell, textColor: FARBE.dunkel, fontStyle: 'bold' },
      bodyStyles: { minCellHeight: 20 },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: {},
        3: { cellWidth: 20, halign: 'right' }
      },
      didParseCell: (d) => {
        if (d.section === 'foot' && d.column.index === 2) d.cell.styles.halign = 'right';
        if (d.section === 'head' && d.column.index === 3) d.cell.styles.halign = 'right';
      }
    });

    // Unterschriften
    let y = doc.lastAutoTable.finalY + 24;
    if (y + 10 > seiteH - unten) {
      doc.addPage();
      y = 40;
    }
    const breite = (seiteB - 2 * rand - 20) / 2;
    doc.setDrawColor(...FARBE.grau);
    doc.setLineWidth(0.3);
    doc.line(rand, y, rand + breite, y);
    doc.line(seiteB - rand - breite, y, seiteB - rand, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...FARBE.grau);
    doc.text('Datum, Unterschrift Auszubildende/r', rand, y + 5);
    doc.text('Datum, Unterschrift Ausbilder/in', seiteB - rand - breite, y + 5);

    // Fußzeile auf jeder Seite
    const seiten = doc.getNumberOfPages();
    for (let s = 1; s <= seiten; s++) {
      doc.setPage(s);
      doc.setDrawColor(...FARBE.mint);
      doc.setLineWidth(0.5);
      doc.line(rand, seiteH - 15, seiteB - rand, seiteH - 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...FARBE.grau);
      doc.text('HYDROTEC Technologies AG', rand, seiteH - 10);
      doc.text('Seite ' + s + ' von ' + seiten, seiteB - rand, seiteH - 10, { align: 'right' });
    }

    return doc;
  }

  function sammleDaten() {
    const name = auswahlWert('name', 'nameSonstige').replace(/\s+/g, ' ');
    const teile = name.split(' ');
    return {
      name,
      nachname: teile[teile.length - 1],
      abteilung: auswahlWert('abteilung', 'abteilungSonstige').replace(/\s+/g, ' '),
      jahr: $('jahr').value,
      kw: kwInfo(),
      summe: wochensumme()
    };
  }

  function dateiname(d) {
    return 'Berichtsheft_' + dateinamenTeil(d.nachname) +
      '_KW' + K.zweistellig(d.kw.woche) + '_' + d.kw.jahr +
      '_' + dateinamenTeil(d.abteilung) + '.pdf';
  }

  function zeigeMail(d) {
    const kwText = 'KW ' + d.kw.woche + '/' + d.kw.jahr;
    $('mailBetreff').value = 'Berichtsheft – ' + d.name + ' – ' + kwText + ' – ' + d.abteilung;
    $('mailText').value =
      'Hallo,\n\n' +
      'anbei mein Ausbildungsnachweis für die ' + kwText + ' (' + d.kw.zeitraumKurz + ') aus der Abteilung ' + d.abteilung + '.\n\n' +
      'Viele Grüße\n' +
      d.name + '\n' +
      'Auszubildende/r im ' + d.jahr + '. Ausbildungsjahr\n' +
      'HYDROTEC Technologies AG';
    const box = $('mailBox');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportiere() {
    if (!pruefe()) return;
    if (!window.jspdf || !window.autoTable) {
      alert('Die PDF-Bibliothek konnte nicht geladen werden. Bitte die Seite neu laden.');
      return;
    }
    const daten = sammleDaten();
    const doc = erstellePdf(daten);
    doc.save(dateiname(daten));
    zustand.geaendert = false;
    zeigeMail(daten);
  }

  /* ---------- Kopieren ---------- */

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
    const alt = 'Kopieren';
    knopf.textContent = ok ? 'Kopiert ✓' : 'Bitte manuell kopieren';
    knopf.classList.toggle('kopiert', ok);
    clearTimeout(knopf._timer);
    knopf._timer = setTimeout(() => {
      knopf.textContent = alt;
      knopf.classList.remove('kopiert');
    }, 2000);
  }

  /* ---------- Start ---------- */

  function start() {
    fuelleSelect($('name'), AZUBIS, 'Bitte wählen');
    fuelleSelect($('abteilung'), ABTEILUNGEN, 'Bitte wählen');
    verbindeSonstige('name', 'nameSonstige');
    verbindeSonstige('abteilung', 'abteilungSonstige');
    $('jahr').addEventListener('change', () => {
      $('jahr').classList.remove('ungueltig');
      markiereGeaendert();
    });

    baueTage();
    berechneFeiertage();
    zeichneWoche();

    $('kwZurueck').addEventListener('click', () => wechsleWoche(K.addTage(zustand.montag, -7)));
    $('kwVor').addEventListener('click', () => wechsleWoche(K.addTage(zustand.montag, 7)));
    $('kwHeute').addEventListener('click', () => wechsleWoche(K.montagDerWoche(new Date())));

    $('pdfExport').addEventListener('click', exportiere);
    document.querySelectorAll('[data-kopieren]').forEach((b) => b.addEventListener('click', () => kopiere(b)));

    window.addEventListener('beforeunload', (e) => {
      if (!zustand.geaendert) return;
      e.preventDefault();
      e.returnValue = '';
    });

    ladeLogo();
  }

  start();
})();
