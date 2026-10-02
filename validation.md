# Plan Walidacji i Testu Rynkowego (Validation Protocol)

Projekt: **ClaimCheck**  
Data: 2026-10-02  
Status: Gotowy do uruchomienia  

---

## 1. Niezależna Krytyka Rekomendacji (Adwokat Diabła)

Przed wydaniem środków na rozwój pełnego oprogramowania przeprowadzono próbę obalenia założeń projektu:

1. **Najmocniejszy argument, że klienci nie zapłacą:**
   - Klient może uznać, że samo pismo nie gwarantuje wypłaty, a on woli „pewne 1 000 zł do ręki” od firmy skupującej odszkodowania niż perspektywę walki z ubezpieczycielem, nawet jeśli traci na tym 3 000 zł.
2. **Najgroźniejszy substytut:**
   - Firmy skupujące szkody, które same dzwonią do poszkodowanych (pozyskując dane z warsztatów lub baz) i oferują gotówkę natychmiast bez konieczności robienia czegokolwiek.
3. **Najbardziej niedoszacowane ryzyko operacyjne:**
   - Jakość skanów PDF od ubezpieczycieli: część ubezpieczycieli przysyła nieedytowalne, zamazane skany TIFF/PDF z pieczątkami, co może obniżać skuteczność automatycznego OCR i rodzić frustrację użytkowników.
4. **Co musiałoby się okazać prawdą, aby rekomendacja była błędna?**
   - Jeśli okazałoby się, że ubezpieczyciele w 100% przypadków odrzucają wezwania przedsądowe niezależnie od argumentacji prawnej i dopłacają wyłącznie po wniesieniu pozwu do sądu przez adwokata.

---

## 2. Eksperyment Walidacyjny: Concierge / Półautomatyczny Test Popytu

### Cel eksperymentu:
Sprawdzenie, czy poszkodowani kierowcy poszukujący rozwiązania po otrzymaniu kosztorysu są skłonni zapłacić 59 zł za formalne wezwanie do zapłaty, oraz weryfikacja realnej reakcji ubezpieczycieli na wygenerowane pisma.

### Narzędzia i kanał dotarcia:
1. **Landing Page:** Prosta, szybka strona z kalkulatorem i formularzem wgrania pliku PDF.
2. **Kanał akwizycji:** Google Ads na wąskie frazy intencyjne:
   - `odwołanie od kosztorysu pzu wzór`
   - `jak zakwestionować wycenę warta`
   - `zaniżona stawka roboczogodziny kosztorys`
   - `odwołanie amortyzacja części oc`
3. **Budżet testowy:** 1 000 zł (szacowane 300–400 kliknięć o wysokiej intencji).
4. **Obsługa w fazie testu (Concierge):**
   - Wgrany plik PDF jest parsowany półautomatycznie (skrypt pomocniczy + 5-minutowa weryfikacja człowieka).
   - Klient widzi bezpłatną diagnozę zaniżenia.
   - Płatność 59 zł realizowana przez szybką bramkę (Stripe / Autopay).
   - Generowany dokument wezwania jest natychmiast wysyłany na e-mail klienta.

---

## 3. Twarde Progi Decyzyjne Eksperymentu

| Wskaźnik | Próg Sukcesu (BUDUJ) | Próg Korekty (ZMIEŃ) | Próg Porażki (ODRZUĆ) |
| :--- | :---: | :---: | :---: |
| **Wskaźnik wgrania kosztorysu (CVR1)** | > 10% wizyt | 5% – 10% | < 5% |
| **Wskaźnik zakupu wezwania (CVR2)** | > 7% wgrań | 3% – 7% | < 3% |
| **Koszt pozyskania transakcji (CAC)** | < 40 zł | 40 zł – 60 zł | > 60 zł |
| **Reakcja ubezpieczycieli (pilotaż 10 osób)** | min. 3 dopłaty ugodowe lub skierowanie sprawy do RF | ubezpieczyciele odrzucają, ale klienci żądają pomocy prawnej | kompletna bezużyteczność pism |

### Decyzja po teście:
- **BUDUJ:** Przejście do pełnego automatycznego wdrożenia parsera i platformy SaaS.
- **ZMIEŃ:** Przeprojektowanie oferty (np. model prowizyjny od wywalczonej dopłaty zamiast opłaty z góry lub włączenie partnera prawnego).
- **ODRZUĆ:** Trwały brak gotowości do płacenia za dokument przedprocesowy.
