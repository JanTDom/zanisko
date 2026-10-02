import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractTextFromImage } from '../src/parser/ocr-service.js';

describe('ClaimCheck OCR Service', () => {
  it('powinien zainicjalizować tesseract worker i przetworzyć bufor obrazu', async () => {
    // Sprawdzamy czy istnieje którekolwiek ze zdjęć w public/images
    const imgPath = path.resolve('public/images/desk-audit-comparison.jpg');
    if (!fs.existsSync(imgPath)) {
      console.warn('Brak pliku obrazu do testu OCR, pomijam.');
      return;
    }

    const imgBuffer = fs.readFileSync(imgPath);
    // Uruchomienie rozpoznawania OCR na rzeczywistym zdjęciu kosztorysu z kalkulatorem
    const result = await extractTextFromImage(imgBuffer);

    expect(result).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
    // Zdjęcie desk-audit-comparison zawiera wydrukowany kosztorys i laptop z kwotami
    expect(result.confidence).toBeGreaterThan(0);
  }, 30000); // 30s timeout na pobranie wag tesseract
});
