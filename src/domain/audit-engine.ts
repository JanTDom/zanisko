import {
  CostEstimate,
  AuditReport,
  AuditViolation,
  AuditSummary,
} from './types.js';
import { getRegionalBenchmark } from './regional-rates.js';

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministyczny silnik audytowy kosztorysów ubezpieczeniowych ClaimCheck.
 * Opiera się na twardych wytycznych KNF (z 1 listopada 2022 r.) oraz orzecznictwie SN.
 */
export function runAudit(estimate: CostEstimate): AuditReport {
  const violations: AuditViolation[] = [];
  const vatMultiplier = 1 + estimate.vatRate;

  // 1. Audyt Robocizny (Rekomendacja 15 KNF)
  const regionalBenchmark = getRegionalBenchmark(estimate.header.voivodeship);
  const benchmarkRate = regionalBenchmark.recommendedRateNet;

  const totalHours =
    estimate.labor.sheetMetalHours +
    estimate.labor.paintHours +
    (estimate.labor.mechanicalHours ?? 0);

  // Średnia ważona stawki przyjętej przez ubezpieczyciela
  const appliedLaborSum =
    estimate.labor.sheetMetalHours * estimate.labor.sheetMetalRateNet +
    estimate.labor.paintHours * estimate.labor.paintRateNet +
    (estimate.labor.mechanicalHours ?? 0) * (estimate.labor.mechanicalRateNet ?? estimate.labor.sheetMetalRateNet);

  const appliedAverageRate = totalHours > 0 ? appliedLaborSum / totalHours : estimate.labor.sheetMetalRateNet;

  if (appliedAverageRate < benchmarkRate && totalHours > 0) {
    const fairLaborSum = totalHours * benchmarkRate;
    const laborLossNet = round2(fairLaborSum - appliedLaborSum);
    const laborLossGross = round2(laborLossNet * vatMultiplier);

    violations.push({
      type: 'UNDERSTATED_LABOR_RATE',
      title: 'Zaniżenie stawki za roboczogodzinę (RBH)',
      legalBasis:
        'Rekomendacja 15 KNF z dnia 1 listopada 2022 r. oraz art. 361 § 2 i art. 363 § 1 k.c.',
      description:
        `Ubezpieczyciel przyjął stawkę uśrednioną na poziomie ${round2(appliedAverageRate).toFixed(2)} zł/rbh netto ` +
        `(blacharz: ${estimate.labor.sheetMetalRateNet} zł, lakiernik: ${estimate.labor.paintRateNet} zł). ` +
        `Średnia stawka rynkowa dla warsztatów niezależnych w ${regionalBenchmark.displayName} wynosi ${benchmarkRate.toFixed(2)} zł/rbh netto ` +
        `(${regionalBenchmark.sourceNotes}). Łączny wymiar naprawy: ${totalHours.toFixed(1)} rbh.`,
      lossNet: laborLossNet,
      lossGross: laborLossGross,
      affectedItems: [
        `Prace blacharskie: ${estimate.labor.sheetMetalHours} rbh (stawka: ${estimate.labor.sheetMetalRateNet} zł)`,
        `Prace lakiernicze: ${estimate.labor.paintHours} rbh (stawka: ${estimate.labor.paintRateNet} zł)`,
      ],
    });
  }

  // 2. Audyt Amortyzacji / Urealnienia Części Zamiennych (Uchwała SN III CZP 80/11 & Rekomendacja 17 KNF)
  let totalPartDepreciationLossNet = 0;
  const depreciatedParts: string[] = [];

  for (const part of estimate.parts) {
    if (part.depreciationPercent > 0) {
      const deductionAmount = part.basePriceNet * (part.depreciationPercent / 100);
      totalPartDepreciationLossNet += deductionAmount;
      depreciatedParts.push(
        `${part.partName} (${part.partNumber}): cena bazowa ${part.basePriceNet.toFixed(2)} zł, potrącenie amortyzacyjne -${part.depreciationPercent}% (obcięto: ${round2(deductionAmount).toFixed(2)} zł netto)`
      );
    }
  }

  if (totalPartDepreciationLossNet > 0) {
    const lossNet = round2(totalPartDepreciationLossNet);
    const lossGross = round2(lossNet * vatMultiplier);

    violations.push({
      type: 'ILLEGAL_PART_DEPRECIATION',
      title: 'Bezprawne potrącenie amortyzacyjne (tzw. urealnienie części)',
      legalBasis:
        'Uchwała Sądu Najwyższego z dnia 12 kwietnia 2012 r. (sygn. akt III CZP 80/11) oraz Rekomendacja 17 KNF',
      description:
        `Ubezpieczyciel bezprawnie obniżył wartość części zamiennych o stopień amortyzacji ze względu na wiek pojazdu. ` +
        `Zgodnie z ugruntowaną uchwałą SN III CZP 80/11 zakład ubezpieczeń ma obowiązek pokryć pełen koszt nowych części niezbędnych do naprawy, ` +
        `chyba że wykaże, iż montaż nowych części doprowadził do wzrostu wartości rynkowej pojazdu jako całości (ciężar dowodu spoczywa na ubezpieczycielu).`,
      lossNet,
      lossGross,
      affectedItems: depreciatedParts,
    });
  }

  // 3. Audyt Narzucenia Zamienników Najniższej Jakości PJ (Rekomendacja 16 KNF)
  let totalSubstitutionLossNet = 0;
  const substitutedParts: string[] = [];

  for (const part of estimate.parts) {
    if ((part.qualityCode === 'PJ' || part.qualityCode === 'P') && part.originalPartEquivalentPriceNet) {
      const priceDifference = part.originalPartEquivalentPriceNet - part.basePriceNet;
      if (priceDifference > 0) {
        totalSubstitutionLossNet += priceDifference;
        substitutedParts.push(
          `${part.partName} (${part.partNumber}): zamiennik ${part.qualityCode} (${part.basePriceNet.toFixed(2)} zł) zamiast oryginału O (${part.originalPartEquivalentPriceNet.toFixed(2)} zł), różnica: ${round2(priceDifference).toFixed(2)} zł netto`
        );
      }
    }
  }

  if (totalSubstitutionLossNet > 0) {
    const lossNet = round2(totalSubstitutionLossNet);
    const lossGross = round2(lossNet * vatMultiplier);

    violations.push({
      type: 'UNJUSTIFIED_PART_SUBSTITUTION',
      title: 'Nieuprawnione narzucenie zamienników nieoryginalnych (kod PJ/P)',
      legalBasis:
        'Rekomendacja 16 KNF z dnia 1 listopada 2022 r. oraz art. 361 § 2 k.c.',
      description:
        `Ubezpieczyciel jednostronnie zastosował w kosztorysie zamienniki o niepotwierdzonym pochodzeniu i jakości (kategoria PJ/P). ` +
        `Poszkodowany ma prawo żądać przywrócenia pojazdu do stanu sprzed szkody na częściach oryginalnych (kategoria O lub Q), ` +
        `jeżeli pojazd był w takie wyposażony przed zdarzeniem.`,
      lossNet,
      lossGross,
      affectedItems: substitutedParts,
    });
  }

  // 4. Audyt Potrąceń na Materiałach Lakierniczych
  if (estimate.paintMaterials.discountPercent > 0 && estimate.paintMaterials.baseAmountNet > 0) {
    const discountAmount =
      estimate.paintMaterials.baseAmountNet * (estimate.paintMaterials.discountPercent / 100);
    const lossNet = round2(discountAmount);
    const lossGross = round2(lossNet * vatMultiplier);

    violations.push({
      type: 'PAINT_MATERIAL_DISCOUNT',
      title: 'Arbitralne potrącenie na materiałach lakierniczych',
      legalBasis:
        'Rekomendacje KNF dotyczące rzetelności kosztorysów oraz art. 361 § 2 k.c.',
      description:
        `Ubezpieczyciel zastosował nieuzasadniony rabat handlowy na materiałach lakierniczych w wysokości ${estimate.paintMaterials.discountPercent}%. ` +
        `Poszkodowany likwidujący szkodę nie jest zobowiązany do poszukiwania warsztatu udzielającego hipotetycznych upustów na materiałach bazowych i lakierach.`,
      lossNet,
      lossGross,
      affectedItems: [
        `Wartość materiału: ${estimate.paintMaterials.baseAmountNet.toFixed(2)} zł, potrącony rabat: ${estimate.paintMaterials.discountPercent}% (obcięto: ${lossNet.toFixed(2)} zł netto)`,
      ],
    });
  }

  // Zliczenie sumaryczne
  const totalLossNet = round2(violations.reduce((acc, v) => acc + v.lossNet, 0));
  const totalLossGross = round2(violations.reduce((acc, v) => acc + v.lossGross, 0));
  const fairAmountNet = round2(estimate.undisputedAmountNet + totalLossNet);
  const fairAmountGross = round2(fairAmountNet * vatMultiplier);
  const undisputedAmountGross = round2(estimate.undisputedAmountNet * vatMultiplier);

  const summary: AuditSummary = {
    undisputedAmountNet: estimate.undisputedAmountNet,
    undisputedAmountGross,
    totalLossNet,
    totalLossGross,
    fairAmountNet,
    fairAmountGross,
    benchmarkLaborRateNet: benchmarkRate,
    appliedLaborRateNet: round2(appliedAverageRate),
  };

  return {
    header: estimate.header,
    summary,
    violations,
    auditedAt: new Date().toISOString(),
  };
}
