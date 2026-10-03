import { describe, it, expect } from 'vitest';
import { fixPolishTypography, fixPolishTypographyInHtml } from '../src/domain/typography.js';

describe('Polish Typography Engine (Zasady składu i eliminacja sierotek)', () => {
  it('powinien zamienić em-dash (—) na en-dash (–)', () => {
    const input = 'Odszkodowanie — na czym polega zaniżanie — wyjaśnienie.';
    const output = fixPolishTypography(input);
    expect(output).not.toContain('—');
    expect(output).toContain('–');
  });

  it('powinien powiązać spójniki jednoliterowe twardą spacją (brak wiszących liter)', () => {
    const input = 'Sprawa dotyczy szkody w pojeździe i w warsztacie z ubezpieczenia.';
    const output = fixPolishTypography(input);
    // Litery 'w', 'i', 'z' powinny mieć twardą spację \u00A0 po sobie
    expect(output).toContain('w\u00A0pojeździe');
    expect(output).toContain('i\u00A0w\u00A0warsztacie');
    expect(output).toContain('z\u00A0ubezpieczenia');
  });

  it('powinien powiązać liczby z jednostkami i walutami', () => {
    const input = 'Termin wynosi 14 dni, a kwota to 3300 PLN i stawka 175 zł/rbh w 2026 r.';
    const output = fixPolishTypography(input);
    expect(output).toContain('14\u00A0dni');
    expect(output).toContain('3300\u00A0PLN');
    expect(output).toContain('175\u00A0zł/rbh');
    expect(output).toContain('2026\u00A0r.');
  });

  it('powinien poprawnie przetworzyć kod HTML bez uszkadzania atrybutów tagów', () => {
    const input = '<div class="banner">Zaniżenie — sprawdź w aucie do 30 dni. <a href="/test?a=1&b=2">Link</a></div>';
    const output = fixPolishTypographyInHtml(input);
    expect(output).toContain('Zaniżenie – sprawdź w&nbsp;aucie do&nbsp;30&nbsp;dni.');
    expect(output).toContain('<a href="/test?a=1&b=2">Link</a>');
  });
});
