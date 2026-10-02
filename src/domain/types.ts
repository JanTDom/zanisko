/**
 * Domena audytu kosztorysów ubezpieczeniowych ClaimCheck.
 * Ścisłe typy i kontrakty danych uwzględniające markę, model, rocznik i segment pojazdu.
 */

export type Voivodeship =
  | 'dolnoslaskie'
  | 'kujawsko-pomorskie'
  | 'lubelskie'
  | 'lubuskie'
  | 'lodzkie'
  | 'malopolskie'
  | 'mazowieckie'
  | 'opolskie'
  | 'podkarpackie'
  | 'podlaskie'
  | 'pomorskie'
  | 'slaskie'
  | 'swietokrzyskie'
  | 'warminsko-mazurskie'
  | 'wielkopolskie'
  | 'zachodniopomorskie';

export type PartQualityCode = 'O' | 'Q' | 'PC' | 'PJ' | 'P';

export type VehicleSegment = 'POPULAR' | 'PREMIUM' | 'LUXURY';

export interface EstimateHeader {
  claimNumber: string;         // Numer szkody (np. PL/PZU/2026/09/99120)
  insurerName: string;         // Nazwa ubezpieczyciela (np. PZU S.A., Warta S.A.)
  vehicleMakeModel: string;    // Marka i model (np. Toyota Corolla 1.8 Hybrid)
  vehicleSegment: VehicleSegment; // Segment rynkowy pojazdu (Popular / Premium / Luxury)
  productionYear: number;      // Rok produkcji pojazdu
  registrationNumber: string;  // Numer rejestracyjny pojazdu
  damageDate: string;          // Data kolizji (YYYY-MM-DD)
  voivodeship: Voivodeship;    // Województwo poszkodowanego
  injuredPartyName?: string;   // Imię i nazwisko / nazwa poszkodowanego
  injuredPartyAddress?: string;// Adres poszkodowanego
}

export interface EstimateLabor {
  sheetMetalRateNet: number;   // Przyjęta stawka rbh blacharskiej (netto)
  paintRateNet: number;        // Przyjęta stawka rbh lakierniczej (netto)
  mechanicalRateNet?: number;  // Przyjęta stawka rbh mechanicznej (netto)
  sheetMetalHours: number;     // Liczba roboczogodzin blacharskich
  paintHours: number;          // Liczba roboczogodzin lakierniczych
  mechanicalHours?: number;    // Liczba roboczogodzin mechanicznych
}

export interface EstimatePartItem {
  partName: string;            // Nazwa części (np. Zderzak przedni, Reflektor LED prawy)
  partNumber: string;          // Numer katalogowy części
  qualityCode: PartQualityCode;// Kod jakości (O - oryginał, Q - jakość O bez logo, PJ/P - tani zamiennik)
  basePriceNet: number;        // Wycena bazowa części netto
  depreciationPercent: number; // Zastosowane potrącenie amortyzacyjne / urealnienie (%)
  discountPercent: number;     // Zastosowany rabat handlowy (%)
  originalPartEquivalentPriceNet?: number; // Cena części oryginalnej jeśli wstawiono PJ
}

export interface EstimatePaintMaterials {
  baseAmountNet: number;       // Wartość materiałów lakierniczych netto
  discountPercent: number;     // Zastosowane potrącenie / rabat handlowy ubezpieczyciela (%)
}

export interface CostEstimate {
  header: EstimateHeader;
  labor: EstimateLabor;
  parts: EstimatePartItem[];
  paintMaterials: EstimatePaintMaterials;
  undisputedAmountNet: number; // Przyznana kwota bezsporna netto
  vatRate: number;             // Stawka VAT (domyślnie 0.23 dla osób fizycznych / nievatowców)
}

export type ViolationType =
  | 'UNDERSTATED_LABOR_RATE'
  | 'ILLEGAL_PART_DEPRECIATION'
  | 'UNJUSTIFIED_PART_SUBSTITUTION'
  | 'PAINT_MATERIAL_DISCOUNT'
  | 'WARRANTY_LOSS_RISK';

export interface AuditViolation {
  type: ViolationType;
  title: string;
  legalBasis: string;          // Podstawa prawna (KNF, SN, KC)
  description: string;
  lossNet: number;
  lossGross: number;
  affectedItems?: string[];
}

export interface AuditSummary {
  undisputedAmountNet: number;
  undisputedAmountGross: number;
  totalLossNet: number;
  totalLossGross: number;
  fairAmountNet: number;
  fairAmountGross: number;
  benchmarkLaborRateNet: number;
  appliedLaborRateNet: number;
  vehicleAgeYears: number;
  isWarrantyProtected: boolean;
}

export interface AuditReport {
  header: EstimateHeader;
  summary: AuditSummary;
  violations: AuditViolation[];
  auditedAt: string;
}
