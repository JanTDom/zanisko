# Product Brief: ClaimCheck (Weryfikator Kosztorysów OC)

Data: 2026-10-02  
Wersja: 1.0 (Specyfikacja Inżynieryjno-Produktowa MVP)  

---

## 1. Jednozdaniowa Obietnica Produktu
„Wgraj kosztorys od ubezpieczyciela, sprawdź bezpłatnie w 30 sekund o ile zaniżono Twoją wypłatę i pobierz za 59 zł profesjonalne przedsądowe wezwanie do dopłaty zgodne z wytycznymi KNF i Sądu Najwyższego”.

---

## 2. Klient Docelowy Pierwszej Wersji
Poszkodowany kierowca w Polsce (osoba fizyczna lub JDG), który likwiduje szkodę z polisy OC sprawcy kolizji drogowej, otrzymał kosztorys naprawy w formacie PDF (Audatex/Eurotax/DAT) z kwotą bezsporną na poziomie 1 500 – 12 000 zł, a kosztorys zawiera typowe uchybienia (stawka rbh poniżej rynku, zamienniki, amortyzacja części).

---

## 3. Schemat Danych Wejściowych (Ekstrakcja z PDF)

Model multimodalny/parser ma za zadanie wyciągnąć z dokumentu wyłącznie zdefiniowane pola w schemacie:

```typescript
interface CostEstimateData {
  header: {
    claimNumber: string;         // Numer szkody
    insurerName: string;         // Nazwa zakładu ubezpieczeń (np. PZU, Warta)
    vehicleMakeModel: string;    // Marka i model pojazdu
    registrationNumber: string;  // Numer rejestracyjny
    damageDate: string;          // Data zdarzenia
    locationCounty: string;      // Powiat / województwo poszkodowanego
  };
  labor: {
    sheetMetalRate: number;      // Stawka rbh blacharska (netto)
    paintRate: number;           // Stawka rbh lakiernicza (netto)
    mechanicalRate?: number;     // Stawka rbh mechaniczna (netto)
    totalLaborHours: number;     // Łączna liczba roboczogodzin
  };
  parts: Array<{
    partName: string;            // Nazwa części
    partNumber: string;          // Numer katalogowy
    qualityCode: 'O' | 'Q' | 'PC' | 'PJ' | 'P'; // Kod jakości
    basePriceNet: number;        // Cena bazowa netto
    depreciationPercent: number; // Zastosowane potrącenie / urealnienie (%)
    discountPercent: number;     // Zastosowany rabat (%)
  }>;
  paintMaterials: {
    baseAmountNet: number;       // Kwota materiałów lakierniczych netto
    discountPercent: number;     // Arbitralne potrącenie / rabat (%)
  };
  totalSettlementNet: number;    // Przyjęta kwota bezsporna netto
}
```

---

## 4. Twarde Reguły Audytowe i Baza Referencyjna

### 4.1. Regionalna Baza Stawek RBH (Przykładowy wycinek na bazie danych PIM)
- Województwo mazowieckie: stawka referencyjna netto = **165 zł/h**
- Województwo śląskie: stawka referencyjna netto = **150 zł/h**
- Województwo wielkopolskie: stawka referencyjna netto = **155 zł/h**
- Województwo małopolskie: stawka referencyjna netto = **155 zł/h**
- Pozostałe województwa: średnia krajowa warsztatów niezależnych = **145 zł/h**

### 4.2. Silnik Reguł Deterministycznych
1. **Reguła RBH:**  
   `Jeżeli labor.sheetMetalRate < regionalRate` -> Oblicz zaniżenie: `(regionalRate - labor.sheetMetalRate) * labor.totalLaborHours`. Zarzut: naruszenie Rekomendacji 15 KNF.
2. **Reguła Amortyzacji Części:**  
   `Dla każdej części z depreciationPercent > 0` -> Oblicz zaniżenie: `part.basePriceNet * (part.depreciationPercent / 100)`. Zarzut: naruszenie uchwały SN III CZP 80/11 oraz Rekomendacji 17 KNF.
3. **Reguła Rabatów Lakierniczych:**  
   `Jeżeli paintMaterials.discountPercent > 0` -> Oblicz zaniżenie: `paintMaterials.baseAmountNet * (paintMaterials.discountPercent / 100)`. Zarzut: bezprawne potrącenie hipotetycznego rabatu handlowego.
4. **Reguła Zamienników (kategoria PJ):**  
   Identyfikacja części z kodem PJ zamontowanych w miejsce części oryginalnych bez zgody poszkodowanego -> Zarzut naruszenia Rekomendacji 16 KNF.

---

## 5. Ścieżka Użytkownika (UI Flow)

1. **Ekran Główny:** Formularz typu drop-zone „Wgraj kosztorys PDF”. Wybór województwa poszkodowanego.
2. **Skanowanie i Ekstrakcja (15–30 s):** Pasek postępu, walidacja schematu.
3. **Darmowy Ekran Wyników (Lead Magnet):**
   - Wykres różnicowy: Kwota przyznana vs Kwota należna.
   - Lista wykrytych nieprawidłowości (np. „Stawka robocizny zaniżona o 85 zł/h”, „Bezprawna amortyzacja 40% na zderzaku”).
   - Szacowana kwota do odzyskania (np. **2 840,00 zł**).
4. **Bramka Płatności (59 zł):**
   - Natychmiastowa płatność BLIK / karta (autoryzacja < 10 sekund).
5. **Dostęp do Pakietu Reklamacyjnego:**
   - Pobranie spersonalizowanego Przedsądowego Wezwania do Zapłaty w formatach PDF i DOCX (gotowe do podpisania i wysłania).
   - Dostęp do instrukcji wysyłki (adres e-mail ubezpieczyciela, treść wiadomości, procedura liczenia 30 dni).
   - Szablon wniosku do Rzecznika Finansowego w razie odmowy.

---

## 6. Ekonomika Jednostkowa (Unit Economics)

| Pozycja | Wartość | Uwagi |
| :--- | :---: | :--- |
| **Cena dla klienta brutto** | 59,00 zł | Płatność jednorazowa |
| **Podatek VAT (23%)** | -11,03 zł | Odprowadzany do urzędu skarbowego |
| **Przychód netto** | **47,97 zł** | Przychód bazowy |
| Prowizja bramki płatniczej (BLIK/Stripe ~1.5%) | -0,88 zł | Prowizja transakcyjna |
| Koszt przetwarzania dokumentu (AI multimodal / OCR) | -0,35 zł | Koszt modelu per PDF |
| Koszt hostingu i infrastruktury per sesja | -0,10 zł | Vercel / Cloudflare |
| Rezerwa na zwroty (np. błąd odczytu skanu, 5%) | -2,40 zł | Polityka zadowolenia klienta |
| **MARŻA KONTRYBUCYJNA NA TRANSAKCJI** | **44,24 zł** | **Marża kontrybucyjna netto: ~92%** |

### Szacunek Akwizycji (CAC) i Zysku:
- Koszt kliknięcia w Google Ads dla wąskich zapytań intencyjnych: 1,50 – 2,80 zł.
- Przy konwersji ze strony do płatności na poziomie 6–8%, szacowany CAC wynosi **25–35 zł**.
- Zysk netto z transakcji po potrąceniu reklamy: **+10 do +19 zł**.
- Dodatkowy kanał o zerowym CAC: partnerstwa afiliacyjne z niezależnymi warsztatami blacharskimi (oferowanie klientom warsztatu narzędzia do walki o rynkową stawkę).

---

## 7. Świadome Wyłączenia z Pierwszej Wersji (MVP)
- **Szkody całkowite:** Wyłączone (kalkulacja wartości wraku wymaga odrębnych baz rynkowych Info-Ekspert i giełd wraków).
- **Szkody z Autocasco (AC):** Wyłączone (AC regulują indywidualne Ogólne Warunki Ubezpieczenia – OWU danego towarzystwa, w których amortyzacja bywa legalnie dopuszczona umową; skupiamy się na szkodach z OC sprawcy, gdzie prawo jest po stronie poszkodowanego).
- **Cesja i skup wierzytelności:** Wyłączone (brak konieczności angażowania kapitału obrotowego).
