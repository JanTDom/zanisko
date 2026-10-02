import { AuditReport } from './types.js';

export interface DemandLetterOptions {
  claimantName: string;
  claimantAddress: string;
  bankAccountNumber: string;
  cityAndDate?: string;
}

/**
 * Generator formalnego Przedsądowego Wezwania do Zapłaty / Reklamacji
 * sporządzonego zgodnie z wymogami Ustawy o rozpatrywaniu reklamacji przez podmioty rynku finansowego.
 *
 * Zgodnie z dyrektywą: ZERO GWIAZDEK (brak jakichkolwiek znaków '*' lub '**' w tekście).
 * Układ oparty na klasycznym standardzie kancelarii radcowskiej.
 */
export function generateDemandLetter(
  report: AuditReport,
  options: DemandLetterOptions
): string {
  const currentDate = options.cityAndDate ?? `Warszawa, dnia ${new Date().toLocaleDateString('pl-PL')}`;
  const h = report.header;
  const s = report.summary;

  const segmentDescription =
    h.vehicleSegment === 'PREMIUM'
      ? 'segment Premium (wymóg certyfikowanych technologii naprawczych ADAS i stopów lekkich)'
      : h.vehicleSegment === 'LUXURY'
      ? 'segment luksusowy'
      : 'segment popularny';

  let violationsSections = '';
  report.violations.forEach((v, idx) => {
    const lossText = v.lossGross > 0 ? `kwota roszczenia: ${v.lossGross.toFixed(2)} PLN brutto (${v.lossNet.toFixed(2)} PLN netto)` : 'uchybienie technologiczno-prawne';
    let itemsText = '';
    if (v.affectedItems && v.affectedItems.length > 0) {
      itemsText = '\n   Szczegółowy wykaz pozycji:\n' + v.affectedItems.map(it => `   - ${it}`).join('\n');
    }

    violationsSections += `
${idx + 1}. ${v.title.toUpperCase()}
   Roszczenie: ${lossText}
   Podstawa zarzutu: ${v.legalBasis}
   Uzasadnienie: ${v.description}${itemsText}
`;
  });

  return `${currentDate}

WZYWAJĄCY (POSZKODOWANY):
${options.claimantName}
${options.claimantAddress}

ADRESAT (UBEZPIECZYCIEL):
${h.insurerName}
Departament Likwidacji Szkód Komunikacyjnych


PRZEDSĄDOWE WEZWANIE DO ZAPŁATY
FORMALNA REKLAMACJA
(złożona w trybie art. 3 i art. 5 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego)

Dotyczy:
- Numer szkody ubezpieczyciela: ${h.claimNumber}
- Pojazd poszkodowanego: ${h.vehicleMakeModel} (${h.productionYear}, ${segmentDescription})
- Numer rejestracyjny: ${h.registrationNumber}
- Data zdarzenia: ${h.damageDate}
- Podstawa prawna odpowiedzialności: Odpowiedzialność cywilna sprawcy kolizji (art. 436 § 2 k.c. w zw. z art. 822 § 1 k.c.)


I. WEZWANIE DO ZAPŁATY

Działając jako poszkodowany w powyższej szkodzie komunikacyjnej, niniejszym WZYWAM ${h.insurerName} do natychmiastowej dopłaty bezprawnie zaniżonej części odszkodowania w łącznej kwocie:

${s.totalLossGross.toFixed(2)} PLN BRUTTO
(słownie: kwota wyliczona na podstawie załączonego audytu różnicowego kosztorysu)

Kwotę powyższą należy uiścić w nieprzekraczalnym terminie 14 dni od dnia doręczenia niniejszego wezwania na rachunek bankowy poszkodowanego:
Numer rachunku: ${options.bankAccountNumber}
Tytuł przelewu: Dopłata do odszkodowania - szkoda ${h.claimNumber}

Jednocześnie wskazuję, że dotychczas wypłacona kwota w wysokości ${s.undisputedAmountGross.toFixed(2)} PLN brutto (${s.undisputedAmountNet.toFixed(2)} PLN netto) została przyjęta wyłącznie jako kwota bezsporna w rozumieniu art. 817 § 2 k.c. i nie zaspokaja roszczenia restytucyjnego wynikającego z art. 361 § 2 k.c. i art. 363 § 1 k.c. Pełna, rzetelna wartość naprawy wynosi ${s.fairAmountGross.toFixed(2)} PLN brutto (${s.fairAmountNet.toFixed(2)} PLN netto).


II. WYKAZ ZANIŻEŃ I UZASADNIENIE MERYTORYCZNE

Dokonana przez Państwa kalkulacja naprawy zawiera rażące uchybienia formalne, technologiczne i prawne, naruszające wiążące Rekomendacje Komisji Nadzoru Finansowego (KNF) z dnia 1 listopada 2022 r. oraz orzecznictwo Sądu Najwyższego:
${violationsSections}

III. PODSTAWA PRAWNA ROSZCZENIA

1. Zasada pełnej kompensacji szkody (art. 361 § 2 k.c. i art. 363 § 1 k.c.):
   Odszkodowanie ubezpieczeniowe ma przywrócić pojazd do pełnego stanu używalności sprzed wypadku. Wszelkie arbitralne cięcia stawek robocizny, potrącenia na lakierze lub zaniżanie cen części stanowią bezpośrednie naruszenie prawa.

2. Zakaz potrąceń amortyzacyjnych ze względu na rocznik pojazdu (Uchwała SN III CZP 80/11):
   Sąd Najwyższy jednoznacznie orzekł, że ubezpieczyciel nie ma prawa dokonywać potrąceń amortyzacyjnych z cen nowych części zamiennych, chyba że w konkretnym procesie udowodni wzrost wartości rynkowej całego pojazdu. Ciężar tego dowodu spoczywa wyłącznie na ubezpieczycielu.

3. Obowiązek stosowania realnych stawek lokalnego rynku naprawczego (Rekomendacja 15 KNF):
   Zakład ubezpieczeń ma obowiązek kalkulować robociznę według stawek stosowanych na rynku lokalnym poszkodowanego przez certyfikowane warsztaty posiadające odpowiednie wyposażenie technologiczne, a nie według stawek dumpingowych sieci partnerskich.

4. Wymóg zachowania standardu części oryginalnych i ochrona gwarancji (Rekomendacja 16 KNF):
   W pojeździe o udokumentowanym stanie i historii serwisowej ubezpieczyciel nie może narzucać zamienników najniższej jakości dystrybutorskiej (kategoria PJ/P), a w pojeździe objętym gwarancją fabryczną producenta niedopuszczalne jest naruszanie warunków ochrony gwarancyjnej.


IV. RYGOR USTAWOWY I POUCZENIE O SKUTKACH PRAWNYCH

Niniejsze pismo stanowi formalną REKLAMACJĘ w rozumieniu art. 2 pkt 2 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego (Dz.U. z 2019 r. poz. 2279 z późn. zm.).

Zgodnie z art. 5 ust. 1 ww. ustawy, zakład ubezpieczeń zobowiązany jest do rozpatrzenia reklamacji i udzielenia odpowiedzi w formie pisemnej w terminie nieprzekraczającym 30 DNI od dnia jej otrzymania.

Pouczenie o skutku prawnym milczenia ubezpieczyciela:
W myśl art. 8 ww. ustawy:
„W razie niedotrzymania terminu określonego w art. 5 ust. 1 (...) reklamację uważa się za rozpatrzoną zgodnie z wolą klienta”.

W przypadku braku zapłaty lub odmownego rozpatrzenia reklamacji, sprawa zostanie bezzwłocznie skierowana z wnioskiem o przeprowadzenie postępowania interwencyjnego do Rzecznika Finansowego, a następnie na drogę postępowania sądowego wraz z żądaniem odsetek ustawowych za opóźnienie (art. 481 k.c.) oraz zwrotu pełnych kosztów procesu.



...........................................................
(własnoręczny podpis poszkodowanego)

Załączniki:
1. Załącznik nr 1: Kalkulacja korygująca i audyt różnicowy kosztorysu (zanisko.pl).
2. Załącznik nr 2: Wyciąg ze stawek rynkowych roboczogodziny Polskiej Izby Motoryzacji (PIM 2026).
3. Załącznik nr 3: Zestawienie orzecznictwa Sądu Najwyższego RP (uchwała SN III CZP 80/11) oraz Rekomendacji KNF.
4. Załącznik nr 4: Kopia kalkulacji ubezpieczyciela będącej przedmiotem wezwania.
`;
}

/**
 * Konwertuje tekst wezwania na sformatowany kod HTML do eksportu DOC / PDF.
 */
export function demandLetterToHtml(text: string): string {
  const paragraphs = text.split('\n\n');
  return paragraphs
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('PRZEDSĄDOWE WEZWANIE DO ZAPŁATY')) {
        return `<h1 style="text-align: center; font-size: 15pt; margin: 16pt 0 8pt 0;">${trimmed.replace(/\n/g, '<br>')}</h1>`;
      }
      if (trimmed.startsWith('I. ') || trimmed.startsWith('II. ') || trimmed.startsWith('III. ') || trimmed.startsWith('IV. ')) {
        const [title, ...rest] = trimmed.split('\n');
        return `<h2>${title}</h2><p>${rest.join('<br>')}</p>`;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}
