import { describe, it, expect } from 'vitest';
import { exportToDoc, exportToRtf, exportToTxt, exportToPdf } from '../src/services/document-exporter.js';
import { generateAttachment1Audit, generateAttachment2PimRates, generateAttachment3LegalBasis } from '../src/domain/attachments.js';
import { runAudit } from '../src/domain/audit-engine.js';
import { CostEstimateParser } from '../src/parser/pdf-parser.js';
import { PDFParse } from 'pdf-parse';

const SAMPLE_TEXT = `AUDATEX POLSKA SP. Z O.O.
KALKULACJA NAPRAWY NR: 9812-PL-2026
Nr szkody: PL/PZU/2026/09/99120
Zakład ubezpieczeń: Powszechny Zakład Ubezpieczeń S.A.
Pojazd: Toyota Corolla 1.8 Hybrid 2021
Nr rej: KR 5512B
Data zdarzenia: 2026-09-02

STAWKI ROBOCIZNY:
Stawka rbh robocizny: 70,00 PLN
Czas naprawy: 18.0 rbh

CZĘŚCI ZAMIENNE DO WYMIANY:
Zderzak przedni kpl. 52119-02B50 O 1850.00 zł urealnienie 40%
Błotnik przedni lewy 53802-02190 PJ 450.00 zł
Reflektor lewy LED 81150-02S20 O 2950.00 zł amortyzacja 35%

LAKIEROWANIE:
Materiały lakiernicze: 850,00 zł
Rabat na materiał lakierniczy: 33%

ROZLICZENIE SZKODY:
Kwota bezsporna netto: 3600.00 PLN
`;

describe('Document Exporters (DOC, RTF, TXT, PDF) & Attachments', () => {
  const parser = new CostEstimateParser();
  const parsed = parser.parseText(SAMPLE_TEXT, 'mazowieckie');
  const report = runAudit(parsed.estimate);

  it('powinien wygenerować Załącznik nr 1 (kalkulacja korygująca)', () => {
    const att1 = generateAttachment1Audit(report);
    expect(att1.id).toBe('attachment1');
    expect(att1.number).toBe(1);
    expect(att1.textContent).toContain('ZAŁĄCZNIK NR 1');
    expect(att1.textContent).toContain(report.header.claimNumber);
    expect(att1.htmlContent).toContain('<table');
  });

  it('powinien wygenerować Załącznik nr 2 (stawki PIM)', () => {
    const att2 = generateAttachment2PimRates('mazowieckie', 'POPULAR');
    expect(att2.id).toBe('attachment2');
    expect(att2.number).toBe(2);
    expect(att2.textContent).toContain('Województwo mazowieckie');
    expect(att2.textContent).toContain('175.00 zł/rbh');
    expect(att2.htmlContent).toContain('Rekomendacj');
  });

  it('powinien wygenerować Załącznik nr 3 (kompendium prawne)', () => {
    const att3 = generateAttachment3LegalBasis();
    expect(att3.id).toBe('attachment3');
    expect(att3.number).toBe(3);
    expect(att3.textContent).toContain('III CZP 80/11');
    expect(att3.textContent).toContain('III CZP 32/03');
    expect(att3.textContent).toContain('Rekomendacja 16');
  });

  it('powinien wyeksportować poprawny plik Microsoft Word (.doc)', () => {
    const att1 = generateAttachment1Audit(report);
    const docBuffer = exportToDoc(att1.htmlContent, att1.title);
    expect(docBuffer.length).toBeGreaterThan(500);
    const docText = docBuffer.toString('utf-8');
    expect(docText).toContain('urn:schemas-microsoft-com:office:word');
    expect(docText).toContain(report.header.claimNumber);
  });

  it('powinien wyeksportować poprawny plik RTF (.rtf) z obsługą polskich znaków', () => {
    const att3 = generateAttachment3LegalBasis();
    const rtfBuffer = exportToRtf(att3.textContent);
    expect(rtfBuffer.length).toBeGreaterThan(500);
    const rtfText = rtfBuffer.toString('ascii');
    expect(rtfText.startsWith('{\\rtf1')).toBe(true);
    // Sprawdź czy polskie znaki są kodowane standardem unicode \uXXXX?
    expect(rtfText).toContain('\\u');
  });

  it('powinien wyeksportować poprawny plik TXT (.txt)', () => {
    const att2 = generateAttachment2PimRates('mazowieckie');
    const txtBuffer = exportToTxt(att2.textContent);
    expect(txtBuffer.length).toBeGreaterThan(200);
    expect(txtBuffer.toString('utf-8').toUpperCase()).toContain('POLSKIEJ IZBY MOTORYZACJI');
  });

  it('powinien wygenerować czytelny plik PDF (.pdf) z polskimi znakami', async () => {
    const att1 = generateAttachment1Audit(report);
    const pdfBuffer = await exportToPdf(att1.textContent, att1.title);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');

    // Weryfikacja czy pdf-parse potrafi go odczytać
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const textData = await pdfInstance.getText();
    expect(textData.text).toContain('ZAŁĄCZNIK NR 1');
    expect(textData.text).toContain(report.header.claimNumber);
  });
});
