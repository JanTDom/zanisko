# Karta Okazji: ClaimCheck (Weryfikator Kosztorysów OC)

Data: 2026-10-02  
Status: Zaakceptowano do realizacji MVP  

---

## Karta Popytowa Produktu

- **Użytkownik:** Poszkodowany kierowca (właściciel auta, osoba fizyczna lub JDG) po kolizji z winy innego uczestnika ruchu drogowego (szkoda z polisy OC ppm).
- **Płatnik:** Poszkodowany kierowca.
- **Sytuacja wyzwalająca:** Otrzymanie na e-mail decyzji o wypłacie „kwoty bezspornej” wraz z kosztorysem w formacie PDF (Audatex/Eurotax/DAT), której wysokość uniemożliwia rzetelną naprawę auta w niezależnym warsztacie blacharsko-lakierniczym.
- **Zadanie do wykonania (JTBD):** Szybko i tanio sprawdzić, w których pozycjach ubezpieczyciel bezprawnie obciął wycenę, oraz złożyć formalne przedsądowe wezwanie do zapłaty (reklamację), zmuszające ubezpieczyciela do dopłaty różnicy przed podjęciem kroków sądowych.
- **Obecny sposób działania:**
  1. Kapitulacja: akceptacja zaniżonej kwoty i dopłata z własnej kieszeni (strata 1 500–5 000 zł) [FAKT].
  2. Cesja (odkup szkody): oddanie roszczenia firmie skupującej za 20–30% wartości nadróbki [FAKT].
  3. Kancelaria odszkodowawcza: oddanie 30–40% prowizji i długie oczekiwanie [FAKT].
  4. Niezależny rzeczoznawca: wydatek 400–800 zł na opinię prywatną [FAKT].
  5. Samodzielny e-mail ze ściągniętym wzorem: ubezpieczyciel odrzuca z powodu braku merytorycznych wyliczeń [WNIOSEK].
- **Koszt problemu:** Od 1 500 zł do 5 000 zł bezpośredniej straty gotówkowej na pojedynczej szkodzie.
- **Częstotliwość:** Rzadka dla osoby fizycznej (raz na kilka lat), ciągła w skali populacji (ponad 1,2 miliona szkód rocznie w Polsce).
- **Pożądany rezultat:** Odzyskanie brakujących 1 500–4 000 zł bez oddawania prowizji pośrednikom i bez kosztownych rzeczoznawców.
- **Powód zakupu teraz:** Samochód czeka na naprawę, termin reklamacji płynie, klient odczuwa silną złość na ubezpieczyciela.
- **Najsilniejszy dowód:** Twarde Rekomendacje KNF zakazujące automatycznej amortyzacji i zaniżania stawek robocizny oraz fakt, że cały wielomilionowy rynek skupu szkód w Polsce żyje wyłącznie z masowego zaniżania tych kosztorysów [FAKT].
- **Najważniejsza niewiadoma:** Jaki procent ubezpieczycieli decyduje się na ugodową dopłatę na etapie przedsądowym po otrzymaniu profesjonalnego pisma z rygorem 30 dni? [HIPOTEZA do zbadania w teście].

---

## Formuła Propozycji Wartości
> „Kiedy ubezpieczyciel przysyła zaniżony kosztorys naprawy z OC sprawcy, poszkodowany kierowca płaci 59 zł za natychmiastowe wyliczenie faktycznego zaniżenia i wygenerowanie formalnego przedsądowego wezwania do zapłaty opartego na Rekomendacjach KNF i orzecznictwie Sądu Najwyższego, ponieważ dotychczas musiał oddać 75% zysku firmie skupującej szkody albo wydać 600 zł na prywatnego rzeczoznawcę. Nasza aplikacja osiąga to przez deterministyczny audyt technicznego pliku PDF (Audatex/Eurotax), zderzenie stawek z bazą rynkową i nałożenie 30-dniowego rygoru ustawowego, a nie przez ogólne porady prawne”.
