# Rejestr Decyzji Strategicznych (Decisions Log)

Data: 2026-10-02  
Status: Aktywny  

---

## Decyzja 1: Odrzucenie kierunku „Kalkulator PIT-38 dla zagranicznych brokerów” (TaxTrader)
- **Status:** ODRZUCONO (jako pierwszy produkt).
- **Uzasadnienie:**
  - Rynek posiada udowodnioną gotowość do płacenia (poziom dowodu 2: serwisy PodatekGiełdowy.pl i KalkulatorGiełdowy.pl).
  - Jednak bariera wejścia w postaci nasyconego SEO i relacji z influencerami finansowymi (np. kody rabatowe u Marcina Iwucia) jest wysoka.
  - Ponadto skrajna sezonowość (przychody skupione wyłącznie w marcu i kwietniu) uniemożliwia stabilny rozwój produktu przez pierwsze 10 miesięcy roku.

---

## Decyzja 2: Odrzucenie kierunku „Strażnik progów ryczałtu i ZUS” (RyczałtGuard)
- **Status:** ODRZUCONO.
- **Uzasadnienie:**
  - Problem jest bolesny (dopłata 3 000–4 000 zł do składki zdrowotnej po przekroczeniu progu 60 tys. / 300 tys. zł), jednak funkcja ta jest w naturalny sposób wchłaniana przez systemy księgowe i do fakturowania (inFakt, wFirma, Fakturownia).
  - Bardzo wysokie ryzyko unieważnienia przewagi konkurencyjnej po wypuszczeniu jednego powiadomienia w panelu inFaktu.
  - Trudność w uzasadnieniu użytkownikowi, dlaczego ma płacić abonament za osobną aplikację, która wymaga od niego ponownego wklepywania faktur.

---

## Decyzja 3: Wstrzymanie kierunku „RentSafe” (Pakiet Najmu Okazjonalnego)
- **Status:** ZAWIESZONO / ODŁOŻONO.
- **Uzasadnienie:**
  - Gotowość do płacenia jest wysoka, lecz kluczowym wąskim gardłem najmu okazjonalnego w Polsce nie jest sama umowa czy instrukcja zgłoszenia do US, ale **fizyczny brak adresu lokalu zastępczego** po stronie najemcy (szczególnie obcokrajowców i młodych najemców).
  - Wejście w rynek dostarczania adresów rodzi istotne ryzyka prawne i etyczne (ryzyko bezskuteczności egzekucji komorniczej na „masowych adresach”), co narusza kryteria bezpieczeństwa prostego oprogramowania.

---

## Decyzja 4: Wybór „ClaimCheck” jako Głównego Kandydata do Testu Rynkowego
- **Status:** REKOMENDACJA DO TESTU (Status: TESTUJ).
- **Uzasadnienie:**
  - **Rozpoznawalny, cierpiący płatnik:** Poszkodowany kierowca, który właśnie otrzymał decyzję zaniżającą wypłatę o 2 000–5 000 zł.
  - **Asymetria ekonomiczna:** Klient płaci 59–79 zł, aby powalczyć o kilka tysięcy złotych (stosunek kosztu do potencjalnej korzyści to ok. 1:40).
  - **Słabość obecnych alternatyw:**
    - Darmowe wzory pism z Google są ignorowane przez ubezpieczycieli z powodu braku merytorycznych wyliczeń.
    - Firmy skupujące odszkodowania rabują 70–80% nadróbki.
    - Kancelarie odszkodowawcze nie chcą brać małych szkód (do 5 000 zł) lub biorą 40% prowizji.
    - Rzeczoznawca prywatny kosztuje 400–800 zł.
  - **Solidna podstawa prawna:** Rekomendacje KNF z listopada 2022 r. i uchwała SN III CZP 80/11 dają precyzyjną, powtarzalną argumentację prawną, której ubezpieczyciel nie może zignorować w procesie reklamacyjnym.
  - **Prosty mechanizm webowy:** Ekstrakcja danych z tabelarycznego PDF (Audatex/Eurotax) -> zderzenie stawek -> wygenerowanie wezwania przedsądowego w PDF.
