import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CostEstimateParser } from '../src/parser/pdf-parser.js';
import { runAudit } from '../src/domain/audit-engine.js';
// pdf-parse v2 module export
import { PDFParse } from 'pdf-parse';

describe('Sample PDF File Verification', () => {
  it('powinien odczytać wygenerowany plik PDF i przeprowadzić audyt zaniżeń', async () => {
    const pdfPath = path.resolve('public/przykladowy_kosztorys_pzu.pdf');
    expect(fs.existsSync(pdfPath)).toBe(true);

    const pdfBuffer = fs.readFileSync(pdfPath);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    const parser = new CostEstimateParser();
    // Odczyt tekstu za pomocą parsera tekstu
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const pdfData = await pdfInstance.getText();
    const text = pdfData.text;

    expect(text).toContain('AUDATEX POLSKA');
    expect(text).toContain('PL/PZU/2026/09/99120');

    const result = parser.parseText(text, 'malopolskie');
    expect(result.estimate.header.claimNumber).toBe('PL/PZU/2026/09/99120');
    expect(result.estimate.labor.sheetMetalRateNet).toBe(70.0);

    const audit = runAudit(result.estimate);
    expect(audit.summary.totalLossGross).toBeGreaterThan(1500.0);
    expect(audit.violations.length).toBeGreaterThanOrEqual(2);
  });
});
