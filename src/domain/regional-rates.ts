import { Voivodeship, VehicleSegment } from './types.js';

/**
 * Średnie rynkowe stawki roboczogodziny (netto) w warsztatach niezależnych
 * w podziale na 16 województw Polski, zaktualizowane o wskaźniki rynkowe 2026 r.
 * oraz współczynniki technologiczne dla marek premium (Rekomendacja 15 KNF).
 *
 * Źródło danych:
 * - Cykliczne analizy stawek rynkowych Polskiej Izby Motoryzacji (PIM)
 * - Raporty Rzecznika Finansowego dotyczące likwidacji szkód komunikacyjnych
 * - Standardy technologiczne napraw blacharsko-lakierniczych (wymóg kalibracji systemów ADAS, nitowanie i klejenie aluminium)
 */
export interface RegionalLaborBenchmark {
  voivodeship: Voivodeship;
  displayName: string;
  recommendedRateNet: number; // Stawka referencyjna netto za roboczogodzinę (PLN)
  segment: VehicleSegment;
  sourceNotes: string;
}

// Bazowe stawki dla segmentu popularnego (2026 r.)
export const REGIONAL_BENCHMARKS: Record<Voivodeship, { name: string; rate: number; notes: string }> = {
  mazowieckie: {
    name: 'Województwo mazowieckie',
    rate: 175.0,
    notes: 'Średnia stawka warsztatów rzemieślniczych i niezależnych PIM (aglomeracja warszawska i region)',
  },
  slaskie: {
    name: 'Województwo śląskie',
    rate: 165.0,
    notes: 'Średnia stawka warsztatów niezależnych aglomeracji górnośląskiej',
  },
  malopolskie: {
    name: 'Województwo małopolskie',
    rate: 165.0,
    notes: 'Średnia stawka warsztatów niezależnych (Kraków i subregiony)',
  },
  dolnoslaskie: {
    name: 'Województwo dolnośląskie',
    rate: 170.0,
    notes: 'Średnia stawka warsztatów niezależnych (Wrocław i subregiony)',
  },
  wielkopolskie: {
    name: 'Województwo wielkopolskie',
    rate: 165.0,
    notes: 'Średnia stawka warsztatów niezależnych (Poznań i subregiony)',
  },
  pomorskie: {
    name: 'Województwo pomorskie',
    rate: 165.0,
    notes: 'Średnia stawka warsztatów niezależnych (Trójmiasto i subregiony)',
  },
  lodzkie: {
    name: 'Województwo łódzkie',
    rate: 160.0,
    notes: 'Średnia stawka warsztatów niezależnych (Łódź i subregiony)',
  },
  zachodniopomorskie: {
    name: 'Województwo zachodniopomorskie',
    rate: 160.0,
    notes: 'Średnia stawka warsztatów niezależnych (Szczecin i region)',
  },
  'kujawsko-pomorskie': {
    name: 'Województwo kujawsko-pomorskie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  lubelskie: {
    name: 'Województwo lubelskie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  podkarpackie: {
    name: 'Województwo podkarpackie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  swietokrzyskie: {
    name: 'Województwo świętokrzyskie',
    rate: 150.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  podlaskie: {
    name: 'Województwo podlaskie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  lubuskie: {
    name: 'Województwo lubuskie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  'warminsko-mazurskie': {
    name: 'Województwo warmińsko-mazurskie',
    rate: 150.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
  opolskie: {
    name: 'Województwo opolskie',
    rate: 155.0,
    notes: 'Średnia stawka warsztatów niezależnych',
  },
};

// Współczynniki technologiczne dla marek wyższej klasy
const SEGMENT_MULTIPLIERS: Record<VehicleSegment, number> = {
  POPULAR: 1.0,
  PREMIUM: 1.25, // +25% wymóg technologiczny (kalibracja ADAS, technologie spajania aluminium)
  LUXURY: 1.50,  // +50% rygorystyczne normy producenta
};

export function detectVehicleSegment(makeModel: string): VehicleSegment {
  const normalized = makeModel.toLowerCase();

  const luxuryBrands = ['ferrari', 'bentley', 'rolls-royce', 'lamborghini', 'aston martin', 'mclaren', 'maserati'];
  if (luxuryBrands.some(b => normalized.includes(b))) {
    return 'LUXURY';
  }

  const premiumBrands = [
    'bmw', 'mercedes', 'audi', 'porsche', 'lexus', 'volvo', 'land rover', 'range rover',
    'jaguar', 'alfa romeo', 'tesla', 'infiniti', 'ds automobiles'
  ];
  if (premiumBrands.some(b => normalized.includes(b))) {
    return 'PREMIUM';
  }

  return 'POPULAR';
}

export function getRegionalBenchmark(
  voivodeship: Voivodeship,
  segment: VehicleSegment = 'POPULAR'
): RegionalLaborBenchmark {
  const base = REGIONAL_BENCHMARKS[voivodeship] ?? {
    name: 'Średnia ogólnopolska',
    rate: 160.0,
    notes: 'Uśredniona stawka referencyjna PIM dla warsztatów niezależnych w Polsce',
  };

  const multiplier = SEGMENT_MULTIPLIERS[segment] ?? 1.0;
  const recommendedRateNet = Math.round(base.rate * multiplier);

  let sourceNotes = base.notes;
  if (segment === 'PREMIUM') {
    sourceNotes += ' (podwyższona o współczynnik technologiczny segmentu Premium: kalibracja radarów ADAS, technologie spawania i nitowania stopów lekkich)';
  } else if (segment === 'LUXURY') {
    sourceNotes += ' (podwyższona o współczynnik technologiczny segmentu luksusowego)';
  }

  return {
    voivodeship,
    displayName: base.name,
    recommendedRateNet,
    segment,
    sourceNotes,
  };
}
