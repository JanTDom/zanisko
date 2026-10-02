import { describe, it, expect } from 'vitest';
import { CostEstimate } from '../src/domain/types.js';
import { runAudit } from '../src/domain/audit-engine.js';
import { generateDemandLetter } from '../src/domain/demand-letter.js';
import { getRegionalBenchmark } from '../src/domain/regional-rates.js';

describe('ClaimCheck Audit Engine (Deterministyczny Silnik Audytowy)', () => {
  const sampleEstimate: CostEstimate = {
    header: {
      claimNumber: 'SZK/2026/09/88219',
      insurerName: 'Powszechny Zakład Ubezpieczeń S.A.',
      vehicleMakeModel: 'Volkswagen Passat B8 2.0 TDI',
      registrationNumber: 'WI 9821A',
      damageDate: '2026-09-15',
      voivodeship: 'mazowieckie',
      injuredPartyName: 'Jan Kowalski',
      injuredPartyAddress: 'ul. Marszałkowska 10/12, 00-001 Warszawa',
    },
    labor: {
      sheetMetalRateNet: 75.0,  // Zaniżona stawka ubezpieczyciela
      paintRateNet: 75.0,
      sheetMetalHours: 12.0,
      paintHours: 8.0,
    },
    parts: [
      {
        partName: 'Zderzak przedni kpl.',
        partNumber: '3G0807217',
        qualityCode: 'O',
        basePriceNet: 1800.0,
        depreciationPercent: 40.0, // Bezprawna amortyzacja 40% (720 zł)
        discountPercent: 0,
      },
      {
        partName: 'Reflektor LED prawy',
        partNumber: '3G1941036',
        qualityCode: 'PJ',         // Zastosowany tani zamiennik zamiast O
        basePriceNet: 1200.0,
        depreciationPercent: 0,
        discountPercent: 0,
        originalPartEquivalentPriceNet: 2400.0, // Różnica 1200 zł
      },
    ],
    paintMaterials: {
      baseAmountNet: 800.0,
      discountPercent: 33.0,      // Potrącenie 33% na lakierze (264 zł)
    },
    undisputedAmountNet: 3500.0,
    vatRate: 0.23,
  };

  it('powinien poprawnie wykryć stawkę referencyjną dla województwa mazowieckiego', () => {
    const benchmark = getRegionalBenchmark('mazowieckie');
    expect(benchmark.recommendedRateNet).toBe(165.0);
    expect(benchmark.voivodeship).toBe('mazowieckie');
  });

  it('powinien precyzyjnie wyliczyć zaniżenie stawki roboczogodziny (RBH)', () => {
    const report = runAudit(sampleEstimate);
    const laborViolation = report.violations.find(v => v.type === 'UNDERSTATED_LABOR_RATE');

    expect(laborViolation).toBeDefined();
    // 20 godzin * (165 zł benchmark - 75 zł przyjęte) = 20 * 90 zł = 1800 zł netto
    expect(laborViolation?.lossNet).toBe(1800.0);
    expect(laborViolation?.lossGross).toBe(2214.0); // 1800 * 1.23
    expect(laborViolation?.legalBasis).toContain('Rekomendacja 15 KNF');
  });

  it('powinien precyzyjnie wykryć i wyliczyć bezprawne potrącenie amortyzacyjne części', () => {
    const report = runAudit(sampleEstimate);
    const partViolation = report.violations.find(v => v.type === 'ILLEGAL_PART_DEPRECIATION');

    expect(partViolation).toBeDefined();
    // 1800 zł * 40% = 720 zł netto
    expect(partViolation?.lossNet).toBe(720.0);
    expect(partViolation?.lossGross).toBe(885.6); // 720 * 1.23
    expect(partViolation?.legalBasis).toContain('III CZP 80/11');
    expect(partViolation?.legalBasis).toContain('Rekomendacja 17 KNF');
  });

  it('powinien wykryć nieuzasadnione narzucenie zamiennika PJ i wyliczyć różnicę do części O', () => {
    const report = runAudit(sampleEstimate);
    const subViolation = report.violations.find(v => v.type === 'UNJUSTIFIED_PART_SUBSTITUTION');

    expect(subViolation).toBeDefined();
    // 2400 zł oryginał - 1200 zł zamiennik = 1200 zł netto
    expect(subViolation?.lossNet).toBe(1200.0);
    expect(subViolation?.lossGross).toBe(1476.0); // 1200 * 1.23
    expect(subViolation?.legalBasis).toContain('Rekomendacja 16 KNF');
  });

  it('powinien wyliczyć bezprawne potrącenie rabatu na materiałach lakierniczych', () => {
    const report = runAudit(sampleEstimate);
    const paintViolation = report.violations.find(v => v.type === 'PAINT_MATERIAL_DISCOUNT');

    expect(paintViolation).toBeDefined();
    // 800 zł * 33% = 264 zł netto
    expect(paintViolation?.lossNet).toBe(264.0);
    expect(paintViolation?.lossGross).toBe(324.72); // 264 * 1.23
  });

  it('powinien poprawnie obliczyć podsumowanie finansowe (Suma netto i brutto)', () => {
    const report = runAudit(sampleEstimate);

    // Suma netto: 1800 (rbh) + 720 (amortyzacja) + 1200 (zamiennik) + 264 (lakier) = 3984 zł netto
    expect(report.summary.totalLossNet).toBe(3984.0);
    // Suma brutto: 3984 * 1.23 = 4900.32 zł brutto
    expect(report.summary.totalLossGross).toBe(4900.32);

    // Wypłacona kwota bezsporna netto = 3500 zł -> fair amount netto = 3500 + 3984 = 7484 zł
    expect(report.summary.fairAmountNet).toBe(7484.0);
    expect(report.summary.fairAmountGross).toBe(9205.32);
    expect(report.summary.benchmarkLaborRateNet).toBe(165.0);
    expect(report.summary.appliedLaborRateNet).toBe(75.0);
  });

  it('powinien wygenerować kompletne formalne wezwanie do zapłaty z rygorem 30 dni', () => {
    const report = runAudit(sampleEstimate);
    const letter = generateDemandLetter(report, {
      claimantName: 'Jan Kowalski',
      claimantAddress: 'ul. Marszałkowska 10/12, 00-001 Warszawa',
      bankAccountNumber: '12 1020 1026 0000 1234 5678 9012',
    });

    expect(letter).toContain('PRZEDSĄDOWE WEZWANIE DO ZAPŁATY');
    expect(letter).toContain('FORMALNA REKLAMACJA');
    expect(letter).toContain('SZK/2026/09/88219');
    expect(letter).toContain('4900.32 PLN brutto');
    expect(letter).toContain('12 1020 1026 0000 1234 5678 9012');
    expect(letter).toContain('art. 5 ust. 1');
    expect(letter).toContain('art. 8');
    expect(letter).toContain('30 dni');
    expect(letter).toContain('Rzecznika Finansowego');
    expect(letter).toContain('Uchwała Sądu Najwyższego z dnia 12 kwietnia 2012 r. (sygn. akt III CZP 80/11)');
    expect(letter).toContain('Rekomendacja 15 KNF');
  });
});
