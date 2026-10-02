import { describe, it, expect } from 'vitest';
import { CostEstimateParser } from '../src/parser/pdf-parser.js';
import { runAudit } from '../src/domain/audit-engine.js';

describe('CostEstimateParser (Parser Kosztorysów)', () => {
  const parser = new CostEstimateParser();

  const sampleAudatexText = `
AUDATEX POLSKA SP. Z O.O.
KALKULACJA NAPRAWY NR: 9812-PL-2026
Nr szkody: PL/PZU/2026/09/99120
Zakład ubezpieczeń: Powszechny Zakład Ubezpieczeń S.A.
Pojazd: Toyota Corolla 1.8 Hybrid 2021
Nr rej: KR 5512B
Data zdarzenia: 2026-09-02

STAWKI ROBOCIZNY:
Stawka rbh robocizny: 70,00 PLN
Czas naprawy: 15.0 rbh

CZĘŚCI ZAMIENNE DO WYMIANY:
Zderzak przedni kpl. 52119-02B50 O 1650.00 zł urealnienie 40%
Błotnik przedni lewy 53802-02190 PJ 420.00 zł
Reflektor lewy LED 81150-02S20 O 2900.00 zł amortyzacja 30%

LAKIEROWANIE:
Materiały lakiernicze: 720,00 zł
Rabat na materiał lakierniczy: 33%

ROZLICZENIE SZKODY:
Kwota bezsporna netto: 3800.00 PLN
`;

  it('powinien poprawnie wyekstrahować dane nagłówka i ubezpieczyciela', () => {
    const result = parser.parseText(sampleAudatexText, 'malopolskie');
    expect(result.estimate.header.claimNumber).toBe('PL/PZU/2026/09/99120');
    expect(result.estimate.header.insurerName).toBe('Powszechny Zakład Ubezpieczeń S.A.');
    expect(result.estimate.header.registrationNumber).toBe('KR 5512B');
    expect(result.estimate.header.damageDate).toBe('2026-09-02');
  });

  it('powinien wyekstrahować stawkę rbh i liczbę godzin', () => {
    const result = parser.parseText(sampleAudatexText, 'malopolskie');
    expect(result.estimate.labor.sheetMetalRateNet).toBe(70.0);
    expect(result.estimate.labor.sheetMetalHours + result.estimate.labor.paintHours).toBe(15.0);
  });

  it('powinien wykryć amortyzację i zamienniki w częściach', () => {
    const result = parser.parseText(sampleAudatexText, 'malopolskie');
    expect(result.estimate.parts.length).toBeGreaterThanOrEqual(2);

    const depreciated = result.estimate.parts.filter(p => p.depreciationPercent > 0);
    expect(depreciated.length).toBeGreaterThan(0);
  });

  it('powinien wygenerować rzetelny audyt po przepuszczeniu sparsowanego obiektu przez silnik reguł', () => {
    const result = parser.parseText(sampleAudatexText, 'malopolskie');
    const audit = runAudit(result.estimate);

    expect(audit.violations.length).toBeGreaterThanOrEqual(2);
    expect(audit.summary.totalLossGross).toBeGreaterThan(1500.0);
    expect(audit.summary.fairAmountGross).toBeGreaterThan(audit.summary.undisputedAmountGross);
  });
});
