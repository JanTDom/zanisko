import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Serwis OCR do ekstrakcji tekstu z fotografii i skanów kosztorysów naprawy (PNG, JPG, TIFF).
 * Umożliwia rozpoznawanie tabel i kwot ze zdjęć wykonanych smartfonem.
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<OcrResult> {
  const worker = await createWorker('pol+eng');

  try {
    const ret = await worker.recognize(imageBuffer);
    await worker.terminate();

    return {
      text: ret.data.text,
      confidence: ret.data.confidence,
    };
  } catch (err) {
    await worker.terminate();
    throw new Error(`Błąd silnika OCR: ${err instanceof Error ? err.message : String(err)}`);
  }
}
