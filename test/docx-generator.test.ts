import { describe, it, expect } from 'vitest';
import { exportDemandLetterToDocx, exportAttachmentToDocx, exportBundleToDocx } from '../src/services/docx-generator.js';
import { generateDemandLetter } from '../src/domain/demand-letter.js';
import { generateAttachment1Audit, generateAttachment2PimRates, generateAttachment3LegalBasis } from '../src/domain/attachments.js';
import { runAudit } from '../src/domain/audit-engine.js';
import { CostEstimateParser } from '../src/parser/pdf-parser.js';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

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

describe('DOCX OpenXML Generator Service', () => {
  const parser = new CostEstimateParser();
  const parsed = parser.parseText(SAMPLE_TEXT, 'mazowieckie');
  const report = runAudit(parsed.estimate);

  const letterText = generateDemandLetter(report, {
    claimantName: 'Jan Kowalski',
    claimantAddress: 'ul. Marszałkowska 10/12, 00-001 Warszawa',
    bankAccountNumber: '12 1020 1026 0000 1234 5678 9012',
  });

  const att1 = generateAttachment1Audit(report);
  const att2 = generateAttachment2PimRates('mazowieckie', 'POPULAR');
  const att3 = generateAttachment3LegalBasis();

  it('powinien wygenerować poprawny plik .docx dla wezwania do zapłaty', () => {
    const docxBuf = exportDemandLetterToDocx(letterText);
    expect(docxBuf.length).toBeGreaterThan(1000);
    // Sprawdź nagłówek ZIP (PK\x03\x04)
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);
    expect(docxBuf[2]).toBe(0x03);
    expect(docxBuf[3]).toBe(0x04);

    const tmpPath = path.resolve('test_temp_letter.docx');
    fs.writeFileSync(tmpPath, docxBuf);

    try {
      const info = execSync(`textutil -info "${tmpPath}"`).toString();
      expect(info).toContain('Office Open XML format');
      expect(info.toLowerCase()).toContain('characters');
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  it('powinien wygenerować poprawny plik .docx dla załączników tabelarycznych', () => {
    const docxBuf = exportAttachmentToDocx(att1);
    expect(docxBuf.length).toBeGreaterThan(1000);

    const tmpPath = path.resolve('test_temp_att.docx');
    fs.writeFileSync(tmpPath, docxBuf);

    try {
      const text = execSync(`textutil -convert txt -stdout "${tmpPath}"`).toString();
      expect(text).toContain('Załącznik nr 1');
      expect(text).toContain(report.header.claimNumber);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });

  it('powinien wygenerować kompletny pakiet procesowy .docx zawierający pismo i 3 załączniki', () => {
    const bundleBuf = exportBundleToDocx(letterText, [att1, att2, att3]);
    expect(bundleBuf.length).toBeGreaterThan(3000);

    const tmpPath = path.resolve('test_temp_bundle.docx');
    fs.writeFileSync(tmpPath, bundleBuf);

    try {
      const info = execSync(`textutil -info "${tmpPath}"`).toString();
      expect(info).toContain('Office Open XML format');

      const text = execSync(`textutil -convert txt -stdout "${tmpPath}"`).toString();
      expect(text).toContain('PRZEDSĄDOWE WEZWANIE DO ZAPŁATY');
      expect(text).toContain('Załącznik nr 1');
      expect(text).toContain('Województwo mazowieckie');
      expect(text).toContain('III CZP 80/11');
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });
});
