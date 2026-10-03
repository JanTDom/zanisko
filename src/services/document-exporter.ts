import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb, PDFFont, Color } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { demandLetterToHtml } from '../domain/demand-letter.js';
import { fixPolishTypography, fixPolishTypographyInHtml } from '../domain/typography.js';
import { AttachmentData } from '../domain/attachments.js';
import {
  exportDemandLetterToDocx,
  exportAttachmentToDocx,
  exportBundleToDocx,
} from './docx-generator.js';

export {
  exportDemandLetterToDocx,
  exportAttachmentToDocx,
  exportBundleToDocx,
};

/**
 * Eksportuje dokument do formatu Microsoft Word (.doc) z pełnym zachowaniem stylów,
 * marginesów A4, tabel, wcięć list oraz kodowania UTF-8 (z nagłówkiem BOM).
 */
export function exportToDoc(htmlBody: string, title = 'Dokument procesowy'): Buffer {
  const styledHtml = fixPolishTypographyInHtml(htmlBody);

  const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${escapeXml(title)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page {
  size: 21cm 29.7cm;
  margin: 2.5cm 2.5cm 2.5cm 2.5cm;
  mso-page-orientation: portrait;
}
body {
  font-family: 'Calibri', 'Times New Roman', Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.35;
  color: #111;
  orphans: 2;
  widows: 2;
}
h1, h2, h3 { font-family: 'Calibri', Arial, sans-serif; }
h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 18pt 0 4pt 0; text-transform: uppercase; }
h2 { font-size: 11.5pt; font-weight: bold; margin: 14pt 0 6pt 0; border-bottom: 1px solid #444; padding-bottom: 2pt; page-break-after: avoid; }
h3 { font-size: 11pt; font-weight: bold; margin: 10pt 0 3pt 0; page-break-after: avoid; }
h3.basis { font-size: 11pt; margin-top: 10pt; margin-bottom: 3pt; page-break-after: avoid; }
h3.num-item { font-size: 11pt; font-weight: bold; margin: 12pt 0 4pt 0; page-break-after: avoid; }
p { margin: 0 0 2pt 0; text-align: left; }
p.justify { text-align: justify; margin-bottom: 4pt; }
p.subtitle { text-align: center; font-weight: bold; margin: 0 0 2pt 0; }
p.date { text-align: right; margin-bottom: 14pt; page-break-after: avoid; }
p.party { font-weight: bold; font-size: 9.5pt; letter-spacing: 0.5pt; color: #333; margin-top: 4pt; page-break-after: avoid; }
p.li { margin: 2pt 0 2pt 20pt; mso-para-margin-left: 20pt; text-indent: -14pt; text-align: justify; }
p.sub-li { margin: 1.5pt 0 1.5pt 42pt; mso-para-margin-left: 42pt; text-indent: -14pt; text-align: justify; }
p.item-prop { margin: 2pt 0 2pt 24pt; mso-para-margin-left: 24pt; text-align: justify; }
p.num-li { margin: 2pt 0 2pt 24pt; mso-para-margin-left: 24pt; text-indent: -14pt; text-align: justify; }
p.amount { text-align: center; font-weight: bold; font-size: 14pt; margin: 8pt 0 2pt 0; }
p.center { text-align: center; }
p.small { font-size: 9.5pt; color: #444; }
p.sign { text-align: right; margin-top: 24pt; page-break-inside: avoid; }
p.sign.small { margin-top: 0; }
.blk { margin-bottom: 10pt; page-break-inside: auto; }
.page-break {
  page-break-before: always;
  break-before: page;
  clear: both;
}
table { width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 14pt; page-break-inside: auto; }
th, td { border: 1px solid #777; padding: 5pt 7pt; font-size: 9.5pt; text-align: left; }
th { background-color: #f1f5f9; font-weight: bold; }
.header-box { margin-bottom: 16pt; page-break-after: avoid; }
</style>
</head>
<body>
${styledHtml}
</body>
</html>`;

  // Prepend UTF-8 BOM aby Word bezbłędnie rozpoznał kodowanie znaków
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  const contentBuf = Buffer.from(docHtml, 'utf-8');
  return Buffer.concat([bom, contentBuf]);
}

/**
 * Eksportuje pakiet procesowy do Worda (.doc) z czystym podziałem na strony.
 */
export function exportBundleToDoc(
  letterText: string,
  attachments: AttachmentData[],
  title = 'Kompletny pakiet procesowy'
): Buffer {
  const letterHtml = demandLetterToHtml(letterText);
  const sep = '<br clear="all" style="page-break-before:always;" /><div class="page-break"></div>';

  let bundleHtml = `<div class="letter-section">${letterHtml}</div>`;
  for (const att of attachments) {
    bundleHtml += `${sep}<div class="attachment-section">${att.htmlContent}</div>`;
  }

  return exportToDoc(bundleHtml, title);
}

/**
 * Eksportuje dokument do formatu Rich Text Format (.rtf) kompatybilnego
 * ze wszystkimi edytorami tekstu (Word, LibreOffice, Pages, WordPad).
 */
export function exportToRtf(plainText: string): Buffer {
  const text = fixPolishTypography(plainText, false);
  let rtf = '{\\rtf1\\ansi\\ansicpg1250\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset238 Calibri;}{\\f1\\froman\\fcharset238 Times New Roman;}}\\f0\\fs22\\sa160\\sl280\\slmult1 ';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = text.charCodeAt(i);

    if (char === '\\') rtf += '\\\\';
    else if (char === '{') rtf += '\\{';
    else if (char === '}') rtf += '\\}';
    else if (char === '\n') rtf += '\\par\n';
    else if (code > 127) {
      const signed = code > 32767 ? code - 65536 : code;
      rtf += '\\u' + signed + '?';
    } else {
      rtf += char;
    }
  }

  rtf += '}';
  return Buffer.from(rtf, 'ascii');
}

/**
 * Eksportuje dokument do czystego tekstu UTF-8 (.txt).
 */
export function exportToTxt(plainText: string): Buffer {
  return Buffer.from(fixPolishTypography(plainText, false), 'utf-8');
}

/**
 * Generuje wielostronicowy, profesjonalny plik PDF z poprawną paginacją, marginesami,
 * wiszącymi wcięciami list, prawostronnym wyrównaniem daty i podpisów,
 * wyśrodkowaniem tytułów oraz załącznikami rozpoczynającymi się od stron nieparzystych.
 */
export async function exportToPdf(plainText: string, title = 'Dokument'): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Załaduj czcionki TrueType ze wsparciem polskich znaków
  let regularBytes: Buffer;
  const projectFontPath = path.resolve('assets/fonts/DocumentFont.ttf');
  const systemFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';

  if (fs.existsSync(projectFontPath)) {
    regularBytes = fs.readFileSync(projectFontPath);
  } else if (fs.existsSync(systemFontPath)) {
    regularBytes = fs.readFileSync(systemFontPath);
  } else {
    throw new Error('Brak czcionki TrueType do wygenerowania dokumentu PDF');
  }

  const regularFont = await pdfDoc.embedFont(regularBytes);

  let boldFont = regularFont;
  const boldFontPath = path.resolve('assets/fonts/DocumentFont-Bold.ttf');
  const systemBoldPath = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';

  if (fs.existsSync(boldFontPath)) {
    boldFont = await pdfDoc.embedFont(fs.readFileSync(boldFontPath));
  } else if (fs.existsSync(systemBoldPath)) {
    boldFont = await pdfDoc.embedFont(fs.readFileSync(systemBoldPath));
  }

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginLeft = 50;
  const marginRight = 50;
  const marginTop = 50;
  const marginBottom = 50;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;
  const blankParityPages = new Set<number>();

  function ensureSpace(needed: number): boolean {
    if (y - needed < marginBottom) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - marginTop;
      return true;
    }
    return false;
  }

  function startOddPage(): void {
    const count = pdfDoc.getPageCount();
    if (count % 2 === 1) {
      // Bieżąca strona jest nieparzysta, więc dodajemy pustą stronę parzystą
      blankParityPages.add(count + 1);
      pdfDoc.addPage([pageWidth, pageHeight]);
    }
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - marginTop;
  }

  function wrapWords(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if (!w) continue;
      const test = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawText(text: string, font: PDFFont, size: number, color: Color, x: number): void {
    currentPage.drawText(text, { x, y, size, font, color });
  }

  interface HangingParaOptions {
    font?: PDFFont;
    size?: number;
    color?: Color;
    prefix?: string;
    prefixFont?: PDFFont;
    prefixColor?: Color;
    label?: string;
    labelFont?: PDFFont;
    text?: string;
    startX?: number;
    textX?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    keepWithNext?: boolean;
  }

  function drawHangingParagraph(opts: HangingParaOptions): void {
    const {
      font = regularFont,
      size = 9.5,
      color = rgb(0.12, 0.12, 0.12),
      prefix = '',
      prefixFont = boldFont,
      prefixColor = rgb(0.12, 0.12, 0.12),
      label = '',
      labelFont = boldFont,
      text = '',
      startX = marginLeft,
      textX = marginLeft + 18,
      spaceBefore = 0,
      spaceAfter = 2,
      keepWithNext = false,
    } = opts;

    if (spaceBefore > 0) y -= spaceBefore;

    const availableWidthFirst = pageWidth - marginRight - textX - (label ? labelFont.widthOfTextAtSize(label + ' ', size) : 0);
    const availableWidthRest = pageWidth - marginRight - textX;

    let line1Text = '';
    let remainingText = '';

    if (label) {
      const words = text.split(' ');
      let cur = '';
      let splitIdx = 0;
      for (let i = 0; i < words.length; i++) {
        const test = cur ? cur + ' ' + words[i] : words[i];
        if (font.widthOfTextAtSize(test, size) <= availableWidthFirst) {
          cur = test;
          splitIdx = i + 1;
        } else {
          break;
        }
      }
      line1Text = cur;
      remainingText = words.slice(splitIdx).join(' ');
    } else {
      const allLines = wrapWords(text, font, size, availableWidthRest);
      line1Text = allLines[0] || '';
      remainingText = allLines.slice(1).join(' ');
    }

    const restLines = remainingText ? wrapWords(remainingText, font, size, availableWidthRest) : [];
    const totalLinesCount = 1 + restLines.length;
    const blockHeight = totalLinesCount * (size * 1.35) + spaceAfter;

    if (keepWithNext) {
      ensureSpace(blockHeight + 35);
    } else {
      ensureSpace(size * 1.35 * Math.min(2, totalLinesCount));
    }

    if (prefix) {
      drawText(prefix, prefixFont, size, prefixColor, startX);
    }
    if (label) {
      drawText(label, labelFont, size, prefixColor, textX);
      const labelW = labelFont.widthOfTextAtSize(label + ' ', size);
      if (line1Text) {
        drawText(line1Text, font, size, color, textX + labelW);
      }
    } else if (line1Text) {
      drawText(line1Text, font, size, color, textX);
    }
    y -= (size * 1.35);

    for (const rLine of restLines) {
      ensureSpace(size * 1.35);
      drawText(rLine, font, size, color, textX);
      y -= (size * 1.35);
    }

    if (spaceAfter > 0) y -= spaceAfter;
  }

  // Rozpoznawanie sekcji w pliku (rozdzielanych znakiem nowej strony \f lub separatorem załącznika)
  const sections = plainText
    .split(/\f|\n={30,}\n|(?:\n|^)\s*={10,}\s*\n(?=ZAŁĄCZNIK NR \d+)/i)
    .map(s => s.replace(/^\s*={10,}\s*\n/gm, '').replace(/\n\s*={10,}\s*$/gm, '').trim())
    .filter(Boolean);

  sections.forEach((secText, sIdx) => {
    if (sIdx > 0) {
      startOddPage();
    }
    const lines = secText.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        y -= 4;
        i++;
        continue;
      }

      // 1. Data i miejscowość (wyrównana do prawej krawędzi)
      if (/^[A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż\s]+,\s+dnia\s+\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}$/.test(trimmed)) {
        const t = fixPolishTypography(trimmed, false);
        const tw = regularFont.widthOfTextAtSize(t, 9.5);
        ensureSpace(20);
        drawText(t, regularFont, 9.5, rgb(0.2, 0.2, 0.2), pageWidth - marginRight - tw);
        y -= 20;
        i++;
        continue;
      }

      // 2. Nagłówki stron (Wzywający / Adresat)
      if (/^(WZYWAJĄCY \(POSZKODOWANY\)|ADRESAT \(UBEZPIECZYCIEL\)):$/i.test(trimmed)) {
        ensureSpace(35);
        drawText(fixPolishTypography(trimmed, false), boldFont, 9.5, rgb(0.12, 0.12, 0.12), marginLeft);
        y -= 13;
        i++;
        while (i < lines.length && lines[i].trim() && !/^(WZYWAJĄCY|ADRESAT|PRZEDSĄDOWE|Dotyczy|I\.)/i.test(lines[i].trim())) {
          drawText(fixPolishTypography(lines[i].trim(), false), regularFont, 9.5, rgb(0.15, 0.15, 0.15), marginLeft);
          y -= 13;
          i++;
        }
        y -= 6;
        continue;
      }

      // 3. Główny tytuł pisma (wyśrodkowany)
      if (/^PRZEDSĄDOWE WEZWANIE DO ZAPŁATY$/i.test(trimmed)) {
        ensureSpace(50);
        y -= 8;
        const t1 = fixPolishTypography(trimmed, false);
        const w1 = boldFont.widthOfTextAtSize(t1, 13);
        drawText(t1, boldFont, 13, rgb(0.08, 0.08, 0.08), marginLeft + (contentWidth - w1) / 2);
        y -= 18;
        i++;
        if (i < lines.length && /^FORMALNA REKLAMACJA$/i.test(lines[i].trim())) {
          const t2 = fixPolishTypography(lines[i].trim(), false);
          const w2 = boldFont.widthOfTextAtSize(t2, 10.5);
          drawText(t2, boldFont, 10.5, rgb(0.15, 0.15, 0.15), marginLeft + (contentWidth - w2) / 2);
          y -= 15;
          i++;
        }
        if (i < lines.length && /^\(złożona w trybie/i.test(lines[i].trim())) {
          const t3 = fixPolishTypography(lines[i].trim(), false);
          const w3 = regularFont.widthOfTextAtSize(t3, 8.5);
          drawText(t3, regularFont, 8.5, rgb(0.4, 0.4, 0.4), marginLeft + (contentWidth - w3) / 2);
          y -= 16;
          i++;
        }
        continue;
      }

      // 4. Nagłówek Załącznika (wyśrodkowany z subtelną linią podziału)
      if (/^ZAŁĄCZNIK NR \d+/i.test(trimmed)) {
        ensureSpace(60);
        y -= 6;
        const t1 = fixPolishTypography(trimmed, false);
        const w1 = boldFont.widthOfTextAtSize(t1, 12);
        drawText(t1, boldFont, 12, rgb(0.08, 0.08, 0.08), marginLeft + (contentWidth - w1) / 2);
        y -= 16;
        i++;
        if (i < lines.length && lines[i].trim() && !/^(METRYKA|ROZLICZENIE|WYKAZ|I\.|1\.)/i.test(lines[i].trim())) {
          const t2 = fixPolishTypography(lines[i].trim(), false);
          const w2 = boldFont.widthOfTextAtSize(t2, 10);
          drawText(t2, boldFont, 10, rgb(0.2, 0.2, 0.2), marginLeft + (contentWidth - w2) / 2);
          y -= 14;
          i++;
        }
        if (i < lines.length && /^(Sporządzono|Stan na|Materiały prawne)/i.test(lines[i].trim())) {
          const t3 = fixPolishTypography(lines[i].trim(), false);
          const w3 = regularFont.widthOfTextAtSize(t3, 8.5);
          drawText(t3, regularFont, 8.5, rgb(0.4, 0.4, 0.4), pageWidth - marginRight - w3);
          y -= 10;
          i++;
        }
        currentPage.drawLine({
          start: { x: marginLeft, y: y },
          end: { x: pageWidth - marginRight, y: y },
          thickness: 0.75,
          color: rgb(0.7, 0.75, 0.8),
        });
        y -= 14;
        continue;
      }

      // 5. Kwota roszczenia (wyśrodkowana, pogrubiona)
      if (/^[\d\s.,]+\s*(PLN|zł)\s*(BRUTTO)?$/i.test(trimmed)) {
        ensureSpace(35);
        y -= 6;
        const t = fixPolishTypography(trimmed, false);
        const w = boldFont.widthOfTextAtSize(t, 13);
        drawText(t, boldFont, 13, rgb(0.08, 0.08, 0.08), marginLeft + (contentWidth - w) / 2);
        y -= 16;
        i++;
        if (i < lines.length && /^\(słownie/i.test(lines[i].trim())) {
          const ts = fixPolishTypography(lines[i].trim(), false);
          const ws = regularFont.widthOfTextAtSize(ts, 8.5);
          drawText(ts, regularFont, 8.5, rgb(0.4, 0.4, 0.4), marginLeft + (contentWidth - ws) / 2);
          y -= 14;
          i++;
        }
        continue;
      }

      // 6. Rzymskie nagłówki sekcji
      if (/^(I|II|III|IV|V|VI)\.\s+[A-ZĄĆĘŁŃÓŚŹŻ( ]+$/.test(trimmed)) {
        ensureSpace(50);
        y -= 10;
        drawText(fixPolishTypography(trimmed, false), boldFont, 11, rgb(0.08, 0.08, 0.08), marginLeft);
        y -= 16;
        i++;
        continue;
      }

      // 7. Podpis (wyrównany do prawej strony)
      if (/^[.…_]{10,}$/.test(trimmed)) {
        ensureSpace(45);
        y -= 16;
        const t = trimmed;
        const w = regularFont.widthOfTextAtSize(t, 10);
        drawText(t, regularFont, 10, rgb(0.4, 0.4, 0.4), pageWidth - marginRight - w);
        y -= 13;
        i++;
        if (i < lines.length && /^\(własnoręczny podpis/i.test(lines[i].trim())) {
          const ts = fixPolishTypography(lines[i].trim(), false);
          const ws = regularFont.widthOfTextAtSize(ts, 8.5);
          drawText(ts, regularFont, 8.5, rgb(0.4, 0.4, 0.4), pageWidth - marginRight - ws);
          y -= 15;
          i++;
        }
        continue;
      }

      // 8. Podpunkt w wykazie pozycji (wcięty)
      if (/^\s{2,}[-–•]\s+/.test(rawLine)) {
        const textPart = fixPolishTypography(trimmed.replace(/^[-–•]\s+/, ''), false);
        drawHangingParagraph({
          prefix: '– ',
          prefixFont: boldFont,
          text: textPart,
          startX: marginLeft + 24,
          textX: marginLeft + 36,
          size: 9,
          spaceBefore: 1,
          spaceAfter: 2,
        });
        i++;
        continue;
      }

      // 9. Pole właściwości naruszenia (np. '   Roszczenie: ...')
      const propMatch = trimmed.match(/^(Roszczenie|Podstawa zarzutu|Podstawa prawna|Uzasadnienie|Szczegółowy wykaz pozycji|Numer rachunku|Tytuł przelewu)\s*:\s*(.*)$/i);
      if (propMatch && (/^\s{2,}/.test(rawLine) || /^(Numer rachunku|Tytuł przelewu)/i.test(trimmed))) {
        const label = propMatch[1].trim() + ':';
        const textVal = fixPolishTypography(propMatch[2].trim(), false);
        drawHangingParagraph({
          label,
          labelFont: boldFont,
          text: textVal,
          textX: marginLeft + 16,
          size: 9.5,
          spaceBefore: 1,
          spaceAfter: 2,
        });
        i++;
        continue;
      }

      // 10. Numerowany tytuł naruszenia (np. '1. BEZPRAWNE POTRĄCENIE...')
      const numViolMatch = trimmed.match(/^(\d+\.)\s+([A-ZĄĆĘŁŃÓŚŹŻ( ]+)$/);
      if (numViolMatch) {
        ensureSpace(45);
        drawHangingParagraph({
          prefix: numViolMatch[1] + ' ',
          prefixFont: boldFont,
          text: fixPolishTypography(numViolMatch[2], false),
          font: boldFont,
          startX: marginLeft,
          textX: marginLeft + 18,
          size: 10,
          spaceBefore: 8,
          spaceAfter: 3,
          keepWithNext: true,
        });
        i++;
        continue;
      }

      // 11. Podstawa prawna numerowana (np. '1. Zasada pełnej kompensacji...')
      const numBasisMatch = trimmed.match(/^(\d+\.)\s+(.+)$/);
      if (numBasisMatch && /^(1|2|3|4)\.\s+[A-ZĄĆĘŁŃÓŚŹŻ]/.test(trimmed) && trimmed.length < 120 && trimmed.endsWith(':')) {
        ensureSpace(40);
        drawHangingParagraph({
          prefix: numBasisMatch[1] + ' ',
          prefixFont: boldFont,
          text: fixPolishTypography(numBasisMatch[2], false),
          font: boldFont,
          startX: marginLeft,
          textX: marginLeft + 18,
          size: 9.5,
          spaceBefore: 7,
          spaceAfter: 3,
          keepWithNext: true,
        });
        i++;
        continue;
      }

      // 12. Punkt z myślnikiem (np. '- Numer szkody: ...')
      if (/^[-–•]\s+/.test(trimmed)) {
        const textPart = fixPolishTypography(trimmed.replace(/^[-–•]\s+/, ''), false);
        const labelM = textPart.match(/^([^:]{3,40}):\s*(.*)$/);
        if (labelM) {
          drawHangingParagraph({
            prefix: '– ',
            prefixFont: boldFont,
            label: labelM[1].trim() + ':',
            labelFont: boldFont,
            text: labelM[2].trim(),
            startX: marginLeft + 10,
            textX: marginLeft + 22,
            size: 9.5,
            spaceBefore: 1.5,
            spaceAfter: 1.5,
          });
        } else {
          drawHangingParagraph({
            prefix: '– ',
            prefixFont: boldFont,
            text: textPart,
            startX: marginLeft + 10,
            textX: marginLeft + 22,
            size: 9.5,
            spaceBefore: 1.5,
            spaceAfter: 1.5,
          });
        }
        i++;
        continue;
      }

      // 13. Cytat orzeczenia (np. '„Zakład ubezpieczeń...”')
      if (/^[„"]/.test(trimmed)) {
        ensureSpace(35);
        const quoteText = fixPolishTypography(trimmed, false);
        const startQuoteY = y;
        drawHangingParagraph({
          text: quoteText,
          textX: marginLeft + 16,
          size: 9,
          color: rgb(0.18, 0.18, 0.18),
          spaceBefore: 3,
          spaceAfter: 4,
        });
        currentPage.drawLine({
          start: { x: marginLeft + 8, y: startQuoteY },
          end: { x: marginLeft + 8, y: y + 2 },
          thickness: 2,
          color: rgb(0.2, 0.45, 0.65),
        });
        i++;
        continue;
      }

      // 14. Nagłówki sekcji załączników (np. 'METRYKA SZKODY:', 'ROZLICZENIE FINANSOWE:')
      if (/^[A-ZĄĆĘŁŃÓŚŹŻ ]{4,}:\s*$/.test(trimmed)) {
        ensureSpace(35);
        drawText(fixPolishTypography(trimmed, false), boldFont, 10, rgb(0.08, 0.08, 0.08), marginLeft);
        y -= 14;
        i++;
        continue;
      }

      // 15. Domyślny akapit tekstu
      const paraText = fixPolishTypography(trimmed, false);
      drawHangingParagraph({
        text: paraText,
        startX: marginLeft,
        textX: marginLeft,
        size: 9.5,
        spaceBefore: 1,
        spaceAfter: 4,
      });
      i++;
    }
  });

  // Dodaj paginację na stronach (pomijając celowo puste strony zachowania parzystości)
  const totalPages = pdfDoc.getPageCount();
  const allPages = pdfDoc.getPages();
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const pageNumber = pIdx + 1;
    if (blankParityPages.has(pageNumber)) {
      continue;
    }
    const p = allPages[pIdx];
    const pageNumText = fixPolishTypography('– ' + pageNumber + ' –', false);
    const nw = regularFont.widthOfTextAtSize(pageNumText, 8.5);
    p.drawText(pageNumText, {
      x: marginLeft + (contentWidth - nw) / 2,
      y: 28,
      size: 8.5,
      font: regularFont,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
