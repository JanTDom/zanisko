/**
 * Moduł typografii polskiej:
 * - Zamiana em-dash (—) na en-dash (–)
 * - Likwidacja wiszących spójników i przyimków (sierotek): a, i, o, u, w, z
 * - Wiązanie liczb z jednostkami, skrótami prawnymi i walutami
 * - Zabezpieczenie przed łamaniem wierszy wewnątrz wyrażeń złożonych
 */

export function fixPolishTypography(text: string, isHtml = false): string {
  if (!text) return '';

  const nbsp = isHtml ? '&nbsp;' : '\u00A0';

  // 1. Zamiana pauzy (em-dash) na półpauzę (en-dash) zgodnie z wytycznymi
  let s = text.replace(/—/g, '–');

  // 2. Wiązanie liczb z jednostkami i walutami (np. 100 zł, 14 dni, 2026 r., 35%)
  s = s.replace(
    /(\d+)\s+(zł|PLN|rbh|zł\/rbh|dni|dnia|dniach|godz|godzin|proc|%|r\.|lat|lata|roku)(?=[ ,.;:)!?'\"„”]|$)/gi,
    (m, num, unit) => `${num}${nbsp}${unit}`
  );

  // 3. Spójniki jednoliterowe (sierotki) na początku lub w środku wiersza
  // a, i, o, u, w, z (wielkie i małe)
  const singleLetterRegex = /(^|[ \u00A0\t\n(„\"'–—>])([aiouwzAIOUWZ]) +/g;
  let prev = '';
  do {
    prev = s;
    s = s.replace(singleLetterRegex, (m, prefix, letter) => `${prefix}${letter}${nbsp}`);
  } while (s !== prev);

  // 4. Krótkie przyimki, spójniki i skróty prawne
  // do, na, od, po, ze, we, za, co, że, to, np., m.in., art., ust., pkt, poz., sygn., akt, nr, k.c.
  const shortWordsRegex = /(^|[ \u00A0\t\n(„\"'–—>])(do|na|od|po|ze|we|za|co|że|to|np\.|m\.in\.|art\.|ust\.|pkt|poz\.|sygn\.|akt|nr) +/gi;
  do {
    prev = s;
    s = s.replace(shortWordsRegex, (m, prefix, word) => `${prefix}${word}${nbsp}`);
  } while (s !== prev);

  return s;
}

/**
 * Bezpiecznie aplikuje polską typografię do kodu HTML,
 * modyfikując wyłącznie węzły tekstowe poza znacznikami <...>.
 */
export function fixPolishTypographyInHtml(html: string): string {
  if (!html) return '';

  // Dzielimy na znaczniki i tekst poza nimi
  return html.replace(/(>|^)([^<]+)(<|$)/g, (match, prefix, textContent, suffix) => {
    return prefix + fixPolishTypography(textContent, true) + suffix;
  });
}
