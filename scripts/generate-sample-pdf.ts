import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const darkSlate = rgb(0.1, 0.15, 0.25);
  const mutedGray = rgb(0.4, 0.45, 0.5);
  const tableBorder = rgb(0.8, 0.82, 0.85);

  let y = height - 50;

  // Naglowek systemowy Audatex
  page.drawText('AUDATEX POLSKA SP. Z O.O.', { x: 50, y, size: 10, font: fontBold, color: mutedGray });
  y -= 14;
  page.drawText('KALKULACJA NAPRAWY NR: 9812-PL-2026', { x: 50, y, size: 9, font: fontRegular, color: mutedGray });
  y -= 25;

  // Tytul dokumentu
  page.drawText('KOSZTORYS NAPRAWY POJAZDU (SZKODA Z OC SPRAWCY)', { x: 50, y, size: 14, font: fontBold, color: darkSlate });
  y -= 20;

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: tableBorder });
  y -= 20;

  // Pola naglowka
  const drawField = (label: string, value: string, xPos: number, yPos: number) => {
    page.drawText(label, { x: xPos, y: yPos, size: 9, font: fontBold, color: mutedGray });
    page.drawText(value, { x: xPos, y: yPos - 12, size: 10, font: fontRegular, color: darkSlate });
  };

  drawField('ZAKLAD UBEZPIECZEN:', 'Powszechny Zaklad Ubezpieczen S.A.', 50, y);
  drawField('NUMER SZKODY:', 'PL/PZU/2026/09/99120', 320, y);
  y -= 35;

  drawField('MARKA I MODEL:', 'Toyota Corolla 1.8 Hybrid 2021', 50, y);
  drawField('NUMER REJESTRACYJNY:', 'KR 5512B', 320, y);
  y -= 35;

  drawField('DATA ZDARZENIA:', '2026-09-02', 50, y);
  drawField('MIEJSCE ZDARZENIA / WOJ.:', 'Wojewodztwo malopolskie (Krakow)', 320, y);
  y -= 35;

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: tableBorder });
  y -= 25;

  // Sekcja 1: Robocizna
  page.drawText('1. KALKULACJA KOSZTOW ROBOCIZNY', { x: 50, y, size: 11, font: fontBold, color: darkSlate });
  y -= 18;
  page.drawText('Stawka rbh robocizny: 70,00 PLN', { x: 60, y, size: 10, font: fontRegular, color: darkSlate });
  y -= 15;
  page.drawText('Prace blacharskie: 10.0 rbh | Prace lakiernicze: 8.0 rbh', { x: 60, y, size: 10, font: fontRegular, color: darkSlate });
  y -= 15;
  page.drawText('Czas naprawy: 18.0 rbh | Razem robocizna netto: 1260,00 PLN', { x: 60, y, size: 10, font: fontBold, color: darkSlate });
  y -= 25;

  // Sekcja 2: Czesci zamienne
  page.drawText('2. WYKAZ CZESCI ZAMIENNYCH ZAKWALIFIKOWANYCH DO WYMIANY', { x: 50, y, size: 11, font: fontBold, color: darkSlate });
  y -= 18;

  const parts = [
    'Zderzak przedni kpl. 52119-02B50 O 1850.00 zl urealnienie 40% (potracenie: 740,00 zl)',
    'Blotnik przedni lewy 53802-02190 PJ 450.00 zl (zastosowano zamiennik dystrybutora)',
    'Reflektor lewy LED 81150-02S20 O 2950.00 zl amortyzacja 35% (potracenie: 1032,50 zl)',
  ];

  for (const part of parts) {
    page.drawText(`- ${part}`, { x: 60, y, size: 9, font: fontRegular, color: darkSlate });
    y -= 15;
  }
  y -= 10;

  // Sekcja 3: Lakierowanie
  page.drawText('3. MATERIALY LAKIERNICZE', { x: 50, y, size: 11, font: fontBold, color: darkSlate });
  y -= 18;
  page.drawText('Materialy lakiernicze: 850,00 zl', { x: 60, y, size: 10, font: fontRegular, color: darkSlate });
  y -= 15;
  page.drawText('Rabat na material lakierniczy: 33% (potracenie: 280,50 zl)', { x: 60, y, size: 10, font: fontRegular, color: darkSlate });
  y -= 25;

  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: tableBorder });
  y -= 22;

  // Sekcja 4: Podsumowanie kalkulacji
  page.drawText('PODSUMOWANIE SZKODY (DECYZJA UBEZPIECZYCIELA):', { x: 50, y, size: 11, font: fontBold, color: darkSlate });
  y -= 18;
  page.drawText('Koszty robocizny: 1260,00 PLN', { x: 60, y, size: 9, font: fontRegular, color: darkSlate });
  y -= 14;
  page.drawText('Koszty czesci zamiennych po potraceniach: 2027,50 PLN', { x: 60, y, size: 9, font: fontRegular, color: darkSlate });
  y -= 14;
  page.drawText('Koszty lakierowania po rabacie: 569,50 PLN', { x: 60, y, size: 9, font: fontRegular, color: darkSlate });
  y -= 18;
  page.drawText('Kwota bezsporna netto: 3600.00 PLN', { x: 60, y, size: 12, font: fontBold, color: darkSlate });
  y -= 16;
  page.drawText('Kwota bezsporna brutto (z VAT 23%): 4428.00 PLN', { x: 60, y, size: 12, font: fontBold, color: darkSlate });
  y -= 35;

  page.drawText('Informacja ubezpieczyciela: Wycena sporzadzona w systemie Audatex zgodnie ze standardem ubezpieczyciela.', {
    x: 50,
    y,
    size: 8,
    font: fontRegular,
    color: mutedGray,
  });

  const pdfBytes = await pdfDoc.save();

  const outDir = path.resolve('public');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'przykladowy_kosztorys_pzu.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Wygenerowano przykładowy kosztorys PDF: ${outPath} (${pdfBytes.length} bajtów)`);
}

createSamplePdf().catch(console.error);
