# Rejestr Decyzji Strategicznych (Decisions Log)

Data: 2026-10-02  
Projekt: **ClaimCheck (Weryfikator Kosztorysów OC i Generator Wezwań)**  
Status: Aktywny  

---

## Decyzja 1: Wybór Kierunku Rynkowego
- **Data podjęcia:** 2026-10-02
- **Kierunek:** Weryfikacja kosztorysów napraw pojazdów po szkodach z OC sprawcy i automatyczne generowanie przedsądowych wezwań do dopłaty.
- **Uzasadnienie:**
  - Bardzo duża skala rynku w Polsce (ponad 1,2 miliona szkód rocznie likwidowanych z polis OC).
  - Twardy ból finansowy i asymetria korzyści: klient płaci 59–69 zł jednorazowo, by odzyskać od 1 500 zł do 5 000 zł zaniżonej kwoty bezspornej.
  - Wyraźna słabość i nieefektywność obecnych substytutów (firmy skupujące roszczenia zabierają 70–80% nadróbki; niezależny rzeczoznawca kosztuje 400–800 zł; darmowe szablony z internetu są odrzucane z automatu przez brak wyliczeń).

---

## Decyzja 2: Architektura Rzetelności Systemu (Hybryda: Parser AI + Deterministyczny Silnik Prawny)
- **Data podjęcia:** 2026-10-02
- **Przyjęty wzorzec:**
  - Odrzucenie koncepcji „pisania odwołania przez ogólny model LLM z wolnego promptu” (ryzyko halucynacji stawek, nieprawidłowych artykułów prawnych, braku spójności matematycznej).
  - Wdrożenie 5-warstwowej architektury:
    1. **Ekstrakcja strukturalna:** Model multimodalny/OCR ekstrahuje wyłącznie surowe liczby i pozycje tabelaryczne z plików Audatex/Eurotax do ściśle zdefiniowanego schematu JSON.
    2. **Baza referencyjna:** Zewnętrzna, weryfikowalna baza średnich stawek roboczogodziny (RBH) w 16 województwach oparta na danych Polskiej Izby Motoryzacji (PIM) i KNF.
    3. **Deterministyczny silnik reguł:** Sztywne reguły sprawdzające naruszenie Rekomendacji KNF (15, 16, 17) oraz uchwały Sądu Najwyższego III CZP 80/11.
    4. **Tabela różnicowa:** Matematyczne zliczenie kwot roszczenia (stawki, amortyzacja, lakier).
    5. **Szablon procesowy:** Pismo sporządzone w reżimie Ustawy o rozpatrywaniu reklamacji przez podmioty rynku finansowego (sztywny termin 30 dni pod rygorem uznania roszczenia w całości z mocy prawa).

---

## Decyzja 3: Model Monetyzacji i Zakres MVP
- **Data podjęcia:** 2026-10-02
- **Model:** Darmowa wstępna diagnoza (lead magnet) + 59 zł brutto za pobranie pełnego pakietu reklamacyjnego (PDF + DOCX).
- **Wyłączenia z MVP:**
  - Brak obsługi szkód całkowitych (wycena wraku w systemie Info-Ekspert).
  - Brak skupu wierzytelności (cesji) – nie zamrażamy kapitału obrotowego i nie prowadzimy sporów sądowych.
  - Brak aplikacji mobilnej – prosty, szybki web responsywny.
