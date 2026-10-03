import { AuditReport } from './types.js';
import { fixPolishTypography, fixPolishTypographyInHtml } from './typography.js';

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
  options: Partial<DemandLetterOptions> = {}
): string {
  const claimantName = options.claimantName || 'Jan Kowalski';
  const claimantAddress = options.claimantAddress || 'ul. Marszałkowska 10/12, 00-001 Warszawa';
  const bankAccountNumber = options.bankAccountNumber || '12 1020 1026 0000 1234 5678 9012';
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

  const letter = `${currentDate}

WZYWAJĄCY (POSZKODOWANY):
${claimantName}
${claimantAddress}

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
Numer rachunku: ${bankAccountNumber}
Tytuł przelewu: Dopłata do odszkodowania – szkoda ${h.claimNumber}

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

4. Wymóg zachowania standardu części oryginalnych i ochrona gwarancji (Rekomendacja 18 KNF):
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
`;
  return letter.replace(/—/g, '–');
}

/**
 * Konwertuje tekst wezwania na HTML do eksportu DOC.
 * Każda linia tekstu staje się osobnym akapitem z eleganckimi wcięciami list i akapitów.
 */
export function demandLetterToHtml(text: string): string {
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const UPPER = /^[^a-ząćęłńóśźż]*$/; // linia bez małych liter
  const LABEL = /^(Roszczenie|Podstawa zarzutu|Podstawa prawna|Uzasadnienie|Numer rachunku|Tytuł przelewu|Szczegółowy wykaz pozycji|Dotyczy|Data zdarzenia|Numer szkody[^:]*|Pojazd[^:]*|Numer rejestracyjny)\s*:\s*/i;

  const labelled = (line: string): string => {
    const m = line.match(LABEL);
    if (!m) return esc(line);
    return `<b>${esc(m[0].trim())}</b> ${esc(line.slice(m[0].length))}`;
  };

  const blocks = text.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const out: string[] = [];

  let inNumberedItem = false;
  let inAttachmentsList = false;

  blocks.forEach((block, bi) => {
    const rawLines = block.split('\n').filter(l => l.trim().length > 0);
    if (!rawLines.length) return;

    // Tytuł pisma
    if (/PRZEDSĄDOWE WEZWANIE/i.test(rawLines[0].trim())) {
      inNumberedItem = false;
      inAttachmentsList = false;
      out.push(`<h1>${esc(rawLines[0].trim())}</h1>`);
      rawLines.slice(1).forEach(l => out.push(`<p class="subtitle">${esc(l.trim())}</p>`));
      return;
    }

    const html: string[] = [];
    rawLines.forEach((rawLine, li) => {
      const line = rawLine.trim();
      const isIndented = /^\s{2,}/.test(rawLine);

      if (bi === 0 && li === 0 && /dnia|\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}/.test(line) && line.length < 60) {
        html.push(`<p class="date">${esc(line)}</p>`);
      } else if (/^(I|II|III|IV|V|VI|VII|VIII)\.\s+\S/.test(line) && UPPER.test(line)) {
        inNumberedItem = false;
        inAttachmentsList = false;
        html.push(`<h2>${esc(line)}</h2>`);
      } else if (/^\d+\.\s+/.test(line) && UPPER.test(line)) {
        inNumberedItem = true;
        inAttachmentsList = false;
        html.push(`<h3 class="num-item">${esc(line)}</h3>`);
      } else if (/^\d+\.\s+.{3,120}:$/.test(line)) {
        inNumberedItem = true;
        inAttachmentsList = false;
        html.push(`<h3 class="basis">${esc(line)}</h3>`);
      } else if (/^Załączniki\s*:/i.test(line)) {
        inNumberedItem = false;
        inAttachmentsList = true;
        html.push(`<p class="party" style="margin-top:14pt;">${esc(line)}</p>`);
      } else if (inAttachmentsList && /^\d+\.\s+/.test(line)) {
        html.push(`<p class="num-li">${labelled(line)}</p>`);
      } else if (/^[.…_]{10,}$/.test(line)) {
        inNumberedItem = false;
        html.push(`<p class="sign">${esc(line)}</p>`);
      } else if (/^\(własnoręczny podpis/i.test(line)) {
        inNumberedItem = false;
        html.push(`<p class="sign small">${esc(line)}</p>`);
      } else if (/^[\d\s.,]+\s*(PLN|zł)\s*(BRUTTO)?$/i.test(line)) {
        html.push(`<p class="amount">${esc(line)}</p>`);
      } else if (/^\(słownie/i.test(line)) {
        html.push(`<p class="center small">${esc(line)}</p>`);
      } else if (/^[A-ZĄĆĘŁŃÓŚŹŻ() ]{4,}:$/.test(line)) {
        html.push(`<p class="party">${esc(line)}</p>`);
      } else if (inNumberedItem || isIndented || LABEL.test(line)) {
        if (/^[-–•]\s+/.test(line)) {
          html.push(`<p class="sub-li">–&nbsp;${labelled(line.replace(/^[-–•]\s+/, ''))}</p>`);
        } else {
          html.push(`<p class="item-prop">${labelled(line)}</p>`);
        }
      } else if (/^[-–•]\s+/.test(line)) {
        html.push(`<p class="li">–&nbsp;${labelled(line.replace(/^[-–•]\s+/, ''))}</p>`);
      } else if (line.length > 110) {
        html.push(`<p class="justify">${labelled(line)}</p>`);
      } else {
        html.push(`<p>${labelled(line)}</p>`);
      }
    });
    out.push(`<div class="blk">${html.join('')}</div>`);
  });

  return fixPolishTypographyInHtml(out.join('\n'));
}
