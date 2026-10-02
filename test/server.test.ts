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
    expect(text).toContain('Weryfikator kosztorysów naprawy z OC sprawcy');
    expect(text).toContain('Odzyskaj zaniżone odszkodowanie');
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
});
