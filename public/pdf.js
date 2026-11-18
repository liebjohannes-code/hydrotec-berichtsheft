/*
 * PDF-Erzeugung (jsPDF + jspdf-autotable), Einbetten/Auslesen der Formulardaten (pdf-lib)
 * und Zusammenführen zum Gesamt-Berichtsheft. Die Bibliotheken werden als Parameter
 * übergeben, damit das Modul im Browser und in Node (Tests) gleich funktioniert.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./kalender.js'), require('./zeit.js'), require('./bericht.js'));
  } else {
    root.BerichtPdf = factory(root.Kalender, root.Zeit, root.Bericht);
  }
})(typeof window !== 'undefined' ? window : this, function (K, Z, B) {
  'use strict';

  var ANHANG_NAME = 'berichtsheft.json';
  var INFO_SCHLUESSEL = 'HydrotecBerichtsheft';
  var FARBE = {
    grau: [127, 127, 127], dunkel: [74, 74, 74], mint: [77, 229, 178], mintHell: [230, 251, 244],
    blau: [0, 115, 191], blauHell: [229, 241, 250], linie: [210, 214, 218]
  };
  var RAND = 15;
  var UNTEN = 22;

  /* ---------- Text für die Standardschrift (WinAnsi) aufbereiten ---------- */

  var WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  var ERSATZ = { 'ı': 'i', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ħ': 'h', '\t': '    ', '−': '-', '✓': 'x' };

  function darstellbar(ch) {
    var c = ch.charCodeAt(0);
    return ch === '\n' || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.indexOf(ch) >= 0;
  }

  // Zeichen, die die PDF-Standardschrift nicht kennt (z. B. ş, ğ), werden angenähert.
  function pdfText(s) {
    var aus = '';
    for (var ch of String(s == null ? '' : s).replace(/\r\n?/g, '\n').normalize('NFC')) {
      if (darstellbar(ch)) { aus += ch; continue; }
      if (ERSATZ[ch]) { aus += ERSATZ[ch]; continue; }
      var basis = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      aus += basis && basis.split('').every(darstellbar) ? basis : (ch.length > 1 ? '' : '?');
    }
    return aus;
  }

  function oder(s, ersatz) {
    s = String(s == null ? '' : s).trim();
    return s ? s : ersatz;
  }

  /* ---------- Bausteine ---------- */

  function neuesDokument(jsPDF) {
    return new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  }

  function zeichneKopf(doc, titel, logo) {
    var b = doc.internal.pageSize.getWidth();
    if (logo) {
      var h = 10;
      doc.addImage(logo.url, 'JPEG', RAND, 12, h * logo.verhaeltnis, h);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor.apply(doc, FARBE.grau);
    doc.text(pdfText(titel), b - RAND, 20, { align: 'right' });
    doc.setDrawColor.apply(doc, FARBE.mint);
    doc.setLineWidth(0.8);
    doc.line(RAND, 27, b - RAND, 27);
    return 31;
  }

  function kopfTabelle(doc, autoTable, y, zeilen) {
    autoTable(doc, {
      startY: y,
      margin: { left: RAND, right: RAND },
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 10, textColor: FARBE.dunkel, cellPadding: { top: 1.1, bottom: 1.1, left: 0, right: 2 } },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: FARBE.grau, cellWidth: 37 },
        1: zeilen[0].length > 2 ? { cellWidth: 55 } : {},
        2: { fontStyle: 'bold', textColor: FARBE.grau, cellWidth: 37 },
        3: {}
      },
      body: zeilen.map(function (r) { return r.map(pdfText); })
    });
    return doc.lastAutoTable.finalY;
  }

  // Fließtext mit automatischem Seitenumbruch; liefert die neue y-Position.
  function absatz(doc, y, text, opts) {
    opts = opts || {};
    var breite = doc.internal.pageSize.getWidth() - 2 * RAND;
    var hoehe = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', opts.fett ? 'bold' : 'normal');
    doc.setFontSize(opts.groesse || 9.5);
    doc.setTextColor.apply(doc, opts.farbe || FARBE.dunkel);
    var zeilenHoehe = (opts.groesse || 9.5) * 0.45;
    doc.splitTextToSize(pdfText(text), breite).forEach(function (zeile) {
      if (y + zeilenHoehe > hoehe - UNTEN) { doc.addPage(); y = 20; }
      doc.text(zeile, RAND, y);
      y += zeilenHoehe;
    });
    return y;
  }

  function unterschriften(doc, y) {
    var b = doc.internal.pageSize.getWidth();
    var h = doc.internal.pageSize.getHeight();
    if (y + 10 > h - UNTEN) { doc.addPage(); y = 40; }
    var breite = (b - 2 * RAND - 20) / 2;
    doc.setDrawColor.apply(doc, FARBE.grau);
    doc.setLineWidth(0.3);
    doc.line(RAND, y, RAND + breite, y);
    doc.line(b - RAND - breite, y, b - RAND, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, FARBE.grau);
    doc.text('Datum, Unterschrift Auszubildende/r', RAND, y + 5);
    doc.text('Datum, Unterschrift Ausbilder/in', b - RAND - breite, y + 5);
  }

  function fusszeilen(doc, links, praefix) {
    var b = doc.internal.pageSize.getWidth();
    var h = doc.internal.pageSize.getHeight();
    var n = doc.getNumberOfPages();
    for (var s = 1; s <= n; s++) {
      doc.setPage(s);
      doc.setDrawColor.apply(doc, FARBE.mint);
      doc.setLineWidth(0.5);
      doc.line(RAND, h - 15, b - RAND, h - 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, FARBE.grau);
      doc.text(pdfText(links), RAND, h - 10);
      doc.text((praefix || '') + 'Seite ' + s + ' von ' + n, b - RAND, h - 10, { align: 'right' });
    }
  }

  // Diagonaler, hellgrauer „ENTWURF“-Stempel auf jeder Seite.
  function entwurfsStempel(doc) {
    var b = doc.internal.pageSize.getWidth();
    var h = doc.internal.pageSize.getHeight();
    var winkel = 55;
    var rad = winkel * Math.PI / 180;
    for (var s = 1; s <= doc.getNumberOfPages(); s++) {
      doc.setPage(s);
      doc.saveGraphicsState();
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.35 }));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(96);
      doc.setTextColor(170, 170, 170);
      var w = doc.getTextWidth('ENTWURF');
      var capHalbe = 96 * 0.3528 * 0.36;
      var x = b / 2 - (w / 2) * Math.cos(rad) + capHalbe * Math.sin(rad);
      var y = h / 2 + (w / 2) * Math.sin(rad) + capHalbe * Math.cos(rad);
      doc.text('ENTWURF', x, y, { angle: winkel });
      doc.restoreGraphicsState();
    }
  }

  /* ---------- Bericht ---------- */

  function artText(z, i, info) {
    var tag = z.tage[i];
    if (!tag.art) return '—';
    var t = tag.art;
    if (tag.art === 'Feiertag' && info.feiertag) t += '\n(' + info.feiertag + ')';
    else if (info.ferien && tag.art === 'Betrieb') t += '\n(Ferien)';
    return t;
  }

  function zeitText(tag) {
    if (!B.istArbeitsart(tag.art)) return tag.art ? '0:00' : '—';
    var r = Z.parseZeit(tag.zeit);
    return r.minuten != null ? Z.formatZeit(r.minuten) : oder(tag.zeit, '—');
  }

  // Erzeugt das jsPDF-Dokument für einen Tages- oder Wochenbericht.
  // opts: { jsPDF, autoTable, logo?, entwurf? }
  function erzeugeBerichtPdf(z, opts) {
    var doc = neuesDokument(opts.jsPDF);
    var autoTable = opts.autoTable;
    var kw = B.kwInfo(z.montag);
    var infos = B.infosDerWoche(z);
    var s = B.summen(z);
    var beginn = K.parseIsoDatum(z.kopf.beginn);
    var nr = String(z.kopf.nachweisNr || '').trim();

    doc.setProperties({ title: 'Ausbildungsnachweis ' + kw.kurz, creator: 'HYDROTEC Berichtsheft-Generator' });

    var y = zeichneKopf(doc, 'Ausbildungsnachweis' + (nr ? ' Nr. ' + nr : ''), opts.logo);
    y = kopfTabelle(doc, autoTable, y, [
      ['Name:', oder(z.kopf.name, '—'), 'Kalenderwoche:', kw.titel],
      ['Abteilung:', oder(z.kopf.abteilung, '—'), 'Zeitraum:', kw.zeitraum],
      ['Ausbildungsjahr:', z.kopf.jahr ? z.kopf.jahr + '. Ausbildungsjahr' : '—', 'Ausbildungsbeginn:', beginn ? K.formatDatum(beginn) : '—'],
      ['Nachweis-Nr.:', oder(nr, '—'), 'Berichtsart:', B.MODI[z.modus]]
    ]);

    var tabelle = {
      margin: { left: RAND, right: RAND, top: 20, bottom: UNTEN },
      theme: 'grid',
      showHead: 'everyPage',
      rowPageBreak: 'auto',
      styles: {
        font: 'helvetica', fontSize: 10, textColor: FARBE.dunkel,
        lineColor: FARBE.linie, lineWidth: 0.2, cellPadding: 2.5, valign: 'top', overflow: 'linebreak'
      },
      headStyles: { fillColor: FARBE.blau, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: FARBE.mintHell, textColor: FARBE.dunkel, fontStyle: 'bold' }
    };

    if (z.modus === 'tag') {
      autoTable(doc, Object.assign({}, tabelle, {
        startY: y + 5,
        head: [['Tag', 'Art', 'Tätigkeiten / Themen', 'Zeit']],
        body: z.tage.map(function (tag, i) {
          return [
            B.WOCHENTAGE[i] + '\n' + K.formatDatum(B.datumVonTag(z, i)),
            artText(z, i, infos[i]),
            B.istArbeitsart(tag.art) ? tag.text.trim() : '–',
            zeitText(tag)
          ].map(pdfText);
        }),
        foot: [['', '', 'Woche gesamt', Z.formatZeit(s.gesamt)]],
        showFoot: 'lastPage',
        bodyStyles: { minCellHeight: 18 },
        columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 1: { cellWidth: 30 }, 3: { cellWidth: 18, halign: 'right' } },
        didParseCell: function (d) {
          if ((d.section === 'foot' && d.column.index === 2) || (d.section === 'head' && d.column.index === 3)) {
            d.cell.styles.halign = 'right';
          }
        }
      }));
      y = doc.lastAutoTable.finalY + 6;
    } else {
      autoTable(doc, Object.assign({}, tabelle, {
        startY: y + 5,
        head: [['Tag', 'Datum', 'Art', 'Zeit']],
        body: z.tage.map(function (tag, i) {
          return [B.WOCHENTAGE[i], K.formatDatum(B.datumVonTag(z, i)), artText(z, i, infos[i]).replace('\n', ' '), zeitText(tag)].map(pdfText);
        }),
        styles: Object.assign({}, tabelle.styles, { cellPadding: 1.8 }),
        columnStyles: { 0: { cellWidth: 32, fontStyle: 'bold' }, 1: { cellWidth: 28 }, 3: { cellWidth: 20, halign: 'right' } },
        didParseCell: function (d) {
          if (d.section === 'head' && d.column.index === 3) d.cell.styles.halign = 'right';
        }
      }));
      y = doc.lastAutoTable.finalY + 6;
    }

    var info = B.zusammenfassung(z);
    if (info) y = absatz(doc, y, 'Abwesenheiten / Feiertage / Ferien: ' + info, { farbe: FARBE.grau }) + 3;

    if (z.modus === 'woche') {
      var bloecke = [
        { titel: 'Betriebliche Tätigkeiten (' + Z.formatZeit(s.betrieb) + ' Std.)', text: z.texte.betrieb },
        { titel: 'Unterweisungen / Schulungen', text: z.texte.unterweisung }
      ];
      if (B.schuleMoeglich(z)) {
        bloecke.push({ titel: 'Berufsschule – Themen / Fächer (' + Z.formatZeit(s.schule) + ' Std.)', text: z.texte.schule });
      }
      bloecke.forEach(function (blk) {
        autoTable(doc, Object.assign({}, tabelle, {
          startY: y + 1,
          head: [[pdfText(blk.titel)]],
          body: [[pdfText(oder(blk.text, '—'))]],
          headStyles: { fillColor: FARBE.blauHell, textColor: FARBE.blau, fontStyle: 'bold' },
          bodyStyles: { minCellHeight: 14 }
        }));
        y = doc.lastAutoTable.finalY + 4;
      });

      autoTable(doc, Object.assign({}, tabelle, {
        startY: y + 1,
        theme: 'plain',
        tableWidth: 80,
        styles: Object.assign({}, tabelle.styles, { cellPadding: 1.2 }),
        body: [
          ['Betrieb', Z.formatZeit(s.betrieb) + ' Std.'],
          ['Berufsschule', Z.formatZeit(s.schule) + ' Std.'],
          ['Woche gesamt', Z.formatZeit(s.gesamt) + ' Std.']
        ],
        columnStyles: { 0: { cellWidth: 45, textColor: FARBE.grau }, 1: { halign: 'right' } },
        didParseCell: function (d) {
          if (d.row.index === 2) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = FARBE.mintHell; }
        }
      }));
      y = doc.lastAutoTable.finalY + 4;
    }

    unterschriften(doc, y + 18);
    fusszeilen(doc, 'HYDROTEC Technologies AG');
    if (opts.entwurf) entwurfsStempel(doc);
    return doc;
  }

  /* ---------- Formulardaten ins PDF einbetten / auslesen ---------- */

  function zuBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function ausBase64(s) {
    var bin = atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Bettet die Daten doppelt ein: als Dateianhang „berichtsheft.json“ und als
  // Base64-Eintrag im Dokument-Info-Verzeichnis (Rückfallebene).
  async function bettenEin(pdfBytes, payload, PDFLib) {
    var pdf = await PDFLib.PDFDocument.load(pdfBytes);
    var json = new TextEncoder().encode(JSON.stringify(payload));
    var datum = new Date(payload.exportiertAm || Date.now());
    await pdf.attach(json, ANHANG_NAME, {
      mimeType: 'application/json',
      description: 'Formulardaten des Berichtsheft-Generators (Schema ' + payload.schema + ' v' + payload.version + ')',
      creationDate: datum,
      modificationDate: datum
    });
    pdf.getInfoDict().set(PDFLib.PDFName.of(INFO_SCHLUESSEL), PDFLib.PDFString.of(zuBase64(json)));
    pdf.setCreator('HYDROTEC Berichtsheft-Generator');
    pdf.setProducer('HYDROTEC Berichtsheft-Generator');
    var name = payload.daten && payload.daten.kopf && payload.daten.kopf.name;
    if (name) pdf.setAuthor(name);
    pdf.setCreationDate(datum);
    pdf.setModificationDate(datum);
    return pdf.save();
  }

  function anhangLesen(pdf, PDFLib) {
    var N = PDFLib.PDFName;
    var names = pdf.catalog.lookupMaybe(N.of('Names'), PDFLib.PDFDict);
    var ef = names && names.lookupMaybe(N.of('EmbeddedFiles'), PDFLib.PDFDict);
    if (!ef) return null;
    var knoten = [ef];
    while (knoten.length) {
      var k = knoten.shift();
      var kids = k.lookupMaybe(N.of('Kids'), PDFLib.PDFArray);
      if (kids) for (var j = 0; j < kids.size(); j++) knoten.push(kids.lookup(j, PDFLib.PDFDict));
      var arr = k.lookupMaybe(N.of('Names'), PDFLib.PDFArray);
      if (!arr) continue;
      for (var i = 0; i + 1 < arr.size(); i += 2) {
        if (arr.lookup(i).decodeText() !== ANHANG_NAME) continue;
        var spec = arr.lookup(i + 1, PDFLib.PDFDict);
        var stream = spec.lookup(N.of('EF'), PDFLib.PDFDict).lookup(N.of('F'));
        var bytes = stream instanceof PDFLib.PDFRawStream ? PDFLib.decodePDFRawStream(stream).decode() : stream.getContents();
        return new TextDecoder().decode(bytes);
      }
    }
    return null;
  }

  function infoLesen(pdf, PDFLib) {
    var wert = pdf.getInfoDict().lookup(PDFLib.PDFName.of(INFO_SCHLUESSEL));
    if (!wert || !wert.decodeText) return null;
    return new TextDecoder().decode(ausBase64(wert.decodeText()));
  }

  // Liefert das eingebettete JSON-Objekt oder null (kein PDF / nicht vom Generator).
  async function leseEingebettet(bytes, PDFLib) {
    var pdf;
    try {
      pdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    } catch (e) {
      return null;
    }
    var leser = [anhangLesen, infoLesen];
    for (var i = 0; i < leser.length; i++) {
      try {
        var text = leser[i](pdf, PDFLib);
        if (!text) continue;
        var obj = JSON.parse(text);
        if (obj && obj.schema === B.SCHEMA) return obj;
      } catch (e) { /* nächste Quelle versuchen */ }
    }
    return null;
  }

  /* ---------- Gesamt-Berichtsheft ---------- */

  // opts: { jsPDF, autoTable, PDFLib, logo?, bytesVon: function(id) → Uint8Array }
  async function erzeugeGesamtPdf(analyse, opts) {
    var g = analyse.gewaehlt;
    var doc = neuesDokument(opts.jsPDF);
    var autoTable = opts.autoTable;
    var erste = g[0].zustand.montag;
    var letzte = g[g.length - 1].zustand.montag;
    var a = B.kwInfo(erste);
    var b = B.kwInfo(letzte);
    var beginn = K.parseIsoDatum(analyse.beginn);

    var y = zeichneKopf(doc, 'Ausbildungsnachweise', opts.logo);
    y = kopfTabelle(doc, autoTable, y + 2, [
      ['Name:', oder(analyse.namen.join(', '), '—'), '', ''],
      ['Ausbildungsbeginn:', beginn ? K.formatDatum(beginn) : '—', '', ''],
      ['Zeitraum:', a.kurz + ' (' + K.formatDatum(erste) + ') bis ' + b.kurz + ' (' + K.formatDatum(K.addTage(letzte, 4)) + ')', '', ''],
      ['Anzahl Nachweise:', String(g.length), '', '']
    ].map(function (r) { return [r[0], r[1]]; }));
    y = absatz(doc, y + 5, 'Fehlende Wochen:', { fett: true, groesse: 10, farbe: FARBE.grau });
    y = absatz(doc, y + 0.5, analyse.fehlend.length ? analyse.fehlendText : 'keine', { groesse: 10 });

    autoTable(doc, {
      startY: y + 5,
      margin: { left: RAND, right: RAND, top: 20, bottom: UNTEN },
      theme: 'grid',
      head: [['Nr.', 'KW', 'Zeitraum', 'Abteilung', 'Art']],
      body: g.map(function (e) {
        var k = B.kwInfo(e.zustand.montag);
        return [
          oder(e.zustand.kopf.nachweisNr, '—'), k.kurz, k.zeitraum, oder(e.zustand.kopf.abteilung, '—'),
          B.MODI[e.zustand.modus] + (e.status === 'entwurf' ? ' (Entwurf)' : '')
        ].map(pdfText);
      }),
      styles: { font: 'helvetica', fontSize: 9, textColor: FARBE.dunkel, lineColor: FARBE.linie, lineWidth: 0.2, cellPadding: 1.8 },
      headStyles: { fillColor: FARBE.blau, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 14, halign: 'right' }, 1: { cellWidth: 24 }, 2: { cellWidth: 46 } }
    });
    fusszeilen(doc, 'HYDROTEC Technologies AG · Gesamt-Berichtsheft', 'Übersicht – ');

    var PDFLib = opts.PDFLib;
    var gesamt = await PDFLib.PDFDocument.create();
    var deckblatt = await PDFLib.PDFDocument.load(doc.output('arraybuffer'));
    (await gesamt.copyPages(deckblatt, deckblatt.getPageIndices())).forEach(function (p) { gesamt.addPage(p); });
    for (var i = 0; i < g.length; i++) {
      var quelle = await PDFLib.PDFDocument.load(opts.bytesVon(g[i].id), { ignoreEncryption: true });
      (await gesamt.copyPages(quelle, quelle.getPageIndices())).forEach(function (p) { gesamt.addPage(p); });
    }
    gesamt.setTitle('Ausbildungsnachweise ' + a.kurz + ' bis ' + b.kurz);
    gesamt.setCreator('HYDROTEC Berichtsheft-Generator');
    gesamt.setProducer('HYDROTEC Berichtsheft-Generator');
    if (analyse.namen[0]) gesamt.setAuthor(analyse.namen[0]);
    return gesamt.save();
  }

  return {
    ANHANG_NAME: ANHANG_NAME,
    pdfText: pdfText,
    erzeugeBerichtPdf: erzeugeBerichtPdf,
    bettenEin: bettenEin,
    leseEingebettet: leseEingebettet,
    erzeugeGesamtPdf: erzeugeGesamtPdf
  };
});
