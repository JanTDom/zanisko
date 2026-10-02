import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { CostEstimateParser } from './parser/pdf-parser.js';
import { runAudit } from './domain/audit-engine.js';
import { generateDemandLetter } from './domain/demand-letter.js';
import { Voivodeship } from './domain/types.js';
import { getRegionalBenchmark, REGIONAL_BENCHMARKS } from './domain/regional-rates.js';

const parser = new CostEstimateParser();

const SAMPLE_ESTIMATE_TEXT = `
AUDATEX POLSKA SP. Z O.O.
KALKULACJA NAPRAWY NR: 9812-PL-2026
Nr szkody: PL/PZU/2026/09/99120
Zakład ubezpieczeń: Powszechny Zakład Ubezpieczeń S.A.
Pojazd: Toyota Corolla 1.8 Hybrid 2021
Nr rej: KR 5512B
Data zdarzenia: 2026-09-02

STAWKI ROBOCIZNY:
Stawka rbh robocizny: 70,00 PLN
Czas naprawy: 18.0 rbh

CZĘŚCI ZAMIENNE DO WYMIANY:
Zderzak przedni kpl. 52119-02B50 O 1850.00 zł urealnienie 40%
Błotnik przedni lewy 53802-02190 PJ 450.00 zł
Reflektor lewy LED 81150-02S20 O 2950.00 zł amortyzacja 35%

LAKIEROWANIE:
Materiały lakiernicze: 850,00 zł
Rabat na materiał lakierniczy: 33%

ROZLICZENIE SZKODY:
Kwota bezsporna netto: 3600.00 PLN
`;

const HTML_PAGE = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaimCheck — Weryfikator kosztorysów naprawy z OC sprawcy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #2563eb;
      --accent-loss: #ef4444;
      --accent-success: #10b981;
      --accent-fair: #38bdf8;
      --badge-bg: rgba(59, 130, 246, 0.12);
      --badge-border: rgba(59, 130, 246, 0.3);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      padding-bottom: 80px;
    }

    header {
      border-bottom: 1px solid var(--card-border);
      background: rgba(9, 13, 22, 0.85);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 50;
      padding: 16px 24px;
    }

    .header-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-tag {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--badge-bg);
      border: 1px solid var(--badge-border);
      color: #60a5fa;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 24px;
    }

    .hero {
      text-align: center;
      margin-bottom: 48px;
    }

    .hero-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 100px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #f87171;
      margin-bottom: 20px;
    }

    h1 {
      font-family: 'Space Grotesk', sans-serif;
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 700;
      letter-spacing: -1.2px;
      line-height: 1.15;
      margin-bottom: 18px;
      color: #ffffff;
    }

    .subtitle {
      font-size: 17px;
      color: var(--text-muted);
      max-width: 760px;
      margin: 0 auto 32px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
      margin-bottom: 32px;
    }

    .dropzone-box {
      border: 2px dashed rgba(255, 255, 255, 0.16);
      border-radius: 12px;
      padding: 40px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(255, 255, 255, 0.02);
    }

    .dropzone-box:hover, .dropzone-box.dragover {
      border-color: var(--primary);
      background: rgba(59, 130, 246, 0.05);
    }

    .dropzone-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .dropzone-desc {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }
    .btn-primary:hover {
      background: var(--primary-hover);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border: 1px solid var(--card-border);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.14);
    }

    .sample-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      margin-top: 18px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .form-group {
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    select, textarea, input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: white;
      font-family: inherit;
      font-size: 14px;
    }

    select:focus, textarea:focus, input:focus {
      outline: none;
      border-color: var(--primary);
    }

    /* Wyniki audytu */
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .metric-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 22px;
    }

    .metric-label {
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: 8px;
    }

    .metric-val {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .metric-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .val-undisputed { color: var(--text-muted); }
    .val-loss { color: var(--accent-loss); }
    .val-fair { color: var(--accent-fair); }

    .violation-card {
      background: rgba(15, 23, 42, 0.6);
      border-left: 4px solid var(--accent-loss);
      border-radius: 0 10px 10px 0;
      padding: 18px 20px;
      margin-bottom: 14px;
      border-top: 1px solid var(--card-border);
      border-right: 1px solid var(--card-border);
      border-bottom: 1px solid var(--card-border);
    }

    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .violation-title {
      font-weight: 700;
      font-size: 16px;
    }

    .violation-amount {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      color: var(--accent-loss);
      font-size: 18px;
    }

    .violation-legal {
      font-size: 12px;
      color: #60a5fa;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .violation-desc {
      font-size: 14px;
      color: #cbd5e1;
    }

    .violation-items {
      margin-top: 10px;
      padding-left: 18px;
      font-size: 13px;
      color: var(--text-muted);
    }

    /* Modal / Preview */
    .letter-preview {
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 24px;
      font-family: monospace;
      font-size: 13px;
      white-space: pre-wrap;
      max-height: 480px;
      overflow-y: auto;
      margin: 20px 0;
      color: #e2e8f0;
      line-height: 1.5;
    }

    .hidden { display: none; }

    footer {
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 60px;
    }
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <div class="brand">
        ClaimCheck
        <span class="brand-tag">Audyt KNF</span>
      </div>
      <div style="font-size: 13px; color: var(--text-muted);">
        Tryb przedsądowy: Ustawa o reklamacjach rynku finansowego
      </div>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <div class="hero-badge">Ponad 70% kosztorysów OC zawiera bezprawne zaniżenia</div>
      <h1>Odzyskaj zaniżone odszkodowanie z OC sprawcy</h1>
      <p class="subtitle">
        Wgraj kosztorys od ubezpieczyciela (Audatex, Eurotax, DAT). W 30 sekund wyliczymy zaniżenie
        według Rekomendacji KNF i uchwał Sądu Najwyższego oraz wygenerujemy formalne przedsądowe wezwanie do zapłaty.
      </p>
    </div>

    <!-- Panel wejściowy -->
    <div class="card" id="input-card">
      <div class="form-group" style="max-width: 380px; margin-bottom: 24px;">
        <label for="voivodeship">Województwo miejsca zamieszkania poszkodowanego:</label>
        <select id="voivodeship">
          <option value="mazowieckie">mazowieckie (stawka ref. 165 zł/h)</option>
          <option value="slaskie">śląskie (stawka ref. 155 zł/h)</option>
          <option value="malopolskie">małopolskie (stawka ref. 155 zł/h)</option>
          <option value="wielkopolskie">wielkopolskie (stawka ref. 155 zł/h)</option>
          <option value="dolnoslaskie">dolnośląskie (stawka ref. 160 zł/h)</option>
          <option value="pomorskie">pomorskie (stawka ref. 155 zł/h)</option>
          <option value="lodzkie">łódzkie (stawka ref. 150 zł/h)</option>
          <option value="kujawsko-pomorskie">kujawsko-pomorskie (stawka ref. 145 zł/h)</option>
          <option value="zachodniopomorskie">zachodniopomorskie (stawka ref. 150 zł/h)</option>
          <option value="lubelskie">lubelskie (stawka ref. 145 zł/h)</option>
          <option value="podkarpackie">podkarpackie (stawka ref. 145 zł/h)</option>
          <option value="swietokrzyskie">świętokrzyskie (stawka ref. 140 zł/h)</option>
          <option value="podlaskie">podlaskie (stawka ref. 145 zł/h)</option>
          <option value="lubuskie">lubuskie (stawka ref. 145 zł/h)</option>
          <option value="warminsko-mazurskie">warmińsko-mazurskie (stawka ref. 140 zł/h)</option>
          <option value="opolskie">opolskie (stawka ref. 145 zł/h)</option>
        </select>
      </div>

      <div class="dropzone-box" id="dropzone">
        <div class="dropzone-title">Upuść kosztorys PDF lub wklej tekst kalkulacji</div>
        <div class="dropzone-desc">Obsługujemy kalkulacje Audatex, Eurotax oraz kosztorysy PZU, Warta, Ergo Hestia, Generali itp.</div>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('file-input').click()">
          Wybierz plik PDF
        </button>
        <input type="file" id="file-input" accept=".pdf,.txt" style="display: none;">
      </div>

      <div class="sample-bar">
        <span>Przetestuj z przykładowym plikiem:</span>
        <button type="button" class="btn btn-secondary" style="padding: 6px 14px; font-size: 12px;" onclick="loadSample()">
          Wczytaj przykładowy kosztorys (tekst)
        </button>
        <a href="/przykladowy_kosztorys_pzu.pdf" download="przykladowy_kosztorys_pzu.pdf" class="btn btn-secondary" style="padding: 6px 14px; font-size: 12px; text-decoration: none;">
          Pobierz plik PDF do testów (2.6 KB)
        </a>
      </div>

      <div id="manual-text-wrap" style="margin-top: 24px;">
        <label for="raw-text">Lub wklej treść kosztorysu:</label>
        <textarea id="raw-text" rows="5" placeholder="Wklej tekst kalkulacji naprawy z ubezpieczalni..."></textarea>
        <button type="button" class="btn btn-primary" style="margin-top: 12px; width: 100%;" onclick="runAnalysis()">
          Uruchom audyt kosztorysu
        </button>
      </div>
    </div>

    <!-- Wyniki analizy -->
    <div id="results-card" class="card hidden">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 24px; font-weight: 700;">Raport audytu kosztorysu</h2>
          <div id="claim-details" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;"></div>
        </div>
        <button class="btn btn-secondary" onclick="resetView()">Wgraj inny kosztorys</button>
      </div>

      <div class="results-grid">
        <div class="metric-card">
          <div class="metric-label">Wypłacona kwota bezsporna</div>
          <div class="metric-val val-undisputed" id="m-undisputed">0 zł</div>
          <div class="metric-sub">Tyle ubezpieczyciel przelał na konto</div>
        </div>

        <div class="metric-card" style="border-color: rgba(239, 68, 68, 0.4);">
          <div class="metric-label">Wykryte zaniżenie odszkodowania</div>
          <div class="metric-val val-loss" id="m-loss">+0 zł</div>
          <div class="metric-sub" id="m-violations-count">0 niezgodności z wytycznymi KNF</div>
        </div>

        <div class="metric-card" style="border-color: rgba(56, 189, 248, 0.4);">
          <div class="metric-label">Należne odszkodowanie (KNF / SN)</div>
          <div class="metric-val val-fair" id="m-fair">0 zł</div>
          <div class="metric-sub">Rzetelna wartość przywrócenia do stanu sprzed szkody</div>
        </div>
      </div>

      <h3 style="font-size: 18px; margin-bottom: 14px;">Wykryte uchybienia i naruszenia przepisów</h3>
      <div id="violations-list"></div>

      <!-- Krok do zakupu wezwania -->
      <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid var(--badge-border); border-radius: 12px; padding: 24px; margin-top: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: gap; gap: 16px;">
          <div>
            <h3 style="font-size: 18px; color: #ffffff;">Pobierz formalne Przedsądowe Wezwanie do Zapłaty</h3>
            <p style="font-size: 13px; color: var(--text-muted); max-width: 600px; margin-top: 4px;">
              Pismo procesowe w reżimie Ustawy o reklamacjach z sztywnym terminem 30 dni pod rygorem
              uznania roszczenia w całości z mocy prawa (art. 8 ustawy).
            </p>
          </div>
          <button class="btn btn-primary" style="font-size: 16px; padding: 14px 28px;" onclick="openLetterModal()">
            Pobierz wezwanie (59 zł)
          </button>
        </div>
      </div>
    </div>

    <!-- Modal pisma -->
    <div id="letter-modal" class="card hidden">
      <h2 style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">Dane do wygenerowania wezwania do zapłaty</h2>
      <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
        Uzupełnij swoje dane poszkodowanego i numer konta, aby pismo było kompletne i gotowe do wysłania do ubezpieczyciela.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div class="form-group">
          <label for="claimant-name">Imię i nazwisko / nazwa poszkodowanego:</label>
          <input type="text" id="claimant-name" value="Jan Kowalski">
        </div>
        <div class="form-group">
          <label for="claimant-address">Adres zamieszkania:</label>
          <input type="text" id="claimant-address" value="ul. Marszałkowska 10/12, 00-001 Warszawa">
        </div>
        <div class="form-group" style="grid-column: span 2;">
          <label for="bank-account">Numer rachunku bankowego do dopłaty odszkodowania:</label>
          <input type="text" id="bank-account" value="12 1020 1026 0000 1234 5678 9012">
        </div>
      </div>

      <button class="btn btn-primary" style="width: 100%; margin-bottom: 20px;" onclick="generateFinalLetter()">
        Generuj i odblokuj wezwanie przedsądowe
      </button>

      <div id="letter-output-wrap" class="hidden">
        <h3 style="font-size: 16px;">Podgląd wygenerowanego dokumentu:</h3>
        <div class="letter-preview" id="letter-content"></div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-primary" onclick="copyLetter()">Kopiuj treść pisma</button>
          <button class="btn btn-secondary" onclick="printLetter()">Drukuj / Zapisz jako PDF</button>
        </div>
      </div>
    </div>

    <footer>
      ClaimCheck Polska — Niezależny system weryfikacji kalkulacji szkód komunikacyjnych.<br>
      Wszelkie wyliczenia oparte na Rekomendacjach KNF z dnia 1 listopada 2022 r. oraz uchwale SN III CZP 80/11.
    </footer>
  </div>

  <script>
    let currentAuditReport = null;

    function loadSample() {
      fetch('/api/sample')
        .then(r => r.text())
        .then(text => {
          document.getElementById('raw-text').value = text;
          document.getElementById('voivodeship').value = 'malopolskie';
          runAnalysis();
        });
    }

    function runAnalysis() {
      const text = document.getElementById('raw-text').value;
      const voivodeship = document.getElementById('voivodeship').value;

      if (!text || text.trim().length < 20) {
        alert('Proszę wkleić treść kosztorysu lub załadować przykład.');
        return;
      }

      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text, voivodeship })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert('Błąd audytu: ' + data.error);
          return;
        }
        currentAuditReport = data;
        renderResults(data);
      });
    }

    function renderResults(data) {
      document.getElementById('input-card').classList.add('hidden');
      document.getElementById('results-card').classList.remove('hidden');

      const s = data.summary;
      const h = data.header;

      document.getElementById('claim-details').innerText = 
        'Szkoda nr: ' + h.claimNumber + ' | Ubezpieczyciel: ' + h.insurerName + ' | Pojazd: ' + h.vehicleMakeModel + ' (' + h.registrationNumber + ')';

      document.getElementById('m-undisputed').innerText = s.undisputedAmountGross.toFixed(2) + ' zł';
      document.getElementById('m-loss').innerText = '+' + s.totalLossGross.toFixed(2) + ' zł';
      document.getElementById('m-violations-count').innerText = data.violations.length + ' wykryte naruszenia wytycznych KNF / SN';
      document.getElementById('m-fair').innerText = s.fairAmountGross.toFixed(2) + ' zł';

      const violationsList = document.getElementById('violations-list');
      violationsList.innerHTML = '';

      data.violations.forEach(v => {
        const item = document.createElement('div');
        item.className = 'violation-card';
        item.innerHTML = \`
          <div class="violation-header">
            <span class="violation-title">\${v.title}</span>
            <span class="violation-amount">+\${v.lossGross.toFixed(2)} zł brutto</span>
          </div>
          <div class="violation-legal">\${v.legalBasis}</div>
          <div class="violation-desc">\${v.description}</div>
          \${v.affectedItems && v.affectedItems.length ? \`
            <ul class="violation-items">
              \${v.affectedItems.map(it => '<li>' + it + '</li>').join('')}
            </ul>
          \` : ''}
        \`;
        violationsList.appendChild(item);
      });
    }

    function resetView() {
      document.getElementById('results-card').classList.add('hidden');
      document.getElementById('letter-modal').classList.add('hidden');
      document.getElementById('input-card').classList.remove('hidden');
    }

    function openLetterModal() {
      document.getElementById('letter-modal').classList.remove('hidden');
      document.getElementById('letter-modal').scrollIntoView({ behavior: 'smooth' });
    }

    function generateFinalLetter() {
      if (!currentAuditReport) return;

      const claimantName = document.getElementById('claimant-name').value;
      const claimantAddress = document.getElementById('claimant-address').value;
      const bankAccountNumber = document.getElementById('bank-account').value;

      fetch('/api/generate-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report: currentAuditReport,
          options: { claimantName, claimantAddress, bankAccountNumber }
        })
      })
      .then(r => r.json())
      .then(res => {
        document.getElementById('letter-output-wrap').classList.remove('hidden');
        document.getElementById('letter-content').innerText = res.letter;
        document.getElementById('letter-output-wrap').scrollIntoView({ behavior: 'smooth' });
      });
    }

    function copyLetter() {
      const text = document.getElementById('letter-content').innerText;
      navigator.clipboard.writeText(text).then(() => {
        alert('Treść wezwania została skopiowana do schowka.');
      });
    }

    function printLetter() {
      const text = document.getElementById('letter-content').innerText;
      const printWindow = window.open('', '_blank');
      printWindow.document.write('<pre style="font-family: Arial; white-space: pre-wrap; padding: 20px;">' + text + '</pre>');
      printWindow.document.close();
      printWindow.print();
    }

    // Obsługa przeciągania i wgrywania plików PDF
    const fileInput = document.getElementById('file-input');
    const dropzone = document.getElementById('dropzone');

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
      }
    });

    function handleFile(file) {
      const voivodeship = document.getElementById('voivodeship').value;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const arrayBuffer = e.target.result;
          const bytes = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          fetch('/api/upload-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfBase64: base64, voivodeship })
          })
          .then(r => r.json())
          .then(data => {
            if (data.error) {
              alert('Błąd odczytu pliku PDF: ' + data.error);
              return;
            }
            currentAuditReport = data.auditReport;
            renderResults(data.auditReport);
          })
          .catch(err => alert('Błąd sieciowy: ' + err.message));
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = function(e) {
          document.getElementById('raw-text').value = e.target.result;
          runAnalysis();
        };
        reader.readAsText(file);
      }
    }
  </script>
</body>
</html>
`;

export function createServer(port = 3000) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // GET / - Główna aplikacja
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(HTML_PAGE);
      return;
    }

    // GET /przykladowy_kosztorys_pzu.pdf - Pobranie przykładowego pliku PDF
    if (req.method === 'GET' && (url.pathname === '/przykladowy_kosztorys_pzu.pdf' || url.pathname === '/sample_kosztorys_pzu.pdf')) {
      const pdfPath = path.resolve('public/przykladowy_kosztorys_pzu.pdf');
      if (fs.existsSync(pdfPath)) {
        const stat = fs.statSync(pdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="przykladowy_kosztorys_pzu.pdf"',
        });
        fs.createReadStream(pdfPath).pipe(res);
        return;
      }
    }

    // GET /api/sample - Przykładowy kosztorys (tekst)
    if (req.method === 'GET' && url.pathname === '/api/sample') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(SAMPLE_ESTIMATE_TEXT);
      return;
    }

    // GET /health - Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // POST /api/upload-pdf - Odczyt i audyt wgranego pliku PDF
    if (req.method === 'POST' && url.pathname === '/api/upload-pdf') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const pdfBuffer = Buffer.from(payload.pdfBase64, 'base64');
          const voivodeship = (payload.voivodeship ?? 'mazowieckie') as Voivodeship;

          const pdfInstance = new PDFParse({ data: new Uint8Array(pdfBuffer) });
          const textResult = await pdfInstance.getText();

          const parsed = parser.parseText(textResult.text, voivodeship);
          const auditReport = runAudit(parsed.estimate);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ auditReport, extractedText: textResult.text }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd przetwarzania pliku PDF';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/audit - Przetwarzanie kosztorysu i audyt
    if (req.method === 'POST' && url.pathname === '/api/audit') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const rawText = payload.rawText ?? '';
          const voivodeship = (payload.voivodeship ?? 'mazowieckie') as Voivodeship;

          const parsed = parser.parseText(rawText, voivodeship);
          const auditReport = runAudit(parsed.estimate);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(auditReport));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Nieprawidłowe żądanie';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/generate-letter - Generowanie pisma procesowego
    if (req.method === 'POST' && url.pathname === '/api/generate-letter') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const letter = generateDemandLetter(payload.report, payload.options);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ letter }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Nieprawidłowe żądanie';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

// Uruchomienie serwera jeśli wywołany bezpośrednio
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  const PORT = Number(process.env.PORT) || 3000;
  const server = createServer(PORT);
  server.listen(PORT, () => {
    console.log(`ClaimCheck server running on http://localhost:${PORT}`);
  });
}
