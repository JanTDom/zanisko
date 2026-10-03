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

  it('powinien poprawnie przetworzyć wgrany kosztorys demonstracyjny Octavia III z pliku PDF', async () => {
    const demoPdfPath = '/Users/macbookpro/.gemini/antigravity/brain/468bb9c1-b511-4e28-8168-30969e1c17e5/.user_uploaded/media_1791047325441.pdf';
    if (!fs.existsSync(demoPdfPath)) return;

    const pdfBuffer = fs.readFileSync(demoPdfPath);
    const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const pdfData = await pdfInstance.getText();

    const parser = new CostEstimateParser();
    const result = parser.parseText(pdfData.text, 'mazowieckie');

    expect(result.estimate.header.claimNumber).toBe('DEMO/2026/10/00317');
    expect(result.estimate.header.vehicleMakeModel).toBe('Škoda Octavia III FL');
    expect(result.estimate.labor.sheetMetalRateNet).toBe(35.0);
    expect(result.estimate.labor.sheetMetalHours).toBe(5.3);
    expect(result.estimate.labor.paintHours).toBe(5.5);
    expect(result.estimate.parts.length).toBe(6);
    expect(result.estimate.undisputedAmountNet).toBe(1626.0);

    const audit = runAudit(result.estimate);
    expect(audit.violations.length).toBeGreaterThanOrEqual(2);
    expect(audit.summary.totalLossGross).toBeGreaterThan(3000.0);
    expect(audit.summary.appliedLaborRateNet).toBe(35.0);
  });
});
