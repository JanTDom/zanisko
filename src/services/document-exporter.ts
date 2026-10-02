import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

/**
 * Eksportuje dokument do formatu Microsoft Word (.doc) z pełnym zachowaniem stylów,
 * marginesów A4, tabel i nagłówków.
 */
export function exportToDoc(htmlBody: string, title = 'Dokument procesowy'): Buffer {
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
  line-height: 1.3;
  color: #111;
}
h1, h2, h3 { font-family: 'Calibri', Arial, sans-serif; }
h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 18pt 0 4pt 0; text-transform: uppercase; }
h2 { font-size: 11.5pt; font-weight: bold; margin: 14pt 0 6pt 0; border-bottom: 1px solid #444; padding-bottom: 2pt; page-break-after: avoid; }
h3 { font-size: 11pt; font-weight: bold; margin: 10pt 0 3pt 0; page-break-after: avoid; }
h3.basis { font-size: 11pt; }
p { margin: 0 0 1pt 0; text-align: left; }
p.justify { text-align: justify; margin-bottom: 4pt; }
p.subtitle { text-align: center; font-weight: bold; margin: 0 0 2pt 0; }
p.date { text-align: right; }
p.party { font-weight: bold; font-size: 9.5pt; letter-spacing: 0.5pt; color: #333; margin-top: 4pt; }
p.li { margin-left: 14pt; text-indent: -10pt; }
p.amount { text-align: center; font-weight: bold; font-size: 14pt; margin: 6pt 0 2pt 0; }
p.center { text-align: center; }
p.small { font-size: 9.5pt; color: #444; }
p.sign { text-align: right; margin-top: 24pt; }
p.sign.small { margin-top: 0; }
.blk { margin-bottom: 10pt; }
table { width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 14pt; }
th, td { border: 1px solid #777; padding: 5pt 7pt; font-size: 9.5pt; text-align: left; }
th { background-color: #f1f5f9; font-weight: bold; }
.header-box { margin-bottom: 16pt; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;

  return Buffer.from(docHtml, 'utf-8');
}

/**
 * Eksportuje dokument do formatu Rich Text Format (.rtf) kompatybilnego
 * ze wszystkimi edytorami tekstu (Word, LibreOffice, Pages, WordPad).
 */
export function exportToRtf(plainText: string): Buffer {
  let rtf = '{\\rtf1\\ansi\\ansicpg1250\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset238 Calibri;}{\\f1\\froman\\fcharset238 Times New Roman;}}\\f0\\fs22\\sa160\\sl280\\slmult1 ';

  for (let i = 0; i < plainText.length; i++) {
    const char = plainText[i];
    const code = plainText.charCodeAt(i);

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
  return Buffer.from(plainText, 'utf-8');
}

/**
 * Generuje wielostronicowy plik PDF z poprawną paginacją, marginesami i polską typografią.
 */
export async function exportToPdf(plainText: string, title = 'Dokument'): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Załaduj czcionkę TrueType ze wsparciem polskich znaków
  let fontBytes: Buffer;
  const projectFontPath = path.resolve('assets/fonts/DocumentFont.ttf');
  const systemFontPath = '/System/Library/Fonts/Supplemental/Arial.ttf';

  if (fs.existsSync(projectFontPath)) {
    fontBytes = fs.readFileSync(projectFontPath);
  } else if (fs.existsSync(systemFontPath)) {
    fontBytes = fs.readFileSync(systemFontPath);
  } else {
    throw new Error('Brak czcionki TrueType do wygenerowania dokumentu PDF');
  }

  const font = await pdfDoc.embedFont(fontBytes);

  const fontSize = 9.5;
  const lineHeight = 13.5;
  const margin = 50;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const maxLineWidth = pageWidth - margin * 2;

  // Podział na akapity i zawijanie wierszy
  const lines: string[] = [];
  const rawParagraphs = plainText.split('\n');

  for (const para of rawParagraphs) {
    if (para.trim().length === 0) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? currentLine + ' ' + word : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width <= maxLineWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  // Renderowanie stron
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Nagłówek pierwszej strony
  page.drawText(title, {
    x: margin,
    y: y,
    size: 11,
    font,
    color: rgb(0.1, 0.4, 0.7),
  });
  y -= lineHeight * 1.8;

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line) {
      page.drawText(line, {
        x: margin,
        y: y,
        size: fontSize,
        font,
        color: rgb(0.12, 0.12, 0.12),
      });
    }
    y -= lineHeight;
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
