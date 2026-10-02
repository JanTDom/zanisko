import { Voivodeship } from './types.js';

/**
 * Średnie rynkowe stawki roboczogodziny (netto) w warsztatach niezależnych
 * w podziale na 16 województw Polski.
 *
 * Źródło danych:
 * - Cykliczne analizy stawek rynkowych Polskiej Izby Motoryzacji (PIM)
 * - Raporty Rzecznika Finansowego dotyczące stawek napraw powypadkowych
 * - Wytyczne i orzecznictwo sądów powszechnych
 */
export interface RegionalLaborBenchmark {
  voivodeship: Voivodeship;
  displayName: string;
  recommendedRateNet: number; // Stawka referencyjna netto za roboczogodzinę (PLN)
  sourceNotes: string;
}

export const REGIONAL_BENCHMARKS: Record<Voivodeship, RegionalLaborBenchmark> = {
  mazowieckie: {
    voivodeship: 'mazowieckie',
    displayName: 'Województwo mazowieckie',
    recommendedRateNet: 165.0,
    sourceNotes: 'Średnia stawka warsztatów rzemieślniczych i niezależnych PIM (aglomeracja warszawska i region)',
  },
  slaskie: {
    voivodeship: 'slaskie',
    displayName: 'Województwo śląskie',
    recommendedRateNet: 155.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych aglomeracji górnośląskiej',
  },
  malopolskie: {
    voivodeship: 'malopolskie',
    displayName: 'Województwo małopolskie',
    recommendedRateNet: 155.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Kraków i subregiony)',
  },
  wielkopolskie: {
    voivodeship: 'wielkopolskie',
    displayName: 'Województwo wielkopolskie',
    recommendedRateNet: 155.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Poznań i subregiony)',
  },
  dolnoslaskie: {
    voivodeship: 'dolnoslaskie',
    displayName: 'Województwo dolnośląskie',
    recommendedRateNet: 160.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Wrocław i subregiony)',
  },
  pomorskie: {
    voivodeship: 'pomorskie',
    displayName: 'Województwo pomorskie',
    recommendedRateNet: 155.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Trójmiasto i subregiony)',
  },
  lodzkie: {
    voivodeship: 'lodzkie',
    displayName: 'Województwo łódzkie',
    recommendedRateNet: 150.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Łódź i subregiony)',
  },
  kujawsko_pomorskie: {
    voivodeship: 'kujawsko-pomorskie',
    displayName: 'Województwo kujawsko-pomorskie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  zachodniopomorskie: {
    voivodeship: 'zachodniopomorskie',
    displayName: 'Województwo zachodniopomorskie',
    recommendedRateNet: 150.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych (Szczecin i region)',
  },
  lubelskie: {
    voivodeship: 'lubelskie',
    displayName: 'Województwo lubelskie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  podkarpackie: {
    voivodeship: 'podkarpackie',
    displayName: 'Województwo podkarpackie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  swietokrzyskie: {
    voivodeship: 'swietokrzyskie',
    displayName: 'Województwo świętokrzyskie',
    recommendedRateNet: 140.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  podlaskie: {
    voivodeship: 'podlaskie',
    displayName: 'Województwo podlaskie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  lubuskie: {
    voivodeship: 'lubuskie',
    displayName: 'Województwo lubuskie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  warminsko_mazurskie: {
    voivodeship: 'warminsko-mazurskie',
    displayName: 'Województwo warmińsko-mazurskie',
    recommendedRateNet: 140.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
  opolskie: {
    voivodeship: 'opolskie',
    displayName: 'Województwo opolskie',
    recommendedRateNet: 145.0,
    sourceNotes: 'Średnia stawka warsztatów niezależnych',
  },
} as const;

export function getRegionalBenchmark(voivodeship: Voivodeship): RegionalLaborBenchmark {
  const normalizedKey = (
    voivodeship === 'kujawsko-pomorskie' ? 'kujawsko_pomorskie' :
    voivodeship === 'warminsko-mazurskie' ? 'warminsko_mazurskie' :
    voivodeship
  ) as keyof typeof REGIONAL_BENCHMARKS;

  const benchmark = REGIONAL_BENCHMARKS[normalizedKey];
  if (!benchmark) {
    // Bezpieczny fallback ogólnopolski
    return {
      voivodeship,
      displayName: 'Średnia ogólnopolska',
      recommendedRateNet: 150.0,
      sourceNotes: 'Uśredniona stawka referencyjna PIM dla warsztatów niezależnych w Polsce',
    };
  }
  return benchmark;
}
