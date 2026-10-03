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
 * Uwzględnia markę, model, rocznik pojazdu, segment rynkowy oraz wiek auta w odniesieniu
 * do Rekomendacji KNF (z 1 listopada 2022 r.) i uchwały Sądu Najwyższego III CZP 80/11.
 */
export function runAudit(estimate: CostEstimate): AuditReport {
  const violations: AuditViolation[] = [];
  const vatMultiplier = 1 + estimate.vatRate;
  const currentYear = new Date().getFullYear();
  const vehicleAgeYears = Math.max(0, currentYear - (estimate.header.productionYear || currentYear));
  const isWarrantyProtected = vehicleAgeYears <= 3;

  // 1. Audyt Robocizny z uwzględnieniem regionu i segmentu marki (Rekomendacja 15 KNF)
  const regionalBenchmark = getRegionalBenchmark(
    estimate.header.voivodeship,
    estimate.header.vehicleSegment
  );
  const benchmarkRate = regionalBenchmark.recommendedRateNet;

  const totalHours =
    estimate.labor.sheetMetalHours +
    estimate.labor.paintHours +
    (estimate.labor.mechanicalHours ?? 0);

  const appliedLaborSum =
    estimate.labor.sheetMetalHours * estimate.labor.sheetMetalRateNet +
    estimate.labor.paintHours * estimate.labor.paintRateNet +
    (estimate.labor.mechanicalHours ?? 0) * (estimate.labor.mechanicalRateNet ?? estimate.labor.sheetMetalRateNet);

  const appliedAverageRate = totalHours > 0 ? appliedLaborSum / totalHours : estimate.labor.sheetMetalRateNet;

  if (appliedAverageRate < benchmarkRate && totalHours > 0) {
    const fairLaborSum = totalHours * benchmarkRate;
    const laborLossNet = round2(fairLaborSum - appliedLaborSum);
    const laborLossGross = round2(laborLossNet * vatMultiplier);

    const segmentInfo =
      estimate.header.vehicleSegment === 'PREMIUM'
        ? ` jako pojazd segmentu Premium (${estimate.header.vehicleMakeModel}) wymaga wyższych reżimów technologicznych (kalibracja systemów ADAS, technologie spajania stopów lekkich)`
        : '';

    violations.push({
      type: 'UNDERSTATED_LABOR_RATE',
      title: 'Zaniżenie stawki za roboczogodzinę (RBH)',
      legalBasis:
        'Rekomendacja 15 KNF z dnia 1 listopada 2022 r. oraz art. 361 § 2 i art. 363 § 1 k.c.',
      description:
        `Ubezpieczyciel przyjął stawkę uśrednioną na poziomie ${round2(appliedAverageRate).toFixed(2)} zł/rbh netto ` +
        `(blacharz: ${estimate.labor.sheetMetalRateNet.toFixed(2)} zł, lakiernik: ${estimate.labor.paintRateNet.toFixed(2)} zł). ` +
        `Średnia stawka rynkowa dla certyfikowanych warsztatów w ${regionalBenchmark.displayName} wynosi ${benchmarkRate.toFixed(2)} zł/rbh netto ` +
        `(${regionalBenchmark.sourceNotes}). Pojazd poszkodowanego${segmentInfo}. Łączny wymiar naprawy: ${totalHours.toFixed(1)} rbh.`,
      lossNet: laborLossNet,
      lossGross: laborLossGross,
      affectedItems: [
        `Prace blacharskie: ${estimate.labor.sheetMetalHours} rbh (stawka przyjęta: ${estimate.labor.sheetMetalRateNet.toFixed(2)} zł/h, referencyjna: ${benchmarkRate.toFixed(2)} zł/h)`,
        `Prace lakiernicze: ${estimate.labor.paintHours} rbh (stawka przyjęta: ${estimate.labor.paintRateNet.toFixed(2)} zł/h, referencyjna: ${benchmarkRate.toFixed(2)} zł/h)`,
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
      title: 'Bezprawne potrącenie amortyzacyjne (tzw. urealnienie części ze względu na rocznik)',
      legalBasis:
        'Uchwała Sądu Najwyższego z dnia 12 kwietnia 2012 r. (sygn. akt III CZP 80/11) oraz Rekomendacja 17 KNF',
      description:
        `Ubezpieczyciel bezprawnie obniżył wartość części zamiennych o stopień amortyzacji z uwagi na wiek auta (${vehicleAgeYears} lat, rocznik ${estimate.header.productionYear}). ` +
        `Zgodnie z ugruntowaną uchwałą SN III CZP 80/11 zakład ubezpieczeń ma obowiązek pokryć pełen koszt nowych części niezbędnych do naprawy. ` +
        `Potrącenie z uwagi na wiek jest dopuszczalne wyłącznie wtedy, gdy ubezpieczyciel w konkretnym przypadku wykaże wzrost wartości rynkowej pojazdu jako całości (ciężar dowodu spoczywa na ubezpieczycielu).`,
      lossNet,
      lossGross,
      affectedItems: depreciatedParts,
    });
  }

  // 3. Audyt Doboru Części i Ryzyka Utraty Gwarancji (Rekomendacja 18 KNF)
  let totalSubstitutionLossNet = 0;
  const substitutedParts: string[] = [];

  for (const part of estimate.parts) {
    if ((part.qualityCode === 'PJ' || part.qualityCode === 'P') && part.originalPartEquivalentPriceNet) {
      const priceDifference = part.originalPartEquivalentPriceNet - part.basePriceNet;
      if (priceDifference > 0) {
        totalSubstitutionLossNet += priceDifference;
        substitutedParts.push(
          `${part.partName} (${part.partNumber}): narzucono zamiennik ${part.qualityCode} (${part.basePriceNet.toFixed(2)} zł) zamiast części oryginalnej O (${part.originalPartEquivalentPriceNet.toFixed(2)} zł), zaniżenie: ${round2(priceDifference).toFixed(2)} zł netto`
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
        'Rekomendacja 18 KNF z dnia 1 listopada 2022 r. oraz art. 361 § 2 k.c.',
      description:
        `Ubezpieczyciel jednostronnie zastosował w kosztorysie zamienniki o niepotwierdzonym pochodzeniu i jakości (kategoria PJ/P). ` +
        `Poszkodowany ma prawo żądać przywrócenia pojazdu do stanu sprzed szkody na częściach oryginalnych (kategoria O lub Q), ` +
        `jeżeli pojazd był w takie wyposażony przed zdarzeniem.`,
      lossNet,
      lossGross,
      affectedItems: substitutedParts,
    });
  }

  // Dodatkowe ostrzeżenie gwarancyjne dla aut do 3 lat
  if (isWarrantyProtected && substitutedParts.length > 0) {
    violations.push({
      type: 'WARRANTY_LOSS_RISK',
      title: 'Ryzyko utraty gwarancji fabrycznej producenta pojazdu',
      legalBasis:
        'Rekomendacja 18 KNF (pkt 18.1) oraz art. 361 k.c.',
      description:
        `Pojazd poszkodowanego (rocznik ${estimate.header.productionYear}, wiek: ${vehicleAgeYears} lat) znajduje się w okresie ochrony gwarancyjnej producenta (${estimate.header.vehicleMakeModel}). ` +
        `Zastosowanie nieautoryzowanych zamienników dystrybutorskich w miejsce części OEM skutkuje utratą gwarancji na powłokę lakierniczą, perforację blach oraz komponenty współpracujące, za co ubezpieczyciel ponosi bezpośrednią odpowiedzialność odszkodowawczą.`,
      lossNet: 0,
      lossGross: 0,
      affectedItems: ['Status pojazdu: w okresie ochrony gwarancyjnej'],
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
        'Rekomendacja 17 KNF (pkt 17.3 – zakaz powoływania się na rabaty warsztatów współpracujących) oraz art. 361 § 2 k.c.',
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
    vehicleAgeYears,
    isWarrantyProtected,
  };

  return {
    header: estimate.header,
    summary,
    violations,
    auditedAt: new Date().toISOString(),
  };
}
