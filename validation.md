# Plan Walidacji Rynkowej (Validation Protocol)

Data: 2026-10-02  
Główny badany projekt: **ClaimCheck (Automatyczny audytor kosztorysu OC i generator wezwania do zapłaty)**  

---

## 1. Najbardziej Ryzykowna Hipoteza (Leap of Faith Assumption)

**Hipoteza H1:**  
Poszkodowani kierowcy, którzy otrzymali zaniżony kosztorys od ubezpieczyciela z OC sprawcy, są gotowi zapłacić 59 zł za natychmiastowy raport wykazujący zaniżenie oraz gotowe, formalne Przedsądowe Wezwanie do Zapłaty powołujące się na Rekomendacje KNF i orzecznictwo SN, zamiast oddawać szkodę firmie skupującej za ułamek wartości lub brać darmowy szablon z sieci.

**Hipoteza H2:**  
Wysłanie formalnego, wyliczonego wezwania do zapłaty z powołaniem na Rekomendacje KNF i SN III CZP 80/11 bez udziału adwokata skłania ubezpieczyciela w co najmniej 30% przypadków do podwyższenia kwoty bezspornej w postępowaniu reklamacyjnym (ugoda na poziomie 30–60% zaniżenia).

---

## 2. Eksperyment Walidacyjny: „Concierge MVP” / Fake-Door z Ręcznym Parsowaniem

### Grupa docelowa:
Kierowcy w Polsce, którzy w ciągu ostatnich 14–30 dni mieli kolizję nie ze swojej winy i otrzymali kosztorys naprawy w PDF z ubezpieczalni (PZU, Warta, Ergo Hestia, Generali, TUZ itp.).

### Sposób dotarcia:
1. **Google Search Ads (intencja zakupu / pilnego problemu):**
   - Frazy: `zaniżony kosztorys pzu odwołanie`, `jak odwołać się od wyceny warta`, `zaniżona stawka roboczogodziny kosztorys`, `kosztorys audatex odwołanie wzór`.
2. **Grupy motoryzacyjne na Facebooku / Fora dyskusyjne marek:**
   - Bezpośrednia odpowiedź na posty typu: „Ubezpieczyciel wyliczył mi zderzak na 1800 zł, a lakiernik chce 4500 zł, co robić?”.
3. **Niezależne warsztaty blacharsko-lakiernicze (partnerstwo pilotażowe):**
   - Zaproponowanie 3 lokalnym warsztatom narzędzia dla ich klientów, którym ubezpieczyciele obcinają kosztorysy.

### Testowana oferta i cena:
- **Darmowa diagnoza (Lead Magnet):** Wgraj PDF kosztorysu -> w 5 minut otrzymujesz informację: „Twój kosztorys zawiera 3 typowe uchybienia. Szacowane zaniżenie: 1 800 – 3 200 zł”.
- **Płatny produkt (59 zł brutto):** Pobranie pełnego Raportu Naruszeń + Gotowego Przedsądowego Wezwania do Zapłaty z dokładnymi kwotami, wyliczeniem stawek rbh dla Twojego powiatu oraz formalną podstawą prawną pod rygorem skargi do Rzecznika Finansowego.

### Mierzone zachowanie:
- Kliknięcie w przycisk „Zapłać 59 zł i pobierz pismo do ubezpieczyciela” (integracja z bramką PayU/Stripe/Blik).
- Wskaźnik konwersji ze strony głównej do wgrania kosztorysu (CVR1).
- Wskaźnik konwersji z darmowej diagnozy do płatności (CVR2).

### Parametry testu:
- **Budżet maksymalny:** 1 000 zł (na Google Ads).
- **Czas trwania:** 14 dni roboczych.
- **Ruch docelowy:** min. 250 unikalnych użytkowników z intencji poszukiwania odwołania.

---

## 3. Precyzyjne Kryteria Decyzyjne (Progi Sukcesu)

| Wskaźnik | Próg Sukcesu (BUDUJ) | Próg Warunkowy (ZMIEŃ) | Próg Porażki (ODRZUĆ) |
| :--- | :---: | :---: | :---: |
| **Konwersja z wizyty do wgrania PDF** | > 12% | 6% – 12% | < 6% (brak zaufania do wgrywania dokumentu) |
| **Konwersja z diagnozy do chęci zakupu (59 zł)** | > 8% | 3% – 8% | < 3% (niechęć do płacenia za dokument) |
| **CAC (koszt pozyskania płatności)** | < 35 zł | 35 zł – 55 zł | > 59 zł (nieopłacalna dystrybucja płatna) |
| **Skuteczność merytoryczna (pilotaż 10 osób)** | min. 3 osoby uzyskały dopłatę polubowną od ubezpieczyciela | ubezpieczyciele odrzucają, ale 8/10 idzie z pismem do RF | 0 dopłat, ubezpieczyciele całkowicie ignorują pismo |

### Rygor wykonania pilotażu:
W fazie testowej nie budujemy pełnego automatycznego silnika opartego na zaawansowanym OCR/parserze za 50 000 zł.  
Wgrane kosztorysy w pierwszych 50 przypadkach są analizowane półautomatycznie (skrypt Python + asysta człowieka z szablonem stawek PIM) w ciągu 15 minut od wgrania.  
Dopiero po udowodnieniu konwersji płatniczej budujemy pełną automatyzację.
