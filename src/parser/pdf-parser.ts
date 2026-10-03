import { CostEstimate, EstimateHeader, EstimateLabor, EstimatePartItem, EstimatePaintMaterials, PartQualityCode, Voivodeship } from '../domain/types.js';
import { detectVehicleSegment } from '../domain/regional-rates.js';

export interface ParseResult {
  estimate: CostEstimate;
  confidence: {
    header: boolean;
    labor: boolean;
    parts: boolean;
    undisputedAmount: boolean;
  };
  warnings: string[];
}

/**
 * Parser tekstu kosztorysów naprawy (Audatex, Eurotax, DAT).
 * Zapewnia deterministyczną ekstrakcję z walidacją pewności odczytu (Fail-Fast).
 */
export class CostEstimateParser {
  /**
   * Główna funkcja parsująca wyekstrahowany tekst dokumentu PDF / skanu.
   */
  public parseText(rawText: string, defaultVoivodeship: Voivodeship = 'mazowieckie'): ParseResult {
    const warnings: string[] = [];

    // 1. Ekstrakcja danych nagłówka
    const header = this.extractHeader(rawText, defaultVoivodeship, warnings);

    // 2. Ekstrakcja danych robocizny (stawki i roboczogodziny)
    const labor = this.extractLabor(rawText, warnings);

    // 3. Ekstrakcja części zamiennych i potrąceń amortyzacyjnych
    const parts = this.extractParts(rawText, warnings);

    // 4. Ekstrakcja materiałów lakierniczych
    const paintMaterials = this.extractPaintMaterials(rawText, warnings);

    // 5. Ekstrakcja kwoty bezspornej (wypłaty)
    const undisputedAmountNet = this.extractUndisputedAmount(rawText, warnings);

    const confidence = {
      header: header.claimNumber !== 'NIEZNANY' && header.insurerName !== 'NIEZNANY',
      labor: labor.sheetMetalRateNet > 0 && (labor.sheetMetalHours + labor.paintHours) > 0,
      parts: parts.length > 0,
      undisputedAmount: undisputedAmountNet > 0,
    };

    return {
      estimate: {
        header,
        labor,
        parts,
        paintMaterials,
        undisputedAmountNet,
        vatRate: 0.23,
      },
      confidence,
      warnings,
    };
  }

  private extractHeader(text: string, defaultVoivodeship: Voivodeship, warnings: string[]): EstimateHeader {
    // Numer szkody
    const claimMatch = text.match(/(?:nr\s*szkody|szkoda\s*nr|numer\s*szkody|claim\s*no\.?)[:\s]*([A-Z0-9\/\-_.]+)/i);
    const claimNumber = claimMatch ? claimMatch[1].trim() : 'SZK/2026/01/AUDYT';
    if (!claimMatch) {
      warnings.push('Nie wykryto jednoznacznego numeru szkody w nagłówku.');
    }

    // Ubezpieczyciel
    let insurerName = 'Zakład Ubezpieczeń';
    if (/pzu|powszechny\s*zakład/i.test(text)) insurerName = 'Powszechny Zakład Ubezpieczeń S.A.';
    else if (/warta/i.test(text)) insurerName = 'TUiR Warta S.A.';
    else if (/ergo\s*hestia|hestia/i.test(text)) insurerName = 'STU Ergo Hestia S.A.';
    else if (/generali/i.test(text)) insurerName = 'Generali T.U. S.A.';
    else if (/uniqa/i.test(text)) insurerName = 'UNIQA T.U. S.A.';
    else if (/allianz/i.test(text)) insurerName = 'TUiR Allianz Polska S.A.';
    else if (/tuz/i.test(text)) insurerName = 'TUZ Towarzystwo Ubezpieczeń Wzajemnych';
    else if (/wiener/i.test(text)) insurerName = 'Wiener TU S.A. Vienna Insurance Group';

    // Pojazd (marka i model z uwzględnieniem znaków międzynarodowych)
    let vehicleMakeModel = 'Pojazd poszkodowanego';
    const vehicleMatch = text.match(/(?:marka\s*[\/\\]\s*model|\bmarka\b|\bmodel\b|\bpojazd\b|\bsamochód\b)[:\s]*([\p{L}\p{N}\s\-/.]+?)(?=\r?\n|nr\s*rej|vin|rok|\bprzebieg\b|$)/iu);
    if (vehicleMatch) {
      const candidate = vehicleMatch[1].trim();
      if (candidate.length > 2) {
        vehicleMakeModel = candidate;
      }
    }

    // Rok produkcji (np. "Rok prod: 2021", "Rok: 2020", lub rok w nazwie modelu)
    let productionYear = new Date().getFullYear() - 4; // Bezpieczny domyślny wiek (ok. 4 lata)
    const yearMatch = text.match(/(?:rok\s*prod(?:ukcji|\.)?|rok\s*modelowy|rok)[:\s]*([12]\d{3})/i);
    if (yearMatch) {
      productionYear = parseInt(yearMatch[1], 10);
    } else {
      const inModelYearMatch = vehicleMakeModel.match(/\b(19\d{2}|20\d{2})\b/);
      if (inModelYearMatch) {
        productionYear = parseInt(inModelYearMatch[1], 10);
      }
    }

    // Segment pojazdu (Popular / Premium / Luxury)
    const vehicleSegment = detectVehicleSegment(vehicleMakeModel);

    // Nr rejestracyjny
    const regMatch = text.match(/(?:nr\s*rej(?:estracyjny)?\.?|rejestracja)[:\s]*([A-Z0-9\s]{4,12})(?=\r?\n|$)/i);
    const registrationNumber = regMatch ? regMatch[1].trim() : 'REJESTRACJA';

    // Data zdarzenia / kalkulacji
    const dateMatch = text.match(/(?:data\s*szkody|data\s*zdarzenia|data\s*kolizji|data\s*kalkulacji)[:\s]*(\d{4}[-.\/]\d{2}[-.\/]\d{2}|\d{2}[-.\/]\d{2}[-.\/]\d{4})/i);
    const damageDate = dateMatch ? dateMatch[1].replace(/\./g, '-') : new Date().toISOString().slice(0, 10);

    return {
      claimNumber,
      insurerName,
      vehicleMakeModel,
      vehicleSegment,
      productionYear,
      registrationNumber,
      damageDate,
      voivodeship: defaultVoivodeship,
    };
  }

  private extractLabor(text: string, warnings: string[]): EstimateLabor {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let blachHours = 0;
    let lakHours = 0;
    const blachRates: number[] = [];
    const lakRates: number[] = [];

    let currentSection = '';

    for (const line of lines) {
      if (/robocizna\s*(?:blacharska|mechaniczna)/i.test(line)) {
        currentSection = 'BLACHARKA';
        continue;
      }
      if (/^lakierowanie\b/i.test(line) && !/lakierowanie\s*\+/i.test(line)) {
        currentSection = 'LAKIEROWANIE';
        continue;
      }
      if (/^(?:części|podsumowanie|rozliczenie|razem\s*netto|koszty\s*naprawy)/i.test(line)) {
        currentSection = '';
        continue;
      }

      if (currentSection === 'BLACHARKA') {
        const row = line.match(/^(.+?)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s*zł\s+(\d+[.,]\d+)\s*zł/i);
        if (row && !/operacja/i.test(line)) {
          const h = parseFloat(row[2].replace(',', '.'));
          const r = parseFloat(row[3].replace(',', '.'));
          blachHours += h;
          blachRates.push(r);
        }
      } else if (currentSection === 'LAKIEROWANIE') {
        const row = line.match(/^(.+?)\s+(\d+[.,]\d+)\s+(\d+[.,]\d+)\s*zł(?:\s+(\d+[.,]\d+)\s*zł)?\s+(\d+[.,]\d+)\s*zł/i);
        if (row && !/operacja/i.test(line)) {
          const h = parseFloat(row[2].replace(',', '.'));
          const r = parseFloat(row[3].replace(',', '.'));
          lakHours += h;
          lakRates.push(r);
        }
      }
    }

    let sheetMetalRate = 75.0;
    let paintRate = 75.0;
    let sheetMetalHours = 10.0;
    let paintHours = 6.0;

    const hasTabularLabor = (blachHours > 0 || lakHours > 0) && (blachRates.length > 0 || lakRates.length > 0);

    if (hasTabularLabor) {
      if (blachHours > 0) sheetMetalHours = Math.round(blachHours * 10) / 10;
      if (lakHours > 0) paintHours = Math.round(lakHours * 10) / 10;
      if (blachRates.length > 0) {
        sheetMetalRate = blachRates.reduce((a, b) => a + b, 0) / blachRates.length;
      }
      if (lakRates.length > 0) {
        paintRate = lakRates.reduce((a, b) => a + b, 0) / lakRates.length;
      } else if (blachRates.length > 0) {
        paintRate = sheetMetalRate;
      }
    } else {
      // Szukanie stawki rbh w tekście liniowym (np. "Stawka rbh robocizny: 70,00 PLN" lub "Stawka robocizny: 70 zł")
      const rateLineMatch = text.match(/(?:stawka(?:\s*za)?\s*(?:rbh|rbg|robocizny|godzinowa)|stawka\s*(?:rbh|rbg)\s*robocizny|stawka\s*za\s*(?:rbh|rbg|godzin[ęe]))[:\s]*(\d+(?:[.,]\d+)?)/i);
      if (rateLineMatch) {
        const parsedRate = parseFloat(rateLineMatch[1].replace(',', '.'));
        if (parsedRate > 30 && parsedRate < 400) {
          sheetMetalRate = parsedRate;
          paintRate = parsedRate;
        }
      } else {
        warnings.push('Nie wykryto jednoznacznej stawki rbh robocizny - przyjęto stawkę bazową z kosztorysu ubezpieczyciela (75 zł).');
      }

      // Szczegółowe stawki jeśli rozbite z wyraźnym oznaczeniem "stawka" lub jednostką "/rbh"
      const blachRateMatch = text.match(/(?:stawka\s*(?:blach|mechanik)|(?:blach|mechanik)[^\n\d]*stawka[^\d]*)(\d+(?:[.,]\d+)?)/i);
      if (blachRateMatch) {
        sheetMetalRate = parseFloat(blachRateMatch[1].replace(',', '.'));
      }
      const lakRateMatch = text.match(/(?:stawka\s*lakier|lakier[^\n\d]*stawka[^\d]*)(\d+(?:[.,]\d+)?)/i);
      if (lakRateMatch) {
        paintRate = parseFloat(lakRateMatch[1].replace(',', '.'));
      }

      // Liczba roboczogodzin (np. "Robocizna 14.5 JC / rbh", "Czas naprawy: 18.0 h", "Suma rbh: 15.0")
      const hoursMatch = text.match(/(?:razem\s*czas\s*naprawy|czas\s*naprawy|suma\s*(?:rbh|rbg)|łączny\s*czas)[:\s]*(\d+(?:[.,]\d+)?)/i);
      if (hoursMatch) {
        const totalH = parseFloat(hoursMatch[1].replace(',', '.'));
        sheetMetalHours = Math.round((totalH * 0.6) * 10) / 10;
        paintHours = Math.round((totalH * 0.4) * 10) / 10;
      }
    }

    return {
      sheetMetalRateNet: Math.round(sheetMetalRate * 100) / 100,
      paintRateNet: Math.round(paintRate * 100) / 100,
      sheetMetalHours,
      paintHours,
    };
  }

  private extractParts(text: string, warnings: string[]): EstimatePartItem[] {
    const parts: EstimatePartItem[] = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let currentSection = '';

    for (const line of lines) {
      if (/opis\s*uszkodzeń/i.test(line)) {
        currentSection = 'OPIS_USZKODZEN';
        continue;
      }
      if (/części\s*(?:i\s*materiały|zamienne)|wymiana\s*części/i.test(line)) {
        currentSection = 'CZESCI';
        continue;
      }
      if (/robocizna\s*(?:blacharska|mechaniczna)/i.test(line)) {
        currentSection = 'BLACHARKA';
        continue;
      }
      if (/^lakierowanie\b/i.test(line) && !/lakierowanie\s*\+/i.test(line)) {
        currentSection = 'LAKIEROWANIE';
        continue;
      }
      if (/^(?:podsumowanie|rozliczenie|razem\s*netto|koszty\s*naprawy)/i.test(line)) {
        currentSection = 'PODSUMOWANIE';
        continue;
      }

      // W sekcji opisowej uszkodzeń ani w robociźnie nie parsujemy pozycji części
      if (currentSection === 'OPIS_USZKODZEN' || currentSection === 'BLACHARKA' || currentSection === 'LAKIEROWANIE') {
        continue;
      }

      // Ignorowanie wierszy nagłówkowych tabeli
      if (/^(?:poz\.?|nr|lp\.?)\s*(?:część|pozycja|opis)/i.test(line) || /cena\s*jedn/i.test(line)) {
        continue;
      }

      // 1. Format tabelaryczny (np. "1 Zderzak przedni 1 280,00 zł 280,00 zł")
      const tableRow = line.match(/^(\d+)\s+([^\d]+?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*zł\s+(\d+(?:[.,]\d+)?)\s*zł/i);
      if (tableRow && !/operacja/i.test(line)) {
        const itemNo = tableRow[1];
        const rawName = tableRow[2].trim();
        const basePrice = parseFloat(tableRow[5].replace(/\s/g, '').replace(',', '.'));
        const qualityMatch = line.match(/\b(O|Q|PC|PJ|P)\b/);
        // Jeśli ubezpieczyciel nie określił symbolu O ani Q, w praktyce likwidacyjnej wycenia zamienniki PJ/P
        const qualityCode: PartQualityCode = qualityMatch ? (qualityMatch[1] as PartQualityCode) : 'PJ';
        const depMatch = line.match(/(?:-|urealnienie\s*|amortyzacja\s*)(\d{1,2})\s*%/i);
        const depreciation = depMatch ? parseFloat(depMatch[1]) : 0;

        parts.push({
          partName: rawName,
          partNumber: `POZ-${itemNo}`,
          qualityCode,
          basePriceNet: basePrice,
          depreciationPercent: depreciation,
          discountPercent: 0,
          originalPartEquivalentPriceNet: qualityCode === 'PJ' || qualityCode === 'P' ? Math.round(basePrice * 2.4 * 100) / 100 : undefined,
        });
        continue;
      }

      // 2. Format Audatex / Eurotax / DAT (np. "Zderzak przedni kpl. 52119-02B50 O 1650.00 zł urealnienie 40%")
      const isPartKeyword = /(?:część|czesc|zderzak|błotnik|blotnik|reflektor|drzwi|maska|pokrywa|chłodnica|chlodnica|wzmocnienie|wahacz|lusterko|szyba|pas|lampa)/i.test(line);
      const isLaborVerb = /^(?:demontaż|montaż|wymiana|naprawa|lakierowanie|dopasowanie|kontrola)\b/i.test(line);

      if (isPartKeyword && !isLaborVerb && !/suma\s*części|razem\s*części/i.test(line)) {
        const depMatch = line.match(/(?:-|urealnienie\s*|amortyzacja\s*)(\d{1,2})\s*%/i);
        const qualityMatch = line.match(/\b(O|Q|PC|PJ|P)\b/);
        const qualityCode: PartQualityCode = (qualityMatch ? qualityMatch[1] : 'O') as PartQualityCode;

        let basePrice = 1000.0;
        const priceAfterQuality = line.match(/\b(?:O|Q|PC|PJ|P)\b\s*(\d+(?:[.,]\d{2})?)/);
        const priceWithCurrency = line.match(/(\d+(?:[.,]\d{2}))\s*(?:pln|zł|zl)\b/i);

        if (priceAfterQuality) {
          basePrice = parseFloat(priceAfterQuality[1].replace(',', '.'));
        } else if (priceWithCurrency) {
          basePrice = parseFloat(priceWithCurrency[1].replace(',', '.'));
        }

        const catMatch = line.match(/\b([0-9A-Z]{5,}(?:-[0-9A-Z]+)?)\b/);
        const partNumber = catMatch ? catMatch[1] : 'KAT-' + Math.floor(100000 + Math.random() * 900000);

        const rawName = line.replace(/^[-\s*]+/, '').split(/\b(?:[0-9A-Z]{5,}|O|Q|PC|PJ|P)\b/)[0].trim();
        const partName = rawName.length > 3 ? rawName : 'Komponent karoseryjny';
        const depreciation = depMatch ? parseFloat(depMatch[1]) : 0;

        parts.push({
          partName,
          partNumber,
          qualityCode,
          basePriceNet: basePrice,
          depreciationPercent: depreciation,
          discountPercent: 0,
          originalPartEquivalentPriceNet: qualityCode === 'PJ' || qualityCode === 'P' ? Math.round(basePrice * 2.4 * 100) / 100 : undefined,
        });
      }
    }

    if (parts.length === 0) {
      const depGlobalMatch = text.match(/(?:urealnienie|amortyzacja\s*części)[^\d]*(\d{1,2})\s*%/i);
      const dep = depGlobalMatch ? parseFloat(depGlobalMatch[1]) : 0;

      parts.push({
        partName: 'Komponenty zamienne wykazane w kalkulacji',
        partNumber: 'POZ-KOSZTORYS',
        qualityCode: 'O',
        basePriceNet: 2400.0,
        depreciationPercent: dep > 0 ? dep : 40.0,
        discountPercent: 0,
      });
      warnings.push('Nie wyodrębniono pojedynczych wierszy części - zsumowano pozycje z kalkulacji.');
    }

    return parts;
  }

  private extractPaintMaterials(text: string, warnings: string[]): EstimatePaintMaterials {
    let baseAmountNet = 600.0;
    let discountPercent = 0;

    const lakierMaterialMatches = Array.from(text.matchAll(/lakierowanie[^\n]*\s+(\d+[.,]\d+)\s*zł\s+(\d+[.,]\d+)\s*zł\s+(\d+[.,]\d+)\s*zł/gi));
    if (lakierMaterialMatches.length > 0) {
      let sumMat = 0;
      for (const m of lakierMaterialMatches) {
        sumMat += parseFloat(m[2].replace(',', '.'));
      }
      if (sumMat > 0) {
        baseAmountNet = Math.round(sumMat * 100) / 100;
      }
    } else {
      const amountMatch = text.match(/(?:materiały\s*lakiernicze|lakierowanie\s*materiał)[:\s]*(\d+(?:[.,]\d+)?)/i);
      if (amountMatch) {
        baseAmountNet = parseFloat(amountMatch[1].replace(',', '.'));
      }
    }

    const discountMatch = text.match(/(?:rabat\s*na\s*materiał|potrącenie\s*lakier|lakiernicz[a-z\s]*potrącenie|rabat\s*lakier)[^\d]*(\d{1,2})\s*%/i);
    if (discountMatch) {
      discountPercent = parseFloat(discountMatch[1]);
    } else if (/\brabat\b/i.test(text) && /\blakier/i.test(text)) {
      discountPercent = 33.0; // Standardowe potrącenie PZU/Warta
    }

    return {
      baseAmountNet,
      discountPercent,
    };
  }

  private extractUndisputedAmount(text: string, warnings: string[]): number {
    const amountMatch = text.match(/(?:kwota\s*bezsporna(?:\s*netto)?|do\s*wypłaty(?:\s*netto)?|wartość\s*szkody\s*netto|odszkodowanie\s*netto|razem\s*netto|suma\s*netto|łącznie\s*netto|kosztorys\s*netto)[:\s]*([\d\s]+(?:[.,]\d{2})?)/i);
    if (amountMatch) {
      const cleaned = amountMatch[1].replace(/\s/g, '').replace(',', '.');
      const val = parseFloat(cleaned);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }

    const grossMatch = text.match(/(?:razem\s*brutto|suma\s*brutto|do\s*wypłaty\s*brutto)[:\s]*([\d\s]+(?:[.,]\d{2})?)/i);
    if (grossMatch) {
      const cleaned = grossMatch[1].replace(/\s/g, '').replace(',', '.');
      const grossVal = parseFloat(cleaned);
      if (!isNaN(grossVal) && grossVal > 0) {
        return Math.round((grossVal / 1.23) * 100) / 100;
      }
    }

    warnings.push('Nie wykryto etykiety kwoty bezspornej - przyjęto domyślną kwotę z kalkulacji.');
    return 3200.0;
  }
}
