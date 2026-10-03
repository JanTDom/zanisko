import zlib from 'node:zlib';
import { fixPolishTypography } from '../domain/typography.js';
import { AttachmentData } from '../domain/attachments.js';

/**
 * Prosty, bezbiblioteczny generator plików ZIP w czystym Node.js (RFC 1951 / DEFLATE).
 * Eliminuje jakiekolwiek zewnętrzne zależności i działa niezawodnie na Vercel Serverless.
 */
function createZip(files: Array<{ name: string; data: Buffer | string }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  // Tablica CRC32
  const crcTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function crc32(buf: Buffer): number {
    let c = -1;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return (c ^ (-1)) >>> 0;
  }

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf-8');
    const dataBuf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf-8');
    const deflated = zlib.deflateRawSync(dataBuf);
    const crc = crc32(dataBuf);

    // Nagłówek lokalny pliku (30 bajtów + nazwa)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // podpis PK\x03\x04
    local.writeUInt16LE(20, 4);         // minimalna wersja (2.0)
    local.writeUInt16LE(0x0800, 6);     // flaga UTF-8 (bit 11)
    local.writeUInt16LE(8, 8);          // metoda kompresji: Deflate
    local.writeUInt16LE(0, 10);         // czas DOS
    local.writeUInt16LE(0, 12);         // data DOS
    local.writeUInt32LE(crc, 14);       // suma kontrolna CRC32
    local.writeUInt32LE(deflated.length, 18); // rozmiar skompresowany
    local.writeUInt32LE(dataBuf.length, 22);  // rozmiar nieskompresowany
    local.writeUInt16LE(nameBuf.length, 26);  // długość nazwy pliku
    local.writeUInt16LE(0, 28);               // długość dodatkowego pola
    nameBuf.copy(local, 30);

    localHeaders.push(local, deflated);

    // Nagłówek katalogu centralnego (46 bajtów + nazwa)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // podpis PK\x01\x02
    central.writeUInt16LE(20, 4);         // wersja programu
    central.writeUInt16LE(20, 6);         // wersja wymagana
    central.writeUInt16LE(0x0800, 8);     // flaga UTF-8
    central.writeUInt16LE(8, 10);         // kompresja Deflate
    central.writeUInt16LE(0, 12);         // czas
    central.writeUInt16LE(0, 14);         // data
    central.writeUInt32LE(crc, 16);       // CRC32
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);   // offset nagłówka lokalnego
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + deflated.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of centralHeaders) centralSize += c.length;

  // Rekord końca katalogu centralnego (EOCD - 22 bajty)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // podpis PK\x05\x06
  eocd.writeUInt16LE(0, 4);          // numer dysku
  eocd.writeUInt16LE(0, 6);          // dysk startowy
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Times New Roman"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
        <w:lang w:val="pl-PL"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="80" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

/**
 * Odszyfrowuje encje HTML (takie jak &nbsp;, &ndash;, &amp; itp.) na natywne znaki Unicode.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, '\u00A0')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Czyści fragment HTML na czysty tekst z zachowaniem niełamliwych spacji Unicode (\u00A0).
 */
export function cleanHtmlToDocxText(html: string): string {
  if (!html) return '';
  const noTags = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(noTags).replace(/[ \t\r\n]+/g, ' ').trim();
}

/**
 * Konwertuje tekst akapitu na format Word OpenXML (z obsługą pogrubionych etykiet 'Etykieta:').
 */
function formatParagraphRuns(text: string): string {
  const decoded = decodeHtmlEntities(text || '');
  const fixed = fixPolishTypography(decoded, false);
  const LABEL = /^(Roszczenie|Podstawa zarzutu|Podstawa prawna|Uzasadnienie|Numer rachunku|Tytuł przelewu|Szczegółowy wykaz pozycji|Dotyczy|Data zdarzenia|Numer szkody[^:]*|Pojazd[^:]*|Numer rejestracyjny|Województwo szkody|Stawka przyjęta|Stawka robocizny|Przyznana kwota bezsporna|Wyliczona kwota zaniżenia|Pełny, rzetelny koszt|WZYWAJĄCY[^:]*|ADRESAT[^:]*)\s*:\s*/i;

  const m = fixed.match(LABEL);
  if (m) {
    const label = m[0];
    const rest = fixed.slice(label.length);
    return `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r>` +
           `<w:r><w:t xml:space="preserve">${escapeXml(rest)}</w:t></w:r>`;
  }

  return `<w:r><w:t xml:space="preserve">${escapeXml(fixed)}</w:t></w:r>`;
}

/**
 * Konwertuje czysty tekst pisma wezwania do zapłaty na elementy XML Worda (<w:p>).
 */
export function demandLetterToDocxXml(text: string): string {
  const blocks = (text || '').replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out: string[] = [];
  const UPPER = /^[^a-ząćęłńóśźż]*$/;
  const LABEL = /^(Roszczenie|Podstawa zarzutu|Podstawa prawna|Uzasadnienie|Numer rachunku|Tytuł przelewu|Szczegółowy wykaz pozycji|Dotyczy|Data zdarzenia|Numer szkody[^:]*|Pojazd[^:]*|Numer rejestracyjny|Województwo szkody|Stawka przyjęta|Stawka robocizny|Przyznana kwota bezsporna|Wyliczona kwota zaniżenia|Pełny, rzetelny koszt|WZYWAJĄCY[^:]*|ADRESAT[^:]*)\s*:\s*/i;

  let inNumberedItem = false;
  let inAttachmentsList = false;

  blocks.forEach((block, bi) => {
    const rawLines = block.split('\n').filter(l => l.trim().length > 0);
    if (!rawLines.length) return;

    // Tytuł pisma
    if (/PRZEDSĄDOWE WEZWANIE/i.test(rawLines[0].trim())) {
      inNumberedItem = false;
      inAttachmentsList = false;
      out.push(
        `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="40"/></w:pPr>` +
        `<w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${escapeXml(rawLines[0].trim())}</w:t></w:r></w:p>`
      );
      rawLines.slice(1).forEach(l => {
        out.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>${escapeXml(l.trim())}</w:t></w:r></w:p>`
        );
      });
      return;
    }

    rawLines.forEach((rawLine, li) => {
      const line = rawLine.trim();
      const isIndented = /^\s{2,}/.test(rawLine);

      // Data w prawym górnym rogu
      if (bi === 0 && li === 0 && /dnia|\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}/.test(line) && line.length < 60) {
        out.push(
          `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="240"/></w:pPr>` +
          `<w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Główne nagłówki sekcji (I. WEZWANIE, II. WYKAZ, III. PODSTAWA, IV. RYGOR)
      else if (/^(I|II|III|IV|V|VI|VII|VIII)\.\s+\S/.test(line) && UPPER.test(line)) {
        inNumberedItem = false;
        inAttachmentsList = false;
        out.push(
          `<w:p><w:pPr><w:spacing w:before="280" w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="334155"/></w:pBdr></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Podpunkty numerowane sekcji II (np. 1. ZANIŻENIE STAWKI..., 2. BEZPRAWNE POTRĄCENIE...)
      else if (/^\d+\.\s+/.test(line) && UPPER.test(line)) {
        inNumberedItem = true;
        inAttachmentsList = false;
        const cleanTitle = fixPolishTypography(decodeHtmlEntities(line), false);
        out.push(
          `<w:p><w:pPr><w:ind w:left="480" w:hanging="280"/><w:spacing w:before="180" w:after="60"/><w:jc w:val="both"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(cleanTitle)}</w:t></w:r></w:p>`
        );
      }
      // Podstawy prawne w sekcji III (np. 1. Zasada pełnej kompensacji...:)
      else if (/^\d+\.\s+.{3,120}:$/.test(line)) {
        inNumberedItem = true;
        inAttachmentsList = false;
        const cleanBasis = fixPolishTypography(decodeHtmlEntities(line), false);
        out.push(
          `<w:p><w:pPr><w:ind w:left="480" w:hanging="280"/><w:spacing w:before="160" w:after="60"/><w:jc w:val="both"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>${escapeXml(cleanBasis)}</w:t></w:r></w:p>`
        );
      }
      // Lista załączników na końcu
      else if (/^Załączniki\s*:/i.test(line)) {
        inNumberedItem = false;
        inAttachmentsList = true;
        out.push(
          `<w:p><w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Każda inna linia z numeracją punktową (np. lista załączników lub pozycje rozliczenia)
      else if (/^\d+\.\s+/.test(line)) {
        out.push(
          `<w:p><w:pPr><w:ind w:left="480" w:hanging="280"/><w:spacing w:after="40"/><w:jc w:val="both"/></w:pPr>${formatParagraphRuns(line)}</w:p>`
        );
      }
      // Kwota roszczenia wyróżniona
      else if (/^[\d\s.,]+\s*(PLN|zł)\s*(BRUTTO)?$/i.test(line)) {
        out.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="140" w:after="40"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/><w:color w:val="0B3B60"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Słownie pod kwotą
      else if (/^\(słownie/i.test(line)) {
        out.push(
          `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/></w:pPr>` +
          `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Podpisy
      else if (/^[.…_]{10,}$/.test(line)) {
        inNumberedItem = false;
        out.push(
          `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="360" w:after="20"/></w:pPr>` +
          `<w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      } else if (/^\(własnoręczny podpis/i.test(line)) {
        inNumberedItem = false;
        out.push(
          `<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="160"/></w:pPr>` +
          `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="64748B"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Elementy podrzędne wewnątrz sekcji numerowanej lub z wcięciem (wcięcie dopasowane do numeracji)
      else if (inNumberedItem || isIndented || LABEL.test(line)) {
        if (/^[-–•]\s+/.test(line)) {
          // Podpunkt w wykazie pozycji (np. - Zderzak przedni kpl...)
          const itemText = line.replace(/^[-–•]\s+/, '');
          out.push(
            `<w:p><w:pPr><w:ind w:left="840" w:hanging="280"/><w:spacing w:after="30"/><w:jc w:val="both"/></w:pPr>` +
            `<w:r><w:t>–&#160;</w:t></w:r>${formatParagraphRuns(itemText)}</w:p>`
          );
        } else {
          // Etykiety i treść podpunktu (Roszczenie:, Podstawa zarzutu:, Uzasadnienie:, Szczegółowy wykaz pozycji:)
          out.push(
            `<w:p><w:pPr><w:ind w:left="480"/><w:spacing w:after="40"/><w:jc w:val="both"/></w:pPr>${formatParagraphRuns(line)}</w:p>`
          );
        }
      }
      // Standardowe wypunktowania poza podpunktami
      else if (/^[-–•]\s+/.test(line)) {
        const itemText = line.replace(/^[-–•]\s+/, '');
        out.push(
          `<w:p><w:pPr><w:ind w:left="420" w:hanging="260"/><w:spacing w:after="40"/><w:jc w:val="both"/></w:pPr>` +
          `<w:r><w:t>–&#160;</w:t></w:r>${formatParagraphRuns(itemText)}</w:p>`
        );
      }
      // Etykiety podmiotów (WZYWAJĄCY:, ADRESAT:)
      else if (/^[A-ZĄĆĘŁŃÓŚŹŻ() ]{4,}:$/.test(line)) {
        out.push(
          `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>` +
          `<w:r><w:rPr><w:b/><w:sz w:val="19"/><w:szCs w:val="19"/><w:color w:val="334155"/></w:rPr><w:t>${escapeXml(line)}</w:t></w:r></w:p>`
        );
      }
      // Standardowy akapit tekstu
      else {
        const jc = line.length > 90 ? `<w:jc w:val="both"/>` : '';
        out.push(
          `<w:p><w:pPr>${jc}<w:spacing w:after="60"/></w:pPr>${formatParagraphRuns(line)}</w:p>`
        );
      }
    });
  });

  return out.join('');
}

/**
 * Parsuje fragmenty HTML (nagłówki, akapity, cytaty, wypunktowania) do elementów OpenXML Worda.
 */
function renderHtmlFragmentToDocx(html: string): string {
  const out: string[] = [];
  const blockRegex = /<(h[23]|p|li|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const rawInner = m[2];

    // Pomiń nagłówek nadrzędny header-box, bo tytuł i podtytuł są już wyrenderowane
    if (tag === 'div' && (m[0].includes('header-box') || rawInner.includes('<h1') || rawInner.includes('<h2'))) {
      continue;
    }

    const text = cleanHtmlToDocxText(rawInner);
    if (!text) continue;

    if (tag === 'h2' || tag === 'h3') {
      out.push(
        `<w:p><w:pPr><w:spacing w:before="240" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="3" w:color="94A3B8"/></w:pBdr></w:pPr>` +
        `<w:r><w:rPr><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r></w:p>`
      );
    } else if (tag === 'li') {
      out.push(
        `<w:p><w:pPr><w:ind w:left="480" w:hanging="260"/><w:spacing w:after="40"/><w:jc w:val="both"/></w:pPr>` +
        `<w:r><w:t>–&#160;</w:t></w:r>${formatParagraphRuns(text)}</w:p>`
      );
    } else if (tag === 'div' && rawInner.includes('„')) {
      // Cytat / teza z orzeczenia (elegancki boczny pasek)
      out.push(
        `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="0284C7"/></w:pBdr><w:ind w:left="360"/><w:spacing w:before="80" w:after="80"/><w:jc w:val="both"/></w:pPr>` +
        `<w:r><w:rPr><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="1E293B"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
      );
    } else {
      out.push(
        `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="60"/></w:pPr>${formatParagraphRuns(text)}</w:p>`
      );
    }
  }
  return out.join('');
}

/**
 * Konwertuje załącznik dowodowy na tabelaryczny format Word OpenXML.
 */
export function attachmentToDocxXml(att: AttachmentData): string {
  const out: string[] = [];

  // Nagłówek załącznika
  const cleanTitle = cleanHtmlToDocxText(att.title);
  const cleanSubtitle = cleanHtmlToDocxText(att.subtitle);

  out.push(
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="100" w:after="40"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${escapeXml(cleanTitle)}</w:t></w:r></w:p>`
  );
  if (cleanSubtitle) {
    out.push(
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr>` +
      `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="475569"/></w:rPr><w:t>${escapeXml(cleanSubtitle)}</w:t></w:r></w:p>`
    );
  }

  // Jeśli załącznik posiada strukturę tabelaryczną w htmlContent (np. Attachment 1 lub 2),
  // parsujemy tabele HTML na profesjonalne tabele Word OpenXML
  if (att.htmlContent && att.htmlContent.includes('<table')) {
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tableRegex.exec(att.htmlContent)) !== null) {
      // Tekst przed tabelą (nagłówki, akapity)
      const preText = att.htmlContent.slice(lastIndex, match.index);
      if (preText.trim()) {
        out.push(renderHtmlFragmentToDocx(preText));
      }

      // Generowanie tabeli OpenXML
      const tableInner = match[1];
      const rows = tableInner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

      let tableXml =
        `<w:tbl>` +
        `<w:tblPr>` +
        `<w:tblW w:w="5000" w:type="pct"/>` +
        `<w:tblBorders>` +
        `<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
        `<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
        `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
        `<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
        `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>` +
        `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>` +
        `</w:tblBorders>` +
        `<w:tblCellMar><w:top w:w="90" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>` +
        `</w:tblPr>`;

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const isHeaderRow = /<th/i.test(row) || ri === 0;
        const cells = row.match(/<(td|th)[^>]*>([\s\S]*?)<\/(td|th)>/gi) || [];

        tableXml += `<w:tr>`;
        for (const cell of cells) {
          const isHeaderCell = /<th/i.test(cell);
          const cellContent = cleanHtmlToDocxText(cell);
          const isRightAlign = /align\s*:\s*right|text-align:\s*right|PLN|zł/i.test(cell);
          const jcXml = isRightAlign ? `<w:jc w:val="right"/>` : `<w:jc w:val="left"/>`;
          const shdXml = (isHeaderRow || isHeaderCell)
            ? `<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>`
            : '';
          const boldXml = (isHeaderRow || isHeaderCell || isRightAlign) ? `<w:b/>` : '';

          tableXml +=
            `<w:tc>` +
            `<w:tcPr>${shdXml}<w:vAlign w:val="center"/></w:tcPr>` +
            `<w:p><w:pPr>${jcXml}<w:spacing w:after="0"/></w:pPr>` +
            `<w:r><w:rPr>${boldXml}<w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(cellContent)}</w:t></w:r>` +
            `</w:p>` +
            `</w:tc>`;
        }
        tableXml += `</w:tr>`;
      }

      tableXml += `</w:tbl>`;
      out.push(tableXml);
      lastIndex = tableRegex.lastIndex;
    }

    // Tekst po ostatniej tabeli (np. sekcja III w Załączniku nr 2)
    const postText = att.htmlContent.slice(lastIndex);
    if (postText.trim()) {
      out.push(renderHtmlFragmentToDocx(postText));
    }
  } else if (att.htmlContent && /<(h[23]|p|li|div)/i.test(att.htmlContent)) {
    // Brak tabel, ale bogaty htmlContent (np. Załącznik nr 3 z orzecznictwem)
    out.push(renderHtmlFragmentToDocx(att.htmlContent));
  } else {
    // Brak tabel w htmlContent -> parsujemy czytelnie textContent
    out.push(demandLetterToDocxXml(att.textContent));
  }

  return out.join('');
}

/**
 * Główny szablon XML opakowujący treść OpenXML w standardowe parametry strony A4 Word.
 */
function wrapInWordDocumentXml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:orient="portrait"/>
      <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

/**
 * Eksportuje pojedyncze wezwanie do natywnego pliku Microsoft Word (.docx).
 */
export function exportDemandLetterToDocx(letterText: string, title = 'Przedsądowe wezwanie do zapłaty'): Buffer {
  const bodyXml = demandLetterToDocxXml(letterText);
  const docXml = wrapInWordDocumentXml(bodyXml);

  return createZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: ROOT_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS_XML },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/document.xml', data: docXml },
  ]);
}

/**
 * Eksportuje pojedynczy załącznik do natywnego pliku Microsoft Word (.docx).
 */
export function exportAttachmentToDocx(att: AttachmentData): Buffer {
  const bodyXml = attachmentToDocxXml(att);
  const docXml = wrapInWordDocumentXml(bodyXml);

  return createZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: ROOT_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS_XML },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/document.xml', data: docXml },
  ]);
}

/**
 * Eksportuje kompletny pakiet procesowy (Wezwanie + Załącznik 1 + Załącznik 2 + Załącznik 3)
 * do jednego pliku Microsoft Word (.docx) z podziałem na strony.
 */
export function exportBundleToDocx(
  letterText: string,
  attachments: AttachmentData[],
  title = 'Kompletny pakiet procesowy'
): Buffer {
  const letterXml = demandLetterToDocxXml(letterText);
  const pageBreakXml = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

  let combinedXml = letterXml;
  for (const att of attachments) {
    combinedXml += pageBreakXml + attachmentToDocxXml(att);
  }

  const docXml = wrapInWordDocumentXml(combinedXml);

  return createZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES_XML },
    { name: '_rels/.rels', data: ROOT_RELS_XML },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS_XML },
    { name: 'word/styles.xml', data: STYLES_XML },
    { name: 'word/document.xml', data: docXml },
  ]);
}
