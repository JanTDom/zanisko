import { AuditReport, Voivodeship, VehicleSegment } from './types.js';
import { REGIONAL_BENCHMARKS } from './regional-rates.js';
import { fixPolishTypography, fixPolishTypographyInHtml } from './typography.js';

export interface AttachmentData {
  id: 'attachment1' | 'attachment2' | 'attachment3';
  number: number;
  title: string;
  subtitle: string;
  textContent: string;
  htmlContent: string;
}

/**
 * Generator Załącznika nr 1: Kalkulacja korygująca i szczegółowy audyt uchybień kosztorysu.
 */
export function generateAttachment1Audit(report: AuditReport): AttachmentData {
  const h = report.header;
  const s = report.summary;
  const currentDate = new Date().toLocaleDateString('pl-PL');

  let violationsText = '';
  let violationsHtml = '';

  report.violations.forEach((v, idx) => {
    const gross = v.lossGross > 0 ? `${v.lossGross.toFixed(2)} PLN brutto` : 'uchybienie technologiczne';
    const net = v.lossNet > 0 ? ` (${v.lossNet.toFixed(2)} PLN netto)` : '';
    let itemsStr = '';
    let itemsHtml = '';
    if (v.affectedItems && v.affectedItems.length > 0) {
      itemsStr = '\n    Pozycje: ' + v.affectedItems.join(', ');
      itemsHtml = `<div style="font-size: 9pt; color: #555; margin-top: 3pt;"><strong>Pozycje:</strong> ${v.affectedItems.join(', ')}</div>`;
    }

    violationsText += `
${idx + 1}. ${v.title.toUpperCase()}
   Kwota zaniżenia: ${gross}${net}
   Podstawa prawno-techniczna: ${v.legalBasis}
   Opis uchybienia: ${v.description}${itemsStr}
`;

    violationsHtml += `
<tr>
  <td style="font-weight: bold; width: 5%;">${idx + 1}</td>
  <td style="width: 35%;">
    <strong>${v.title}</strong>
    ${itemsHtml}
  </td>
  <td style="width: 35%; font-size: 9pt;">
    <div>${v.description}</div>
    <div style="color: #666; margin-top: 2pt;"><em>${v.legalBasis}</em></div>
  </td>
  <td style="width: 25%; font-weight: bold; text-align: right;">${gross}</td>
</tr>`;
  });

  const textContent = `ZAŁĄCZNIK NR 1 DO PRZEDSĄDOWEGO WEZWANIA DO ZAPŁATY
SZCZEGÓŁOWA KALKULACJA KORYGUJĄCA I AUDYT UCHYBIEŃ KOSZTORYSU
Sporządzono: ${currentDate} przez zanisko.pl

METRYKA SZKODY:
- Numer szkody: ${h.claimNumber}
- Zakład ubezpieczeń: ${h.insurerName}
- Pojazd: ${h.vehicleMakeModel} (rok prod. ${h.productionYear}, rej. ${h.registrationNumber})
- Data zdarzenia: ${h.damageDate}
- Województwo szkody: ${h.voivodeship} (stawka rynkowa PIM: ${s.benchmarkLaborRateNet.toFixed(2)} zł/rbh netto)
- Stawka przyjęta przez ubezpieczyciela: ${s.appliedLaborRateNet.toFixed(2)} zł/rbh netto

ROZLICZENIE FINANSOWE SZKODY:
1. Przyznana kwota bezsporna ubezpieczyciela: ${s.undisputedAmountGross.toFixed(2)} PLN brutto (${s.undisputedAmountNet.toFixed(2)} PLN netto)
2. Wyliczona kwota zaniżenia odszkodowania: ${s.totalLossGross.toFixed(2)} PLN brutto (${s.totalLossNet.toFixed(2)} PLN netto)
3. Pełny, rzetelny koszt przywrócenia pojazdu do stanu sprzed szkody: ${s.fairAmountGross.toFixed(2)} PLN brutto (${s.fairAmountNet.toFixed(2)} PLN netto)

WYKAZ ZIDENTYFIKOWANYCH UCHYBIEŃ I ZANIŻEŃ:
${violationsText}

PODSUMOWANIE RZECZOZNAWCZE:
Niniejsza kalkulacja różnicowa stanowi integralny załącznik do wezwania do zapłaty. Wycena uwzględnia obiektywne stawki rynkowe certyfikowanych warsztatów naprawczych, Rekomendacje KNF dotyczące likwidacji szkód z ubezpieczeń komunikacyjnych (obowiązujące od 1 listopada 2022 r.) oraz zasadę pełnej kompensacji szkody (art. 361 § 2 k.c.).`;

  const htmlContent = `
<div class="header-box">
  <div style="font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase;">Załącznik nr 1 do Wezwania do Zapłaty</div>
  <div style="font-size: 11pt; text-align: center; color: #444; margin-top: 4pt;">Szczegółowa kalkulacja korygująca i audyt uchybień kosztorysu</div>
  <div style="font-size: 9pt; text-align: right; color: #777; margin-top: 8pt;">Sporządzono: ${currentDate} | zanisko.pl</div>
</div>

<h2>I. Metryka szkody i parametry techniczne</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 14pt;">
  <tr><td style="width: 35%; font-weight: bold;">Numer szkody:</td><td>${h.claimNumber}</td></tr>
  <tr><td style="font-weight: bold;">Zakład ubezpieczeń:</td><td>${h.insurerName}</td></tr>
  <tr><td style="font-weight: bold;">Pojazd:</td><td>${h.vehicleMakeModel} (rok prod. ${h.productionYear}, nr rej. ${h.registrationNumber})</td></tr>
  <tr><td style="font-weight: bold;">Stawka robocizny ubezpieczyciela:</td><td>${s.appliedLaborRateNet.toFixed(2)} PLN/rbh netto</td></tr>
  <tr><td style="font-weight: bold;">Stawka rynkowa PIM dla woj. ${h.voivodeship}:</td><td style="color: #0f766e; font-weight: bold;">${s.benchmarkLaborRateNet.toFixed(2)} PLN/rbh netto</td></tr>
</table>

<h2>II. Podsumowanie finansowe roszczenia</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 14pt;">
  <tr style="background: #f8fafc;">
    <th style="padding: 6pt;">Pozycja rozliczenia</th>
    <th style="padding: 6pt; text-align: right;">Wartość netto</th>
    <th style="padding: 6pt; text-align: right;">Wartość brutto (23% VAT)</th>
  </tr>
  <tr>
    <td>Wypłacona kwota bezsporna ubezpieczyciela</td>
    <td style="text-align: right;">${s.undisputedAmountNet.toFixed(2)} PLN</td>
    <td style="text-align: right;">${s.undisputedAmountGross.toFixed(2)} PLN</td>
  </tr>
  <tr style="background: #fef2f2; color: #991b1b; font-weight: bold;">
    <td>Wyliczone zaniżenie kosztorysu (kwota roszczenia)</td>
    <td style="text-align: right;">+${s.totalLossNet.toFixed(2)} PLN</td>
    <td style="text-align: right;">+${s.totalLossGross.toFixed(2)} PLN</td>
  </tr>
  <tr style="background: #f0fdf4; color: #166534; font-weight: bold;">
    <td>Rzetelna wartość naprawy (pełna kompensacja)</td>
    <td style="text-align: right;">${s.fairAmountNet.toFixed(2)} PLN</td>
    <td style="text-align: right;">${s.fairAmountGross.toFixed(2)} PLN</td>
  </tr>
</table>

<h2>III. Wykaz naruszeń prawno-technologicznych</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 14pt;">
  <thead>
    <tr style="background: #f1f5f9;">
      <th style="padding: 6pt;">Lp.</th>
      <th style="padding: 6pt;">Tytuł naruszenia</th>
      <th style="padding: 6pt;">Uzasadnienie i podstawa prawna</th>
      <th style="padding: 6pt; text-align: right;">Wartość roszczenia</th>
    </tr>
  </thead>
  <tbody>
    ${violationsHtml}
  </tbody>
</table>
`;

  return {
    id: 'attachment1',
    number: 1,
    title: 'Załącznik nr 1 – Szczegółowa kalkulacja korygująca i audyt kosztorysu',
    subtitle: 'Wykaz uchybień formalnych i wyliczenie pełnej kompensacji szkody',
    textContent: textContent.replace(/—/g, '–'),
    htmlContent: fixPolishTypographyInHtml(htmlContent),
  };
}

/**
 * Generator Załącznika nr 2: Wyciąg ze stawek rynkowych robocizny Polskiej Izby Motoryzacji (PIM) 2026.
 */
export function generateAttachment2PimRates(
  currentVoivodeship: Voivodeship = 'mazowieckie',
  segment: VehicleSegment = 'POPULAR'
): AttachmentData {
  const currentDate = new Date().toLocaleDateString('pl-PL');
  const allVoivodeships = Object.entries(REGIONAL_BENCHMARKS) as Array<[
    Voivodeship,
    { name: string; rate: number; notes: string }
  ]>;

  let ratesText = '';
  let ratesHtml = '';

  allVoivodeships.forEach(([code, data], idx) => {
    const isCurrent = code === currentVoivodeship;
    const marker = isCurrent ? ' [SZKODA POSZKODOWANEGO]' : '';
    const mult = segment === 'PREMIUM' ? 1.25 : segment === 'LUXURY' ? 1.5 : 1.0;
    const finalRate = data.rate * mult;

    ratesText += `${idx + 1}. ${data.name}: ${finalRate.toFixed(2)} zł/rbh netto${marker}\n   (${data.notes})\n`;

    ratesHtml += `
<tr style="${isCurrent ? 'background: #eff6ff; font-weight: bold; border-left: 4px solid #0284c7;' : ''}">
  <td style="padding: 5pt;">${idx + 1}</td>
  <td style="padding: 5pt;">${data.name}${isCurrent ? ' <span style="color: #0284c7;">(Obszar szkody)</span>' : ''}</td>
  <td style="padding: 5pt; text-align: right; font-weight: bold;">${finalRate.toFixed(2)} PLN</td>
  <td style="padding: 5pt; font-size: 8.5pt; color: #555;">${data.notes}</td>
</tr>`;
  });

  const textContent = `ZAŁĄCZNIK NR 2 DO PRZEDSĄDOWEGO WEZWANIA DO ZAPŁATY
WYCIĄG ZE STAWEK RYNKOWYCH ROBOCIZNY POLSKIEJ IZBY MOTORYZACJI (PIM)
Stan na: 2026 r. | Źródło: Badania rynku usług blacharsko-lakierniczych PIM

1. PODSTAWA PRAWNA STOSOWANIA STAWEK RYNKOWYCH:
Zgodnie z Rekomendacją 15 Rekomendacji Komisji Nadzoru Finansowego (KNF) dotyczących likwidacji szkód z ubezpieczeń komunikacyjnych (obowiązujących od 1 listopada 2022 r.):
„Zakład ubezpieczeń ustala koszty naprawy pojazdu z uwzględnieniem cen części i materiałów oraz stawek robocizny stosowanych przez warsztaty naprawcze na rynku lokalnym (...)”.
Stosowanie przez ubezpieczyciela zaniżonych stawek kosztorysowych (np. 60-80 zł/rbh netto) narusza prawo, gdyż stawki takie nie występują na rynku komercyjnym i mają charakter wyłącznie dumpingowy w ramach sieci umownych ubezpieczyciela.

2. TABELA STAWEK REFERENCYJNYCH DLA 16 WOJEWÓDZTW (2026 R.):
${ratesText}
3. MNOŻNIKI TECHNOLOGICZNE W ZALEŻNOŚCI OD SEGMENTU:
- Segment Popularny (współczynnik 1.0): naprawy standardowe ze stali konwencjonalnej.
- Segment Premium (współczynnik 1.25): naprawy aut z systemami radarowymi ADAS, nitowanie i klejenie stopów aluminium.
- Segment Luksusowy (współczynnik 1.50): technologia kompozytowa, włókno węglowe, restrykcyjne normy OEM.`;

  const htmlContent = `
<div class="header-box">
  <div style="font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase;">Załącznik nr 2 do Wezwania do Zapłaty</div>
  <div style="font-size: 11pt; text-align: center; color: #444; margin-top: 4pt;">Wyciąg ze stawek rynkowych roboczogodziny Polskiej Izby Motoryzacji (PIM)</div>
  <div style="font-size: 9pt; text-align: right; color: #777; margin-top: 8pt;">Wydanie: 2026 r. | Monitor Rynku Motoryzacyjnego</div>
</div>

<h2>I. Wytyczne Rekomendacji 15 KNF</h2>
<p style="text-align: justify; font-size: 10pt; line-height: 1.4;">
Zgodnie z Rekomendacją 15 Rekomendacji Komisji Nadzoru Finansowego (KNF) dotyczących likwidacji szkód z ubezpieczeń komunikacyjnych (obowiązujących od 1 listopada 2022 r.), zakład ubezpieczeń ma obowiązek ustalać koszty naprawy na podstawie stawek stosowanych na <strong>rynku lokalnym poszkodowanego</strong> przez certyfikowane warsztaty dysponujące odpowiednim wyposażeniem technicznym. Narzucanie stawek rzędu 60–80 zł/rbh netto jest bezprawne, co potwierdzają jednolicie sądy powszechne oraz Rzecznik Finansowy.
</p>

<h2>II. Zestawienie stawek referencyjnych dla 16 województw</h2>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 14pt;">
  <thead>
    <tr style="background: #f1f5f9;">
      <th style="padding: 6pt; text-align: left; width: 6%;">Lp.</th>
      <th style="padding: 6pt; text-align: left; width: 34%;">Województwo</th>
      <th style="padding: 6pt; text-align: right; width: 25%;">Stawka referencyjna netto</th>
      <th style="padding: 6pt; text-align: left; width: 35%;">Zakres rynkowy i uwagi</th>
    </tr>
  </thead>
  <tbody>
    ${ratesHtml}
  </tbody>
</table>

<h2>III. Wymogi technologiczne segmentów pojazdów</h2>
<p style="text-align: justify; font-size: 9.5pt;">
Pojazdy nowsze oraz klasy Premium wymagają po naprawie blacharsko-lakierniczej procedur kalibracji kamer i radarów (ADAS), pomiarów geometrii ramy oraz stosowania dedykowanych urządzeń zgrzewających i klejów strukturalnych. Wymóg ten uzasadnia stosowanie stawek rynkowych na poziomie minimum 180–220 zł/rbh netto.
</p>
`;

  return {
    id: 'attachment2',
    number: 2,
    title: 'Załącznik nr 2 – Wyciąg ze stawek rynkowych robocizny PIM 2026',
    subtitle: 'Urzędowe zestawienie stawek roboczogodziny dla 16 województw w oparciu o Rekomendację 15 KNF',
    textContent: textContent.replace(/—/g, '–'),
    htmlContent: fixPolishTypographyInHtml(htmlContent),
  };
}

/**
 * Generator Załącznika nr 3: Zestawienie orzecznictwa Sądu Najwyższego RP i Rekomendacji KNF.
 */
export function generateAttachment3LegalBasis(): AttachmentData {
  const currentDate = new Date().toLocaleDateString('pl-PL');

  const textContent = `ZAŁĄCZNIK NR 3 DO PRZEDSĄDOWEGO WEZWANIA DO ZAPŁATY
KOMPENDIUM ORZECZNICTWA SĄDU NAJWYŻSZEGO RP ORAZ REKOMENDACJI KNF
Materiały prawne stanowiące podstawę roszczeń odszkodowawczych z ubezpieczenia OC sprawcy

I. UCHWAŁA SKŁADU 7 SĘDZIÓW SĄDU NAJWYŻSZEGO Z DNIA 12 KWIETNIA 2012 R. (SYGN. AKT III CZP 80/11)
Teza orzeczenia:
„Zakład ubezpieczeń zobowiązany jest na żądanie poszkodowanego do wypłaty, w ramach odpowiedzialności z tytułu ubezpieczenia odpowiedzialności cywilnej posiadacza pojazdu mechanicznego, odszkodowania obejmującego celowe i ekonomicznie uzasadnione koszty nowych części i materiałów służących do naprawy uszkodzonego pojazdu. Jeżeli ubezpieczyciel wykaże, że prowadzi to do wzrostu wartości pojazdu, odszkodowanie może ulec obniżeniu o kwotę odpowiadającą temu wzrostowi”.
Komentarz:
Ciężar dowodu wykazania wzrostu wartości pojazdu spoczywa w całości na ubezpieczycielu (art. 6 k.c.). Automatyczne, procentowe potrącenia amortyzacyjne ze względu na wiek pojazdu (np. 30%, 40%, 55%) naruszają ustawową zasadę pełnej kompensacji szkody (art. 361 § 2 k.c.) oraz stanowią bezpodstawne zaniżenie należnego świadczenia.

II. UCHWAŁA SĄDU NAJWYŻSZEGO Z DNIA 13 CZERWCA 2003 R. (SYGN. AKT III CZP 32/03)
Teza orzeczenia:
„Odszkodowanie przysługujące od ubezpieczyciela odpowiedzialności cywilnej za uszkodzenie pojazdu mechanicznego obejmuje niezbędne i ekonomicznie uzasadnione koszty naprawy pojazdu, ustalone według cen występujących na lokalnym rynku”.
Z uzasadnienia orzeczenia oraz uchwały SN z dnia 15 listopada 2001 r. (sygn. akt III CZP 68/01):
„Obowiązek naprawienia szkody przez wypłatę odpowiedniej sumy pieniężnej powstaje z chwilą wyrządzenia szkody i nie jest uzależniony od tego, czy poszkodowany dokonał naprawy rzeczy i czy w ogóle zamierza ją naprawić”.
Komentarz:
Poszkodowany ma pełne prawo rozliczyć szkodę kosztorysowo i żądać pełnej kwoty według cen rynkowych bez obowiązku przedkładania jakichkolwiek faktur źródłowych czy rachunków za naprawę.

III. REKOMENDACJE KOMISJI NADZORU FINANSOWEGO (KNF) DOTYCZĄCE LIKWIDACJI SZKÓD KOMUNIKACYJNYCH (OD 1 LISTOPADA 2022 R.)
- Rekomendacja 15: Zakład ubezpieczeń ma obowiązek ustalić świadczenie w wysokości zapewniającej przywrócenie pojazdu do stanu sprzed szkody na rynku lokalnym poszkodowanego.
- Rekomendacja 17: Ubezpieczyciel uwzględnia koszty nowych części i materiałów (zakaz automatycznej amortyzacji). Zgodnie z pkt 17.3 ubezpieczyciel nie może powoływać się na rabaty lub upusty warsztatów współpracujących. Potwierdzają to uchwały SN: z 6 października 2022 r. (III CZP 119/22) i z 8 maja 2024 r. (III CZP 142/22) – odszkodowanie nie może być sztucznie obniżane o hipotetyczne upusty ubezpieczyciela.
- Rekomendacja 18: Ubezpieczyciel nie może narzucać części nieoryginalnych (zamienników PJ/P), jeżeli pojazd był serwisowany na częściach oryginalnych (kategoria O/Q), znajduje się w okresie gwarancji producenta lub wymaga tego bezpieczeństwo technologiczne.

IV. USTAWOWY RYGOR ODPOWIEDZI NA REKLAMACJĘ (ART. 5 I ART. 8 USTAWY W ZW. Z UCHWAŁĄ 7 SĘDZIÓW SN III CZP 113/17)
- Art. 5 ust. 1 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej: Ubezpieczyciel ma obowiązek udzielić pisemnej odpowiedzi na reklamację w terminie 30 dni od dnia jej otrzymania.
- Art. 8 w zw. z uchwałą składu 7 sędziów SN z dnia 13 czerwca 2018 r. (sygn. akt III CZP 113/17): Niedotrzymanie 30-dniowego terminu skutkuje uznaniem reklamacji zgodnie z wolą klienta, co w procesie sądowym przenosi w całości ciężar dowodu (art. 6 k.c.) na zakład ubezpieczeń – to ubezpieczyciel musi udowodnić niezasadność dochodzonego roszczenia.`;

  const htmlContent = `
<div class="header-box">
  <div style="font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase;">Załącznik nr 3 do Wezwania do Zapłaty</div>
  <div style="font-size: 11pt; text-align: center; color: #444; margin-top: 4pt;">Kompendium orzecznictwa Sądu Najwyższego RP oraz Rekomendacji KNF</div>
  <div style="font-size: 9pt; text-align: right; color: #777; margin-top: 8pt;">Stan prawny na: ${currentDate} | Opracowanie prawne zanisko.pl</div>
</div>

<h2>I. Uchwała 7 Sędziów Sądu Najwyższego – III CZP 80/11</h2>
<div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 8pt 12pt; margin-bottom: 12pt; font-style: italic;">
„Zakład ubezpieczeń zobowiązany jest na żądanie poszkodowanego do wypłaty, w ramach odpowiedzialności z tytułu ubezpieczenia odpowiedzialności cywilnej posiadacza pojazdu mechanicznego, odszkodowania obejmującego celowe i ekonomicznie uzasadnione koszty nowych części i materiałów służących do naprawy uszkodzonego pojazdu. Jeżeli ubezpieczyciel wykaże, że prowadzi to do wzrostu wartości pojazdu, odszkodowanie może ulec obniżeniu o kwotę odpowiadającą temu wzrostowi”.
</div>
<p style="text-align: justify; font-size: 9.5pt;">
Ciężar dowodu wykazania, że wymiana części doprowadziła do wzrostu wartości handlowej pojazdu spoczywa na ubezpieczycielu (art. 6 k.c.). Rutynowe obcinanie wartości części o wskaźnik amortyzacji narusza ustawową zasadę pełnej kompensacji szkody (art. 361 § 2 k.c.) oraz stanowi bezpodstawne zaniżenie należnego świadczenia.
</p>

<h2>II. Uchwała Sądu Najwyższego – III CZP 32/03</h2>
<div style="background: #f8fafc; border-left: 4px solid #0f766e; padding: 8pt 12pt; margin-bottom: 12pt; font-style: italic;">
„Odszkodowanie przysługujące od ubezpieczyciela odpowiedzialności cywilnej za uszkodzenie pojazdu mechanicznego obejmuje niezbędne i ekonomicznie uzasadnione koszty naprawy pojazdu, ustalone według cen występujących na lokalnym rynku”.
</div>
<p style="text-align: justify; font-size: 9.5pt;">
Obowiązek naprawienia szkody powstaje z chwilą jej wyrządzenia i nie jest uzależniony od tego, czy poszkodowany dokonał naprawy i czy w ogóle zamierza ją naprawić (uchwały SN: III CZP 32/03 oraz III CZP 68/01). Ubezpieczyciel nie może uzależniać wypłaty pełnego odszkodowania od przedstawienia faktur źródłowych za naprawę pojazdu.
</p>

<h2>III. Rekomendacje KNF dotyczące likwidacji szkód komunikacyjnych (od 1 listopada 2022 r.)</h2>
<ul style="font-size: 9.5pt; line-height: 1.4; padding-left: 18pt;">
  <li><strong>Rekomendacja 15:</strong> Obowiązek ustalenia odszkodowania według realnych stawek i cen na lokalnym rynku poszkodowanego.</li>
  <li><strong>Rekomendacja 17 (oraz pkt 17.3):</strong> Zakaz automatycznych potrąceń amortyzacyjnych oraz zakaz powoływania się na rabaty warsztatów współpracujących (potwierdzony uchwałami SN III CZP 119/22 i III CZP 142/22).</li>
  <li><strong>Rekomendacja 18:</strong> Zakaz wymuszania części nieoryginalnych (zamienników PJ/P), jeżeli pojazd był serwisowany na częściach oryginalnych lub jest objęty gwarancją.</li>
</ul>

<h2>IV. Rygor 30 dni na odpowiedź (art. 8 Ustawy o reklamacjach w zw. z uchwałą 7 sędziów SN III CZP 113/17)</h2>
<p style="text-align: justify; font-size: 9.5pt;">
Zgodnie z art. 8 Ustawy z dnia 5 sierpnia 2015 r. o rozpatrywaniu reklamacji przez podmioty rynku finansowego, o Rzeczniku Finansowym i o Funduszu Edukacji Finansowej, brak pisemnej odpowiedzi ubezpieczyciela w terminie 30 dni skutkuje uznaniem reklamacji zgodnie z wolą klienta. W myśl uchwały składu 7 sędziów Sądu Najwyższego z dnia 13 czerwca 2018 r. (sygn. akt III CZP 113/17) uchybienie temu terminowi powoduje procesowe przeniesienie ciężaru dowodu (art. 6 k.c.) w procesie na ubezpieczyciela.
</p>
`;

  return {
    id: 'attachment3',
    number: 3,
    title: 'Załącznik nr 3 – Zestawienie orzecznictwa Sądu Najwyższego i Rekomendacji KNF',
    subtitle: 'Kluczowe tezy prawne: zakaz amortyzacji (III CZP 80/11), brak wymogu faktur (III CZP 32/03) oraz Rekomendacje KNF',
    textContent: textContent.replace(/—/g, '–'),
    htmlContent: fixPolishTypographyInHtml(htmlContent),
  };
}
