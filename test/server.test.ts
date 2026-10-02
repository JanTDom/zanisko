import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../src/server.js';
import http from 'node:http';

describe('ClaimCheck Web Server (Integracja API i UI)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createServer(0); // Port 0 przypisuje wolny losowy port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('GET / powinien zwrócić stronę główną aplikacji (HTML)', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ClaimCheck');
    expect(text).toContain('audytor kosztorysów naprawy z OC sprawcy');
    expect(text).toContain('Odzyskaj należne odszkodowanie');
    expect(text).toContain('hero-claim-comparison.jpg');
    expect(text).toContain('Odblokuj pełny audyt');
  });

  it('GET /images/:filename powinien serwować zdjęcia wgrane przez użytkownika', async () => {
    const res = await fetch(`${baseUrl}/images/hero-claim-comparison.jpg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(10000);
  });

  it('GET /api/benchmarks powinien zwrócić bazę stawek 16 województw', async () => {
    const res = await fetch(`${baseUrl}/api/benchmarks`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mazowieckie).toBeDefined();
    expect(data.mazowieckie.rate).toBe(175);
    expect(data.slaskie.rate).toBe(165);
  });

  it('GET /api/sample powinien zwrócić przykładowy kosztorys Audatex', async () => {
    const res = await fetch(`${baseUrl}/api/sample`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('AUDATEX POLSKA');
    expect(text).toContain('Powszechny Zakład Ubezpieczeń S.A.');
  });

  it('POST /api/audit powinien przeprowadzić poprawny audyt i zwrócić raport', async () => {
    const sampleTextRes = await fetch(`${baseUrl}/api/sample`);
    const sampleText = await sampleTextRes.text();

    const auditRes = await fetch(`${baseUrl}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: sampleText,
        voivodeship: 'mazowieckie',
      }),
    });

    expect(auditRes.status).toBe(200);
    const data = await auditRes.json();
    expect(data.summary).toBeDefined();
    expect(data.summary.totalLossGross).toBeGreaterThan(1000);
    expect(data.violations.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/generate-letter powinien wygenerować formalne wezwanie', async () => {
    const sampleTextRes = await fetch(`${baseUrl}/api/sample`);
    const sampleText = await sampleTextRes.text();

    const auditRes = await fetch(`${baseUrl}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: sampleText,
        voivodeship: 'mazowieckie',
      }),
    });
    const report = await auditRes.json();

    const letterRes = await fetch(`${baseUrl}/api/generate-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report,
        options: {
          claimantName: 'Anna Nowak',
          claimantAddress: 'ul. Floriańska 5, 31-019 Kraków',
          bankAccountNumber: '99 1020 0000 1111 2222 3333 4444',
        },
      }),
    });

    expect(letterRes.status).toBe(200);
    const letterData = await letterRes.json();
    expect(letterData.letter).toContain('PRZEDSĄDOWE WEZWANIE DO ZAPŁATY');
    expect(letterData.letter).toContain('Anna Nowak');
    expect(letterData.letter).toContain('99 1020 0000 1111 2222 3333 4444');
    expect(letterData.letter).toContain('art. 5 ust. 1');
  });

  it('GET /przykladowy_kosztorys_pzu.pdf powinien serwować binarny plik PDF', async () => {
    const res = await fetch(`${baseUrl}/przykladowy_kosztorys_pzu.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1500);
  });

  it('GET /api/sample/txt powinien zwrócić plik tekstowy kosztorysu do pobrania', async () => {
    const res = await fetch(`${baseUrl}/api/sample/txt`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    const text = await res.text();
    expect(text).toContain('AUDATEX POLSKA');
  });

  it('POST /api/gemini/compare-damage powinien przeanalizować uszkodzenia i zwrócić rozbieżności', async () => {
    const res = await fetch(`${baseUrl}/api/gemini/compare-damage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoBase64: 'dGVzdA==',
        estimateText: 'Zderzak przedni kpl.',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.omittedDamages).toBeDefined();
    expect(data.omittedDamages.length).toBeGreaterThan(0);
    expect(data.totalOmittedValuePln).toBeGreaterThan(0);
  });

  it('POST /api/gemini/enhance-letter powinien zwrócić spersonalizowane wezwanie', async () => {
    const sampleTextRes = await fetch(`${baseUrl}/api/sample`);
    const sampleText = await sampleTextRes.text();

    const auditRes = await fetch(`${baseUrl}/api/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: sampleText, voivodeship: 'mazowieckie' }),
    });
    const report = await auditRes.json();

    const res = await fetch(`${baseUrl}/api/gemini/enhance-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report,
        claimantName: 'Piotr Zieliński',
        claimantAddress: 'ul. Marszałkowska 1',
        bankAccountNumber: '12 1020 0000 0000 0000 0000 0000',
        userContext: 'Pojazd używany w działalności gospodarczej',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.letter).toContain('PRZEDSĄDOWE WEZWANIE DO ZAPŁATY');
    expect(data.letter).toContain('Piotr Zieliński');
    expect(data.letter).not.toContain('*');
  });
});
