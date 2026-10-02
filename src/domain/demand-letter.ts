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
 */
export function generateDemandLetter(
  report: AuditReport,
  options: DemandLetterOptions
): string {
  const currentDate = options.cityAndDate ?? `Warszawa, dnia ${new Date().toLocaleDateString('pl-PL')}`;
  const h = report.header;
  const s = report.summary;

  let violationsSections = '';
  report.violations.forEach((v, idx) => {
    violationsSections += `
### ${idx + 1}. ${v.title} — roszczenie: ${v.lossGross.toFixed(2)} zł brutto (${v.lossNet.toFixed(2)} zł netto)
- **Podstawa zarzutu:** ${v.legalBasis}
- **Uzasadnienie merytoryczne:** ${v.description}
${v.affectedItems && v.affectedItems.length > 0 ? `- **Szczegółowy wykaz pozycji:**\n${v.affectedItems.map(item => `  * ${item}`).join('\n')}` : ''}
`;
  });

  return `# ${currentDate}

**WZYWAJĄCY (POSZKODOWANY):**
${options.claimantName}
${options.claimantAddress}

**ADRESAT (UBEZPIECZYCIEL):**
${h.insurerName}
Departament Likwidacji Szkód Komunikacyjnych

---

# PRZEDSĄDOWE WEZWANIE DO ZAPŁATY
### FORMALNA REKLAMACJA
*(złożona w trybie art. 3 i art. 5 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego)*

**Dotyczy:**
- **Numer szkody ubezpieczyciela:** ${h.claimNumber}
- **Pojazd poszkodowanego:** ${h.vehicleMakeModel}, nr rej. ${h.registrationNumber}
- **Data zdarzenia:** ${h.damageDate}
- **Podstawa prawna odpowiedzialności:** Odpowiedzialność cywilna sprawcy kolizji (art. 436 § 2 k.c. w zw. z art. 822 § 1 k.c.)

---

## I. WEZWANIE DO ZAPŁATY

Działając jako poszkodowany w powyższej szkodzie komunikacyjnej, niniejszym **WZYWAM** ${h.insurerName} do natychmiastowej dopłaty zaniżonej części odszkodowania w łącznej kwocie:

# **${s.totalLossGross.toFixed(2)} PLN brutto**
*(słownie: kwota wyliczona na podstawie załączonego audytu różnicowego kosztorysu)*

Kwotę powyższą należy uiścić w nieprzekraczalnym terminie **14 dni** od dnia doręczenia niniejszego wezwania na rachunek bankowy poszkodowanego:
**Numer rachunku:** ${options.bankAccountNumber}
**Tytuł przelewu:** Dopłata do odszkodowania - szkoda ${h.claimNumber}

Jednocześnie wskazuję, że dotychczas wypłacona kwota w wysokości **${s.undisputedAmountGross.toFixed(2)} zł brutto** (${s.undisputedAmountNet.toFixed(2)} zł netto) została przyjęta wyłącznie jako **kwota bezsporna** i nie zaspokaja roszczenia restytucyjnego wynikającego z art. 361 § 2 k.c. i art. 363 § 1 k.c. Pełna, rzetelna wartość naprawy wynosi **${s.fairAmountGross.toFixed(2)} zł brutto** (${s.fairAmountNet.toFixed(2)} zł netto).

---

## II. WYKAZ ZANIŻEŃ I UZASADNIENIE MERYTORYCZNE

Dokonana przez Państwa kalkulacja naprawy zawiera rażące uchybienia formalne, technologiczne i prawne, naruszające wiążące Rekomendacje Komisji Nadzoru Finansowego (KNF) z dnia 1 listopada 2022 r. oraz utrwalone orzecznictwo Sądu Najwyższego:

${violationsSections}

---

## III. PODSTAWA PRAWNA ROSZCZENIA

1. **Zasada pełnego odszkodowania (art. 361 § 2 k.c.):**
   Szkoda ubezpieczeniowa obejmuje wszelkie celowe i ekonomicznie uzasadnione wydatki konieczne do przywrócenia pojazdu do stanu sprzed zdarzenia. Obniżenie stawek robocizny lub cen części narusza tę zasadę.

2. **Zakaz potrącania amortyzacji części (Uchwała SN III CZP 80/11):**
   Sąd Najwyższy jednoznacznie orzekł, że ubezpieczyciel nie ma prawa dokonywać potrąceń amortyzacyjnych („urealnienia”) z cen nowych części zamiennych, chyba że wykaże wzrost wartości całego pojazdu. Przerzucanie tego ciężaru na poszkodowanego jest sprzeczne z prawem.

3. **Obowiązek stosowania stawek rynkowych (Rekomendacja 15 KNF):**
   Ubezpieczyciel ma obowiązek ustalać koszty robocizny według stawek stosowanych na rynku lokalnym poszkodowanego, a nie stawek dumpingowych sieci partnerskich.

---

## IV. RYGOR USTAWOWY I POUCZENIE O SKUTKACH PRAWNYCH

Niniejsze pismo stanowi **reklamację** w rozumieniu art. 2 pkt 2 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego (Dz.U. z 2019 r. poz. 2279 z późn. zm.).

Zgodnie z **art. 5 ust. 1** ww. ustawy, zakład ubezpieczeń zobowiązany jest do rozpatrzenia reklamacji i udzielenia odpowiedzi w formie pisemnej w terminie nieprzekraczającym **30 dni** od dnia jej otrzymania.

> **UWAGA:** W myśl **art. 8** ww. ustawy:
> *„W razie niedotrzymania terminu określonego w art. 5 ust. 1 (...) reklamację uważa się za rozpatrzoną zgodnie z wolą klienta”*.

W przypadku braku zapłaty lub odmownego rozpatrzenia reklamacji, sprawa zostanie bezzwłocznie skierowana z wnioskiem o przeprowadzenie postępowania interwencyjnego do **Rzecznika Finansowego**, a następnie na drogę postępowania sądowego wraz z żądaniem odsetek ustawowych za opóźnienie (art. 481 k.c.) oraz zwrotu pełnych kosztów procesu.


...........................................................
*(podpis poszkodowanego)*

**Załączniki:**
1. Zestawienie analityczne audytu kosztorysu ClaimCheck.
2. Kosztorys ubezpieczyciela będący przedmiotem reklamacji.
`;
}
