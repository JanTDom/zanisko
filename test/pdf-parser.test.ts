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

  const demoTabularText = `
KOSZTORYS NAPRAWY POWYPADKOWEJ
DOKUMENT DEMONSTRACYJNY - DANE FIKCYJNE
Nr szkody DEMO/2026/10/00317 Data kalkulacji 03.10.2026
Rodzaj szkody komunikacyjna - OC Status kalkulacja wstępna
Dane pojazdu
Marka / model Škoda Octavia III FL Rok produkcji 2019
Wersja 1.5 TSI 150 KM, liftback Przebieg 86 420 km
VIN TMBDE7NE0K0DEMO19 Nr rej. WX 7DEMO

Opis uszkodzeń przyjętych do kalkulacji
1. Zderzak przedni - pęknięcie i odkształcenie po lewej stronie
2. Reflektor lewy - pęknięty klosz / uszkodzone mocowania
3. Błotnik przedni lewy - wgniecenie i przetarcia lakieru

Części i materiały
Poz. Część Ilość Cena jedn. Wartość
1 Zderzak przedni 1 280,00 zł 280,00 zł
2 Reflektor przedni lewy 1 390,00 zł 390,00 zł
3 Błotnik przedni lewy 1 160,00 zł 160,00 zł
4 Prowadnica zderzaka L 1 38,00 zł 38,00 zł
5 Nadkole przednie L 1 55,00 zł 55,00 zł
6 Spinki / elementy montażowe 1 30,00 zł 30,00 zł
Suma części: 953,00 zł

Robocizna blacharska i mechaniczna
Operacja RBG Stawka Wartość
Demontaż / montaż zderzaka przedniego 1,2 35,00 zł 42,00 zł
Wymiana reflektora lewego 0,6 35,00 zł 21,00 zł
Wymiana błotnika przedniego lewego 1,5 35,00 zł 52,50 zł
Naprawa lokalna narożnika maski 1,2 35,00 zł 42,00 zł
Dopasowanie elementów / kontrola szczelin 0,8 35,00 zł 28,00 zł

Lakierowanie
Operacja RBG Stawka Materiały Wartość
Zderzak przedni - lakierowanie 2,2 35,00 zł 90,00 zł 167,00 zł
Błotnik przedni lewy - lakierowanie 1,8 35,00 zł 80,00 zł 143,00 zł
Maska - lakierowanie miejscowe 1,5 35,00 zł 70,00 zł 122,50 zł

Części 953,00 zł
Robocizna blacharsko-mechaniczna 185,50 zł
Lakierowanie + materiały lakiernicze 432,50 zł
Pozostałe materiały / czynności 55,00 zł
Razem netto 1 626,00 zł
VAT 23% 373,98 zł
RAZEM BRUTTO 1 999,98 zł
`;

  it('powinien poprawnie sparsować kosztorys tabelaryczny i wykryć zaniżenie stawki do 35 zł oraz zamienniki', () => {
    const result = parser.parseText(demoTabularText, 'mazowieckie');

    expect(result.estimate.header.claimNumber).toBe('DEMO/2026/10/00317');
    expect(result.estimate.header.vehicleMakeModel).toBe('Škoda Octavia III FL');
    expect(result.estimate.header.productionYear).toBe(2019);
    expect(result.estimate.header.registrationNumber).toBe('WX 7DEMO');

    // Stawka dumpingowa 35 zł i godziny
    expect(result.estimate.labor.sheetMetalRateNet).toBe(35.0);
    expect(result.estimate.labor.paintRateNet).toBe(35.0);
    expect(result.estimate.labor.sheetMetalHours).toBe(5.3);
    expect(result.estimate.labor.paintHours).toBe(5.5);

    // Części
    expect(result.estimate.parts.length).toBe(6);
    expect(result.estimate.parts[0].partName).toBe('Zderzak przedni');
    expect(result.estimate.parts[0].basePriceNet).toBe(280.0);
    expect(result.estimate.parts[0].qualityCode).toBe('PJ');

    // Kwota bezsporna netto
    expect(result.estimate.undisputedAmountNet).toBe(1626.0);

    // Audyt
    const audit = runAudit(result.estimate);
    expect(audit.violations.length).toBeGreaterThanOrEqual(2);

    const laborViolation = audit.violations.find(v => v.type === 'UNDERSTATED_LABOR_RATE');
    expect(laborViolation).toBeDefined();
    // 10.8 h * (175 - 35) = 1512 zł netto
    expect(laborViolation?.lossNet).toBe(1512.0);

    const partsViolation = audit.violations.find(v => v.type === 'UNJUSTIFIED_PART_SUBSTITUTION');
    expect(partsViolation).toBeDefined();
    expect(partsViolation?.lossNet).toBeGreaterThan(1000.0);

    // Całkowite zaniżenie brutto
    expect(audit.summary.totalLossGross).toBeGreaterThan(3000.0);
  });
});
