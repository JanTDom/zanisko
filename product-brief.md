# Product Brief: ClaimCheck (Weryfikator Kosztorysów OC)

Data: 2026-10-02  
Wersja: 1.0 (Specyfikacja MVP)  

---

## 1. Jednozdaniowa Obietnica Produktu
„Wgraj kosztorys od ubezpieczyciela, sprawdź w 30 sekund o ile zaniżono Twoją wypłatę i pobierz profesjonalne wezwanie do dopłaty zgodne z wytycznymi KNF i Sądu Najwyższego za 59 zł”.

---

## 2. Klient Docelowy Pierwszej Wersji
Kierowca w Polsce (osoba prywatna lub jednoosobowa działalność gospodarcza), który był poszkodowany w kolizji drogowej likwidowanej z polisy OC sprawcy i w ciągu ostatnich 30 dni otrzymał kosztorys naprawy od ubezpieczyciela (PZU, Warta, Ergo Hestia, Generali itp.) z kwotą bezsporną na poziomie 1 500 – 10 000 zł, która nie wystarcza na rzetelną naprawę auta.

---

## 3. Główne Zadanie (Job-To-Be-Done)
Kiedy otrzymuję śmiesznie niską wycenę naprawy od ubezpieczyciela sprawcy wypadku, chcę szybko i bez kosztownych rzeczoznawców dowiedzieć się, ile pieniędzy faktycznie mi obcięto, i wysłać ubezpieczycielowi twarde pismo prawne, aby wymusić dopłatę brakującej kwoty na naprawę samochodu.

---

## 4. Ścieżka Użytkownika (Customer Journey)

```
[Strona Główna / Landing Page]
         │
         ▼
[Wgranie pliku PDF z kosztorysem Audatex / Eurotax]
         │
         ▼ (automatyczna ekstrakcja tabel i stawek w 15 sekund)
[Darmowy Ekran Podsumowania (Teaser / Diagnoza)]
- Wykryta stawka rbh: 75 zł (Średnia rynkowa w Twoim regionie: 155 zł)
- Wykryte potrącenia: Amortyzacja części (urealnienie -40%), zamienniki PJ
- Szacowane zaniżenie odszkodowania: np. 2 850 zł
         │
         ▼
[Płatność jednorazowa: 59 zł (BLIK / szybki przelew)]
         │
         ▼
[Natychmiastowe pobranie Pakietu Reklamacyjnego PDF + DOCX]
1. Spersonalizowane Przedsądowe Wezwanie do Zapłaty / Reklamacja ze wskazaną dokładną kwotą roszczenia, numerem szkody, numerem rejestracyjnym.
2. Szczegółowe zestawienie zakwestionowanych pozycji kosztorysu (stawka roboczogodziny wg KNF Rekomendacja 15, potrącenia na częściach wg uchwały SN III CZP 80/11 i Rekomendacji 17).
3. Instrukcja krok-po-kroku: jak i gdzie złożyć pismo (e-mail do likwidatora / ePUAP / list polecony), co zrobić, gdy ubezpieczyciel odrzuci wniosek (gotowy wniosek o interwencję do Rzecznika Finansowego).
```

---

## 5. Zakres Pierwszej Wersji (Maksymalnie 4 Główne Funkcje)

1. **Parser technicznych plików PDF (Audatex / Eurotax / DAT):**
   - Ekstrakcja danych nagłówkowych (numer szkody, zakład ubezpieczeń, marka/model, data szkody).
   - Ekstrakcja stawek roboczogodziny (blacharska, lakiernicza, mechaniczna).
   - Identyfikacja pozycji z urealnieniem/amortyzacją i potrąceń na lakierze.
   - Identyfikacja kodów zamienników (PJ, Q, P).

2. **Silnik reguł weryfikacji i baza referencyjna stawek:**
   - Prosta baza danych średnich stawek rynkowych roboczogodziny w podziale na 16 województw (na bazie publikacji PIM i KNF).
   - Reguły prawne sprawdzające naruszenie Rekomendacji KNF 15, 16, 17 oraz uchwały SN III CZP 80/11.

3. **Generator pism procesowych (PDF / DOCX):**
   - Szablon formalnego Wezwania do Zapłaty / Reklamacji wypełniany automatycznie danymi ze szkody.
   - Pismo zawiera precyzyjny 30-dniowy termin na odpowiedź zgodnie z ustawą o rozpatrywaniu reklamacji przez podmioty rynku finansowego.

4. **Bramka płatności (BLIK / PayU / Stripe):**
   - Natychmiastowe odblokowanie dokumentów po autoryzacji transakcji.

---

## 6. Co ŚWIADOMIE WYŁĄCZONO z Wersji MVP?
- Brak obsługi szkód całkowitych (wycena wraku w systemie Info-Ekspert wymaga odrębnych, skomplikowanych algorytmów rynkowych).
- Brak cesji wierzytelności i odkupu szkód (nie prowadzimy skupu ani kancelarii prawnej, brak ryzyka kapitałowego).
- Brak reprezentacji procesowej przed sądem (narzędzie służy do etapu przedsądowego i postępowania przed Rzecznikiem Finansowym).
- Brak aplikacji mobilnej (prosty responsywny web).

---

## 7. Model Ekonomiczny (Jednostkowa Ekonomika Transakcji)

| Pozycja | Wartość | Uwagi |
| :--- | :---: | :--- |
| **Cena brutto dla klienta** | 59,00 zł | Płatność jednorazowa |
| **VAT (23%)** | 11,03 zł | Podatek odprowadzany |
| **Przychód netto** | 47,97 zł | Przychód bazowy |
| **Prowizja bramki płatniczej (BLIK/Stripe ~1.5%)** | -0,88 zł | Koszt transakcyjny |
| **Koszt parsowania i LLM (OCR/ekstrakcja per dokument)** | -0,30 zł | Lekki model multimodalny / parser |
| **Infrastruktura serwerowa per transakcja** | -0,10 zł | Vercel / Cloudflare |
| **Rezerwa na zwroty (np. nieczytelny skan, 5%)** | -2,40 zł | Zwrot w razie braku możliwości odczytu |
| **MARŻA KONTRYBUCYJNA NETTO NA TRANSAKCJI** | **44,29 zł** | **Marża kontrybucyjna: ~92%** |

### Szacunek Kosztu Pozyskania Klienta (CAC):
- Koszt kliknięcia Google Ads w wąskich frazach intencyjnych (long-tail): 1,50 – 3,00 zł.
- Przy konwersji ze strony do płatności na poziomie 6–8%, szacowany CAC wynosi **25–40 zł**.
- Zysk na transakcji po odliczeniu reklamy: **+10 do +20 zł** na pojedynczym kliencie od pierwszego dnia.
- Partnerstwa afiliacyjne z warsztatami lakierniczymi (prowizja 15 zł za polecenie klienta, któremu ubezpieczyciel obciął kosztorys): CAC = 15 zł, zysk netto = **~29 zł na transakcji**.
