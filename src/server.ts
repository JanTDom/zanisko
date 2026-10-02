import './polyfills.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { CostEstimateParser } from './parser/pdf-parser.js';
import { runAudit } from './domain/audit-engine.js';
import { generateDemandLetter } from './domain/demand-letter.js';
import { Voivodeship, VehicleSegment, AuditReport } from './domain/types.js';
import { getRegionalBenchmark, REGIONAL_BENCHMARKS } from './domain/regional-rates.js';
import { extractTextFromImage } from './parser/ocr-service.js';
import { GeminiService } from './services/gemini-service.js';
import { generateAttachment1Audit, generateAttachment2PimRates, generateAttachment3LegalBasis } from './domain/attachments.js';
import { exportToDoc, exportToRtf, exportToTxt, exportToPdf } from './services/document-exporter.js';
import { demandLetterToHtml } from './domain/demand-letter.js';

if (typeof (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile === 'function') {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      (process as unknown as { loadEnvFile: (path: string) => void }).loadEnvFile(envPath);
    } catch {
      // Opcjonalny plik .env
    }
  }
}

const parser = new CostEstimateParser();
const geminiService = new GeminiService();

const SAMPLE_ESTIMATE_TEXT = `AUDATEX POLSKA SP. Z O.O.
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
  <title>zanisko.pl — Niezależny audytor kosztorysów naprawy z OC sprawcy</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/images/favicon-192.png">
  <link rel="shortcut icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/images/favicon-192.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --surface: #0f1420;
      --surface-elevated: #161d2e;
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(56, 189, 248, 0.3);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #38bdf8;
      --accent-emerald: #10b981;
      --accent-crimson: #f43f5e;
      --accent-amber: #f59e0b;
      --gradient-card: linear-gradient(180deg, rgba(22, 29, 46, 0.7) 0%, rgba(15, 20, 32, 0.9) 100%);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.07) 0%, transparent 50%),
        radial-gradient(circle at 100% 20%, rgba(16, 185, 129, 0.05) 0%, transparent 40%);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 120px;
    }

    /* TYPOGRAFIA */
    h1, h2, h3, h4, .brand-font {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }

    /* NAWIGACJA */
    nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(7, 9, 14, 0.9);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
    }
    .nav-inner {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 16px;
      text-decoration: none;
      color: var(--text);
    }
    .brand-logo img {
      height: 56px;
      max-height: 58px;
      width: auto;
      object-fit: contain;
      display: block;
      transition: transform 0.2s ease;
    }
    .brand-logo:hover img {
      transform: scale(1.02);
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #0284c7 0%, #0f766e 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
      color: #fff;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
    }
    .brand-tag {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 20px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent);
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .nav-status {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-emerald);
      border-radius: 50%;
      box-shadow: 0 0 10px var(--accent-emerald);
    }

    /* KONTENER GŁÓWNY */
    .container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* HERO SECTION */
    .hero {
      padding: 70px 0 50px;
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 48px;
      align-items: center;
    }
    @media (max-width: 960px) {
      .hero { grid-template-columns: 1fr; padding: 40px 0; }
    }
    .hero-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 100px;
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(34px, 4.2vw, 54px);
      margin-bottom: 20px;
      color: #fff;
    }
    .hero-lead {
      font-size: 17px;
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 32px;
    }
    .hero-stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .stat-box .stat-val {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      font-family: 'Space Grotesk', sans-serif;
    }
    .stat-box .stat-desc {
      font-size: 12px;
      color: var(--text-dim);
      margin-top: 2px;
    }

    /* HERO IMAGE CARD */
    .hero-visual-card {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      background: var(--surface);
    }
    .hero-visual-card img {
      width: 100%;
      height: 380px;
      object-fit: cover;
      display: block;
      filter: brightness(0.95);
    }
    .hero-card-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 24px;
      background: linear-gradient(180deg, transparent 0%, rgba(7, 9, 14, 0.95) 80%);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .overlay-tag {
      font-size: 11px;
      color: var(--accent);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .overlay-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-top: 4px;
    }
    .overlay-diff {
      text-align: right;
    }
    .diff-badge {
      display: inline-block;
      padding: 6px 12px;
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #34d399;
      font-weight: 700;
      font-size: 16px;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
    }

    /* NARZĘDZIE AUDYTU - KARTA ROBOCZA */
    .tool-section {
      margin-top: 10px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .section-header {
      margin-bottom: 28px;
    }
    .section-header h2 {
      font-size: 26px;
      color: #fff;
    }
    .section-header p {
      font-size: 15px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* TABS */
    .input-tabs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
    }
    .tab-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 10px 18px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tab-btn:hover {
      border-color: var(--accent);
      color: #fff;
    }
    .tab-btn.active {
      background: var(--surface-elevated);
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: 0 0 16px rgba(56, 189, 248, 0.15);
    }

    /* DROP ZONES */
    .dropzone {
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 44px 24px;
      text-align: center;
      background: rgba(22, 29, 46, 0.4);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: var(--accent);
      background: rgba(56, 189, 248, 0.05);
    }
    .dropzone-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      color: var(--accent);
    }
    .dropzone-title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 6px;
    }
    .dropzone-sub {
      font-size: 13px;
      color: var(--text-dim);
    }

    /* PARAMETRY POJAZDU I WOJEWÓDZTWA */
    .params-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin: 24px 0;
      padding: 20px;
      background: rgba(7, 9, 14, 0.5);
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .param-field label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .param-field select, .param-field input {
      width: 100%;
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    .param-field select:focus, .param-field input:focus {
      border-color: var(--accent);
    }

    /* PRZYCISKI AKCJI */
    .action-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      align-items: center;
      margin-top: 20px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      border: none;
      padding: 14px 26px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 20px rgba(2, 132, 199, 0.35);
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--surface-elevated);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 14px 22px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-secondary:hover {
      border-color: rgba(255, 255, 255, 0.25);
      background: #1c2438;
    }

    /* TOAST ALERT */
    #statusToast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0f172a;
      border: 1px solid var(--accent);
      color: #fff;
      padding: 14px 20px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
      display: none;
      z-index: 999;
      font-size: 14px;
      font-weight: 600;
    }

    /* SEKCJA WYNIKÓW AUDYTU */
    #auditResultsArea {
      margin-top: 40px;
      display: none;
    }

    /* TEASER BANNER (DARMOWY WIDOK) */
    .teaser-card {
      background: linear-gradient(180deg, #131a29 0%, #0e1422 100%);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 28px;
      position: relative;
      overflow: hidden;
    }
    .teaser-glow {
      position: absolute;
      top: -50px;
      right: -50px;
      width: 250px;
      height: 250px;
      background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .teaser-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .teaser-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .discrepancy-scale {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .scale-bar {
      height: 8px;
      flex: 1;
      max-width: 240px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
    }
    .scale-fill {
      height: 100%;
      width: 85%;
      background: linear-gradient(90deg, #f59e0b, #ef4444);
    }

    /* KARTY KOSZTÓW */
    .cost-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .cost-card {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
    }
    .cost-card.highlight {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.05);
    }
    .cost-label {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .cost-amount {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      font-family: 'Space Grotesk', sans-serif;
    }
    .cost-amount.emerald { color: #34d399; }
    .cost-amount.crimson { color: #f87171; }
    .cost-sub {
      font-size: 12px;
      color: var(--text-dim);
      margin-top: 4px;
    }

    /* ZABLOKOWANE POZYCJE (BLUR EFFECT) */
    .locked-section-container {
      position: relative;
      margin-top: 24px;
    }
    .blur-preview {
      filter: blur(5px);
      user-select: none;
      pointer-events: none;
      opacity: 0.6;
    }
    .paywall-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(15, 20, 32, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      z-index: 20;
    }
    .paywall-overlay h3 {
      font-size: 22px;
      color: #fff;
      margin-bottom: 8px;
    }
    .paywall-overlay p {
      font-size: 14px;
      color: var(--text-muted);
      max-width: 520px;
      margin-bottom: 20px;
    }

    /* WYKAZ NARUSZEŃ (ODBLOKOWANY) */
    .violation-card {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-left: 4px solid var(--accent);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .violation-card.severity-high {
      border-left-color: var(--accent-crimson);
    }
    .violation-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }
    .violation-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .violation-amount {
      font-size: 16px;
      font-weight: 700;
      color: #f87171;
      font-family: 'Space Grotesk', sans-serif;
    }
    .violation-basis {
      font-size: 12px;
      color: var(--accent);
      margin-bottom: 8px;
      font-weight: 600;
    }
    .violation-desc {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .violation-items {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
      color: var(--text-dim);
    }
    .violation-items li {
      margin-left: 18px;
      margin-top: 4px;
    }

    /* KALENDARIUM 30 DNI */
    .timeline-card {
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      margin: 28px 0;
    }
    .timeline-steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-top: 20px;
      position: relative;
    }
    .timeline-step {
      background: rgba(7, 9, 14, 0.6);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      position: relative;
    }
    .timeline-step.critical {
      border-color: rgba(244, 63, 94, 0.4);
      background: rgba(244, 63, 94, 0.05);
    }
    .timeline-step.success {
      border-color: rgba(16, 185, 129, 0.4);
      background: rgba(16, 185, 129, 0.05);
    }
    .step-day {
      font-size: 12px;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .step-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }
    .step-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    /* FORMULARZ I GENERATOR PISMA */
    .letter-section {
      margin-top: 36px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px;
    }
    .claimant-form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .letter-sheet {
      background: #0b0f19;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 32px;
      font-family: 'Space Grotesk', monospace, sans-serif;
      font-size: 13px;
      line-height: 1.8;
      color: #cbd5e1;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);
    }

    /* ZAŁĄCZNIKI DO WEZWANIA */
    .attachments-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border);
    }
    .attachments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px;
      margin-top: 16px;
    }
    .attachment-card {
      background: #0b0f19;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
      transition: all 0.2s ease;
    }
    .attachment-card:hover {
      border-color: rgba(56, 189, 248, 0.4);
      transform: translateY(-2px);
    }
    .att-badge {
      align-self: flex-start;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.25);
    }
    .attachment-card h4 {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      line-height: 1.35;
    }
    .att-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .att-downloads {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .att-btn {
      font-size: 11.5px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 6px;
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      color: #e2e8f0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .att-btn:hover {
      border-color: var(--accent);
      color: #fff;
      background: rgba(56, 189, 248, 0.15);
    }

    /* SEKCJE EDUKACYJNE / ZDJĘCIA W GRIDZIE */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 28px;
      margin: 60px 0;
    }
    .feature-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .feature-img {
      height: 220px;
      width: 100%;
      object-fit: cover;
      display: block;
      border-bottom: 1px solid var(--border);
    }
    .feature-body {
      padding: 24px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .feature-body h3 {
      font-size: 19px;
      color: #fff;
      margin-bottom: 10px;
    }
    .feature-body p {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.6;
    }
    .feature-tag {
      font-size: 11px;
      color: var(--accent);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    /* FOOTER */
    footer {
      margin-top: 80px;
      padding-top: 40px;
      border-top: 1px solid var(--border);
      text-align: center;
      font-size: 13px;
      color: var(--text-dim);
    }
    footer a { color: var(--accent); text-decoration: none; }

    /* LOADER & OCR PROGRESS */
    .progress-bar-container {
      margin: 16px 0;
      display: none;
    }
    .progress-track {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: var(--accent);
      transition: width 0.3s ease;
    }
    .progress-label {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- NAWIGACJA -->
  <nav>
    <div class="nav-inner">
      <a href="/" class="brand-logo">
        <img src="/images/logo-zanisko.png" alt="zanisko.pl" style="height: 56px; width: auto; object-fit: contain;">
        <span class="brand-tag">Audytor OC 2026</span>
      </a>
      <div class="nav-status">
        <div class="pulse-dot"></div>
        <span>Baza stawek PIM & KNF 2026 (16 województw)</span>
      </div>
    </div>
  </nav>

  <!-- GŁÓWNA ZAWARTOŚĆ -->
  <div class="container">

    <!-- HERO SECTION -->
    <section class="hero">
      <div>
        <div class="hero-label">
          <span>Niezależna weryfikacja kosztorysów powypadkowych</span>
        </div>
        <h1>Odzyskaj należne odszkodowanie z OC sprawcy</h1>
        <p class="hero-lead">
          Automatyczny audyt kosztorysów Audatex, Eurotax i DAT. Wykrywamy bezprawne potrącenia amortyzacyjne (uchwała Sądu Najwyższego III CZP 80/11), zaniżone stawki roboczogodziny oraz zamienniki dystrybutorskie naruszające gwarancję pojazdu.
        </p>
        <div class="hero-stats-row">
          <div class="stat-box">
            <div class="stat-val">3 500+ zł</div>
            <div class="stat-desc">Średnia kwota zaniżenia kosztorysu</div>
          </div>
          <div class="stat-box">
            <div class="stat-val">100%</div>
            <div class="stat-desc">Zgodność z orzecznictwem SN i KNF</div>
          </div>
          <div class="stat-box">
            <div class="stat-val">30 dni</div>
            <div class="stat-desc">Ustawowy termin milczenia ubezpieczyciela</div>
          </div>
        </div>
      </div>

      <!-- KARTA WIZUALNA HERO ZE ZDJĘCIEM 1 -->
      <div class="hero-visual-card">
        <img src="/images/hero-claim-comparison.jpg" alt="Porównanie kosztorysu ubezpieczyciela i rzeczywistych kosztów naprawy">
        <div class="hero-card-overlay">
          <div>
            <div class="overlay-tag">Przykład rzeczywistego audytu</div>
            <div class="overlay-title">Weryfikacja szkody Toyota Corolla</div>
          </div>
          <div class="overlay-diff">
            <div class="diff-badge">+8 030 zł</div>
          </div>
        </div>
      </div>
    </section>

    <!-- NARZĘDZIE AUDYTU -->
    <section class="tool-section" id="skaner">
      <div class="section-header">
        <h2>Sprawdź swój kosztorys w 60 sekund</h2>
        <p>Wgraj oficjalny plik PDF lub fotografię kalkulacji naprawy z ubezpieczalni.</p>
      </div>

      <!-- TABS -->
      <div class="input-tabs">
        <button class="tab-btn active" id="tabPdfBtn" onclick="switchTab('pdf')">
          Dokument PDF (Audatex / Eurotax)
        </button>
        <button class="tab-btn" id="tabOcrBtn" onclick="switchTab('ocr')">
          Skan / Zdjęcie kosztorysu (OCR)
        </button>
        <button class="tab-btn" id="tabTextBtn" onclick="switchTab('text')">
          Wklej tekst kalkulacji
        </button>
      </div>

      <!-- TAB 1: PLIK PDF -->
      <div id="tabPdfContent">
        <div class="dropzone" id="pdfDropzone">
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <div class="dropzone-title">Przeciągnij i upuść plik PDF kosztorysu</div>
          <div class="dropzone-sub">lub kliknij, aby wybrać dokument z dysku (PDF do 15 MB)</div>
          <input type="file" id="pdfFileInput" accept="application/pdf" style="display:none;">
        </div>
      </div>

      <!-- TAB 2: ZDJĘCIE / SKAN (OCR) -->
      <div id="tabOcrContent" style="display:none;">
        <div class="dropzone" id="imageDropzone">
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <div class="dropzone-title">Przeciągnij zdjęcie kosztorysu lub skan smartfonem</div>
          <div class="dropzone-sub">Silnik OCR rozpoznaje tabele i kwoty kosztorysu (PNG, JPG, JPEG)</div>
          <input type="file" id="imageFileInput" accept="image/png,image/jpeg,image/jpg" style="display:none;">
        </div>
        <div style="margin-top: 14px; text-align: center;">
          <button class="chip-btn" onclick="testOcrWithPreloadedImage()" style="margin: 0 auto;">
            Przetestuj OCR na gotowym zdjęciu kosztorysu (1 kliknięcie)
          </button>
        </div>
      </div>

      <!-- TAB 3: WKLEJ TEKST -->
      <div id="tabTextContent" style="display:none;">
        <textarea id="rawTextarea" rows="8" placeholder="Wklej treść kosztorysu z systemu Audatex, Eurotax lub DAT..." style="width: 100%; background: var(--surface-elevated); border: 1px solid var(--border); border-radius: 12px; padding: 16px; color: #fff; font-family: monospace; font-size: 13px; outline: none;"></textarea>
      </div>

      <!-- LOADER / POSTĘP PRZETWARZANIA -->
      <div class="progress-bar-container" id="progressBar">
        <div class="progress-track">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="progress-label">
          <span id="progressText">Rozpoznawanie tekstu i weryfikacja algorytmiczna...</span>
          <span id="progressPercent">0%</span>
        </div>
      </div>

      <!-- PARAMETRY POJAZDU I REGIONU -->
      <div class="params-grid">
        <div class="param-field">
          <label>Województwo poszkodowanego (Stawki PIM)</label>
          <select id="voivodeshipSelect">
            <option value="mazowieckie" selected>Mazowieckie (175 zł/rbh)</option>
            <option value="dolnoslaskie">Dolnośląskie (170 zł/rbh)</option>
            <option value="slaskie">Śląskie (165 zł/rbh)</option>
            <option value="malopolskie">Małopolskie (165 zł/rbh)</option>
            <option value="wielkopolskie">Wielkopolskie (165 zł/rbh)</option>
            <option value="pomorskie">Pomorskie (165 zł/rbh)</option>
            <option value="lodzkie">Łódzkie (160 zł/rbh)</option>
            <option value="zachodniopomorskie">Zachodniopomorskie (160 zł/rbh)</option>
            <option value="kujawsko-pomorskie">Kujawsko-pomorskie (155 zł/rbh)</option>
            <option value="lubelskie">Lubelskie (155 zł/rbh)</option>
            <option value="podkarpackie">Podkarpackie (155 zł/rbh)</option>
            <option value="swietokrzyskie">Świętokrzyskie (150 zł/rbh)</option>
            <option value="podlaskie">Podlaskie (155 zł/rbh)</option>
            <option value="lubuskie">Lubuskie (155 zł/rbh)</option>
            <option value="warminsko-mazurskie">Warmińsko-mazurskie (150 zł/rbh)</option>
            <option value="opolskie">Opolskie (155 zł/rbh)</option>
          </select>
        </div>
        <div class="param-field">
          <label>Klasa technologiczna pojazdu</label>
          <select id="segmentSelect">
            <option value="AUTO" selected>Wykrywaj automatycznie z marki i modelu</option>
            <option value="POPULAR">Segment popularny (Toyota, Skoda, VW, Ford)</option>
            <option value="PREMIUM">Segment Premium (+25% ADAS: BMW, Mercedes, Audi, Volvo)</option>
            <option value="LUXURY">Segment luksusowy (+50%: Porsche, Bentley, Ferrari)</option>
          </select>
        </div>
      </div>

      <!-- PRZYCISKI AKCJI -->
      <div class="action-row">
        <button class="btn-primary" id="startAuditBtn" onclick="runCurrentAudit()">
          Rozpocznij audyt kosztorysu
        </button>
        <button class="btn-secondary" id="loadSampleBtn" onclick="loadSampleTextAndAudit()">
          Wczytaj przykładowy kosztorys (Toyota Corolla PZU)
        </button>
        <a class="btn-secondary" id="downloadPdfBtn" href="/przykladowy_kosztorys_pzu.pdf" download="przykladowy_kosztorys_pzu.pdf" target="_blank">
          Pobierz plik PDF do testów
        </a>
      </div>
    </section>

    <!-- OBSZAR WYNIKÓW AUDYTU -->
    <div id="auditResultsArea">

      <!-- STAN 1: DARMOWY AUDYT WSTĘPNY (TEASER & PAYWALL NA SZCZEGÓŁACH) -->
      <div id="teaserView" class="teaser-card">
        <div class="teaser-glow"></div>
        <div class="teaser-header">
          <div>
            <div class="teaser-badge">Audyt wstępny ukończony</div>
            <h2 id="teaserVehicleTitle" style="font-size: 24px; color: #fff; margin-top: 8px;">Pojazd: Toyota Corolla 1.8 Hybrid (2021)</h2>
            <div id="teaserClaimMeta" style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              Szkoda nr: PL/PZU/2026/09/99120 | Ubezpieczyciel: PZU S.A. | Województwo: Mazowieckie
            </div>
            <div class="discrepancy-scale">
              <span style="font-size: 13px; font-weight: 600; color: #f87171;">Wskaźnik zaniżenia: WYSOKI</span>
              <div class="scale-bar"><div class="scale-fill"></div></div>
              <span id="teaserViolationsCount" style="font-size: 12px; color: var(--text-dim);">(wykryto 4 kategorie uchybień)</span>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 12px; color: var(--text-dim); text-transform: uppercase;">Szacowane zaniżenie odszkodowania</div>
            <div id="teaserEstimatedRange" style="font-size: 32px; font-weight: 700; color: #34d399; font-family: 'Space Grotesk', sans-serif;">
              od 4 200 zł do 5 400 zł
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">kwota możliwa do odzyskania w całości z OC sprawcy</div>
          </div>
        </div>

        <!-- ZABLOKOWANY PODGLĄD DANYCH SZCZEGÓŁOWYCH -->
        <div class="locked-section-container">
          <div class="blur-preview">
            <div class="cost-grid">
              <div class="cost-card">
                <div class="cost-label">Wypłacona kwota bezsporna</div>
                <div class="cost-amount">3 600,00 zł</div>
                <div class="cost-sub">Wypłata zaniżona przez ubezpieczyciela</div>
              </div>
              <div class="cost-card highlight">
                <div class="cost-label">Należna dopłata od ubezpieczyciela</div>
                <div class="cost-amount emerald">••••,•• zł</div>
                <div class="cost-sub">Suma bezprawnych potrąceń brutto</div>
              </div>
              <div class="cost-card">
                <div class="cost-label">Rzeczywisty koszt rzetelnej naprawy</div>
                <div class="cost-amount">••••,•• zł</div>
                <div class="cost-sub">Zgodnie ze stawkami PIM i technologią OEM</div>
              </div>
            </div>

            <div class="violation-card">
              <div class="violation-header">
                <div class="violation-title">Zaniżenie stawki roboczogodziny (RBH)</div>
                <div class="violation-amount">••••,•• zł</div>
              </div>
              <div class="violation-desc">Zastosowano stawkę dumpingową 70 zł/rbh zamiast rynkowej stawki referencyjnej PIM...</div>
            </div>
            <div class="violation-card">
              <div class="violation-header">
                <div class="violation-title">Bezprawne potrącenie amortyzacyjne części (SN III CZP 80/11)</div>
                <div class="violation-amount">••••,•• zł</div>
              </div>
              <div class="violation-desc">Obcięto wartość zderzaka i reflektora z uwagi na wiek pojazdu...</div>
            </div>
          </div>

          <!-- PAYWALL / ODBLOKOWANIE PEŁNEGO PAKIETU -->
          <div class="paywall-overlay" id="paywallBox">
            <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(56, 189, 248, 0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; color: var(--accent);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h3>Odblokuj pełny audyt dowodowy i gotowe pismo procesowe</h3>
            <p>
              Ubezpieczyciel liczy na to, że nie znasz oficjalnych stawek PIM ani uchwały SN III CZP 80/11. Pobierz precyzyjne zestawienie kwot do grosza oraz formalne Przedsądowe Wezwanie do Zapłaty z rygorem 30 dni.
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
              <button class="btn-primary" onclick="unlockFullReport()">
                Odblokuj pełny audyt i pismo — 49 zł
              </button>
              <button class="btn-secondary" onclick="unlockFullReport()">
                Symuluj płatność (Tryb testowy)
              </button>
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 10px;">
              Jednorazowa opłata. Zero prowizji od odzyskanej kwoty (kancelarie pobierają 25-35%).
            </div>
          </div>
        </div>
      </div>

      <!-- STAN 2: ODBLOKOWANY PEŁNY RAPORT DOWODOWY I GENERATOR PISMA -->
      <div id="unlockedView" style="display:none;">

        <!-- KARTY PODSUMOWANIA FINANSOWEGO CO DO GROSZA -->
        <div class="cost-grid">
          <div class="cost-card">
            <div class="cost-label">Wypłacona kwota bezsporna</div>
            <div class="cost-amount" id="unlockedUndisputedGross">0,00 zł</div>
            <div class="cost-sub" id="unlockedUndisputedNet">Netto: 0,00 zł</div>
          </div>
          <div class="cost-card highlight">
            <div class="cost-label">Kwota roszczenia do dopłaty (Suma strat)</div>
            <div class="cost-amount emerald" id="unlockedTotalLossGross">0,00 zł</div>
            <div class="cost-sub" id="unlockedTotalLossNet">Netto: 0,00 zł (z VAT 23%)</div>
          </div>
          <div class="cost-card">
            <div class="cost-label">Rzetelna wartość naprawy powypadkowej</div>
            <div class="cost-amount" id="unlockedFairGross">0,00 zł</div>
            <div class="cost-sub" id="unlockedFairNet">Netto: 0,00 zł</div>
          </div>
        </div>

        <!-- KALENDARIUM 30 DNI (USTAWOWY RYGOR) -->
        <div class="timeline-card">
          <div class="overlay-tag">Procedura odzyskiwania odszkodowania</div>
          <h3 style="font-size: 20px; color: #fff; margin-top: 4px;">Ustawowe kalendarium reklamacyjne (Ustawa z 5 sierpnia 2015 r.)</h3>
          <div class="timeline-steps">
            <div class="timeline-step">
              <div class="step-day">Dzień 0</div>
              <div class="step-title">Wysłanie wezwania</div>
              <div class="step-desc">Złożenie wygenerowanej reklamacji ClaimCheck z audytem różnicowym drogą mailową lub listem poleconym.</div>
            </div>
            <div class="timeline-step">
              <div class="step-day">Dzień 14</div>
              <div class="step-title">Termin płatności</div>
              <div class="step-desc">Wyznaczony w wezwaniu termin na bezsporną dopłatę na wskazany rachunek bankowy poszkodowanego.</div>
            </div>
            <div class="timeline-step critical">
              <div class="step-day">Dzień 30</div>
              <div class="step-title">Rygor milczenia (Art. 8)</div>
              <div class="step-desc">Brak pisemnej odpowiedzi ubezpieczyciela w terminie 30 dni oznacza uznanie roszczenia w całości z mocy prawa.</div>
            </div>
            <div class="timeline-step success">
              <div class="step-day">Dzień 31+</div>
              <div class="step-title">Egzekucja lub Rzecznik</div>
              <div class="step-desc">Wniosek interwencyjny do Rzecznika Finansowego lub skierowanie pozwu z odsetkami ustawowymi za opóźnienie.</div>
            </div>
          </div>
        </div>

        <!-- PEŁNA LISTA ZARZUTÓW PRAWNO-TECHNOLOGICZNYCH -->
        <div class="section-header" style="margin-top: 36px;">
          <h2>Szczegółowy wykaz zaniżeń w Twoim kosztorysie</h2>
          <p>Dowody gotowe do przedłożenia w postępowaniu reklamacyjnym i sądowym.</p>
        </div>
        <div id="violationsList"></div>

        <!-- FORMULARZ WEZWANIA DO ZAPŁATY ZE ZDJĘCIEM 4 -->
        <div class="letter-section">
          <div style="display: grid; grid-template-columns: 1fr 320px; gap: 24px; align-items: center; margin-bottom: 24px;">
            <div>
              <h2>Przedsądowe Wezwanie do Zapłaty</h2>
              <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
                Oficjalne pismo procesowe przygotowane w standardzie kancelarii prawnej, z pełną argumentacją prawną, kalkulacją zaniżeń i danymi do przelewu.
              </p>
            </div>
            <div style="border-radius: 12px; overflow: hidden; border: 1px solid var(--border);">
              <img src="/images/desk-audit-comparison.jpg" alt="Analiza kosztorysu na biurku" style="width: 100%; height: 110px; object-fit: cover;">
            </div>
          </div>

          <div class="claimant-form">
            <div class="param-field">
              <label>Imię i nazwisko poszkodowanego</label>
              <input type="text" id="claimantName" value="Jan Kowalski" onchange="generateAndDisplayLetter()">
            </div>
            <div class="param-field">
              <label>Adres zamieszkania</label>
              <input type="text" id="claimantAddress" value="ul. Marszałkowska 10/12, 00-001 Warszawa" onchange="generateAndDisplayLetter()">
            </div>
            <div class="param-field">
              <label>Numer konta bankowego do dopłaty</label>
              <input type="text" id="claimantIban" value="12 1020 1026 0000 1234 5678 9012" onchange="generateAndDisplayLetter()">
            </div>
          </div>

          <div class="action-row" style="margin-bottom: 20px;">
            <button class="btn-primary" onclick="downloadLetter('doc')">
              Pobierz DOC (Word)
            </button>
            <button class="btn-primary" onclick="downloadLetter('pdf')">
              Pobierz PDF
            </button>
            <button class="btn-secondary" onclick="downloadLetter('rtf')">
              Pobierz RTF
            </button>
            <button class="btn-secondary" onclick="downloadLetter('txt')">
              Pobierz TXT
            </button>
            <button class="btn-secondary" onclick="copyLetterToClipboard()">
              Kopiuj treść
            </button>
            <button class="btn-secondary" onclick="generateAndDisplayLetter()">
              Odśwież pismo
            </button>
          </div>

          <div class="letter-sheet" id="letterPreview">Trwa generowanie spersonalizowanego wezwania do zapłaty...</div>

          <!-- SEKCJA ZAŁĄCZNIKÓW DO WEZWANIA -->
          <div class="attachments-section" id="attachmentsSection">
            <div>
              <h3 style="font-size: 20px; font-weight: 700; color: #f8fafc;">Załączniki do wezwania do zapłaty</h3>
              <p style="color: var(--text-muted); font-size: 14px; margin-top: 4px;">
                Dokumenty dowodowe wymienione w wezwaniu procesowym. Możesz pobrać poszczególne załączniki lub kompletny pakiet dowodowy.
              </p>
            </div>

            <div class="attachments-grid">
              <!-- ZAŁĄCZNIK 1 -->
              <div class="attachment-card">
                <div class="att-header">
                  <span class="att-badge">Załącznik nr 1</span>
                  <h4>Kalkulacja korygująca i audyt kosztorysu</h4>
                </div>
                <p class="att-desc">
                  Szczegółowy audyt różnicowy: stawki rynkowe, potrącenia amortyzacyjne, narzucone zamienniki oraz rabaty lakiernicze z wyliczeniem pełnego roszczenia.
                </p>
                <div class="att-downloads">
                  <button class="att-btn" onclick="downloadAttachment('attachment1', 'doc')">DOC (Word)</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment1', 'pdf')">PDF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment1', 'rtf')">RTF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment1', 'txt')">TXT</button>
                </div>
              </div>

              <!-- ZAŁĄCZNIK 2 -->
              <div class="attachment-card">
                <div class="att-header">
                  <span class="att-badge">Załącznik nr 2</span>
                  <h4>Wyciąg ze stawek rynkowych robocizny PIM 2026</h4>
                </div>
                <p class="att-desc">
                  Urzędowa tabela stawek referencyjnych Polskiej Izby Motoryzacji dla 16 województw z uwzględnieniem Rekomendacji 15 KNF oraz segmentów pojazdów.
                </p>
                <div class="att-downloads">
                  <button class="att-btn" onclick="downloadAttachment('attachment2', 'doc')">DOC (Word)</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment2', 'pdf')">PDF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment2', 'rtf')">RTF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment2', 'txt')">TXT</button>
                </div>
              </div>

              <!-- ZAŁĄCZNIK 3 -->
              <div class="attachment-card">
                <div class="att-header">
                  <span class="att-badge">Załącznik nr 3</span>
                  <h4>Orzecznictwo Sądu Najwyższego i Rekomendacje KNF</h4>
                </div>
                <p class="att-desc">
                  Zestawienie tez prawnych: zakaz potrąceń amortyzacyjnych (uchwała SN III CZP 80/11), brak wymogu faktur (SN III CZP 32/03) oraz rygor 30 dni milczenia.
                </p>
                <div class="att-downloads">
                  <button class="att-btn" onclick="downloadAttachment('attachment3', 'doc')">DOC (Word)</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment3', 'pdf')">PDF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment3', 'rtf')">RTF</button>
                  <button class="att-btn" onclick="downloadAttachment('attachment3', 'txt')">TXT</button>
                </div>
              </div>
            </div>

            <!-- KOMPLETNY PAKIET -->
            <div style="margin-top: 24px; padding: 22px; background: rgba(2, 132, 199, 0.08); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div>
                <div style="font-weight: 700; font-size: 16px; color: #fff;">Kompletny pakiet procesowy</div>
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Pobierz Wezwanie do Zapłaty wraz ze wszystkimi Załącznikami (1, 2 i 3) scalone w jeden plik.</div>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-primary" onclick="downloadBundle('doc')">Pobierz pakiet DOC (Word)</button>
                <button class="btn-primary" onclick="downloadBundle('pdf')">Pobierz pakiet PDF</button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- SEKCJA EDUKACYJNA: 3 FILARY ZANIŻEŃ (ZDJĘCIA 2 I 3) -->
    <section class="features-grid">
      <div class="feature-card">
        <img class="feature-img" src="/images/mechanic-understated-explanation.jpg" alt="Mechanik wyjaśniający zaniżenie kosztorysu">
        <div class="feature-body">
          <div class="feature-tag">Uchwała SN III CZP 80/11</div>
          <h3>Zakaz potrąceń amortyzacyjnych</h3>
          <p>
            Towarzystwa ubezpieczeniowe rutynowo obcinają wartość nowych części o 30-60% pod pretekstem wieku auta. Sąd Najwyższy jednoznacznie orzekł, że ubezpieczyciel ma obowiązek wypłacić kwotę odpowiadającą cenie nowych, oryginalnych części bez potrąceń.
          </p>
        </div>
      </div>

      <div class="feature-card">
        <img class="feature-img" src="/images/tech-hud-repair.jpg" alt="Cyfrowy HUD specyfikacji części zamiennych">
        <div class="feature-body">
          <div class="feature-tag">Rekomendacja 15 KNF</div>
          <h3>Realne stawki rynkowe robocizny</h3>
          <p>
            Ubezpieczyciele narzucają sztuczne stawki 60-75 zł/rbh, podczas gdy certyfikowane warsztaty w Polsce stosują stawki 150-175 zł/rbh (a w markach Premium z systemami ADAS ponad 200 zł). zanisko.pl weryfikuje stawkę wg bazy Polskiej Izby Motoryzacji.
          </p>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <p>zanisko.pl — Niezależny system audytu kosztorysów szkód komunikacyjnych z OC sprawcy.</p>
      <p style="margin-top: 6px;">
        Zgodność z orzecznictwem Sądu Najwyższego RP oraz Rekomendacjami Komisji Nadzoru Finansowego (KNF) z dnia 1 listopada 2022 r.
      </p>
    </footer>

  </div>

  <div id="statusToast"></div>

  <!-- SKRYPT KLIENTA -->
  <script>
    let currentAuditReport = null;
    let currentAuditRawText = '';

    function showToast(msg) {
      const toast = document.getElementById('statusToast');
      toast.textContent = msg;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }

    // Bezpośrednie pobieranie plików bez blokowania
    function downloadSamplePdfDirect() {
      window.open('/przykladowy_kosztorys_pzu.pdf', '_blank');
      showToast('Rozpoczęto pobieranie przykładowego kosztorysu PDF.');
    }

    function downloadSampleImageDirect(imageName) {
      window.open('/images/' + imageName, '_blank');
      showToast('Otwarto zdjęcie testowe w nowym oknie.');
    }

    function downloadSampleTxtDirect() {
      window.open('/api/sample/txt', '_blank');
      showToast('Rozpoczęto pobieranie kosztorysu tekstowego.');
    }

    // Obsługa zakładek
    function switchTab(tab) {
      document.getElementById('tabPdfBtn').classList.remove('active');
      document.getElementById('tabOcrBtn').classList.remove('active');
      document.getElementById('tabTextBtn').classList.remove('active');

      document.getElementById('tabPdfContent').style.display = 'none';
      document.getElementById('tabOcrContent').style.display = 'none';
      document.getElementById('tabTextContent').style.display = 'none';

      if (tab === 'pdf') {
        document.getElementById('tabPdfBtn').classList.add('active');
        document.getElementById('tabPdfContent').style.display = 'block';
      } else if (tab === 'ocr') {
        document.getElementById('tabOcrBtn').classList.add('active');
        document.getElementById('tabOcrContent').style.display = 'block';
      } else {
        document.getElementById('tabTextBtn').classList.add('active');
        document.getElementById('tabTextContent').style.display = 'block';
      }
    }

    // Drag and drop dla PDF
    const pdfDropzone = document.getElementById('pdfDropzone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    pdfDropzone.onclick = () => pdfFileInput.click();
    pdfDropzone.ondragover = (e) => { e.preventDefault(); pdfDropzone.classList.add('dragover'); };
    pdfDropzone.ondragleave = () => pdfDropzone.classList.remove('dragover');
    pdfDropzone.ondrop = (e) => {
      e.preventDefault();
      pdfDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handlePdfFile(e.dataTransfer.files[0]);
    };
    pdfFileInput.onchange = (e) => {
      if (e.target.files.length > 0) handlePdfFile(e.target.files[0]);
    };

    // Drag and drop dla obrazów OCR
    const imageDropzone = document.getElementById('imageDropzone');
    const imageFileInput = document.getElementById('imageFileInput');
    imageDropzone.onclick = () => imageFileInput.click();
    imageDropzone.ondragover = (e) => { e.preventDefault(); imageDropzone.classList.add('dragover'); };
    imageDropzone.ondragleave = () => imageDropzone.classList.remove('dragover');
    imageDropzone.ondrop = (e) => {
      e.preventDefault();
      imageDropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleImageFile(e.dataTransfer.files[0]);
    };
    imageFileInput.onchange = (e) => {
      if (e.target.files.length > 0) handleImageFile(e.target.files[0]);
    };

    function showProgress(text, percent) {
      const pb = document.getElementById('progressBar');
      pb.style.display = 'block';
      document.getElementById('progressText').textContent = text;
      document.getElementById('progressPercent').textContent = percent + '%';
      document.getElementById('progressFill').style.width = percent + '%';
    }

    function hideProgress() {
      document.getElementById('progressBar').style.display = 'none';
    }

    // Obsługa wczytania pliku PDF
    async function handlePdfFile(file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        alert('Proszę wybrać plik PDF.');
        return;
      }
      showProgress('Wczytywanie i parsowanie kalkulacji PDF...', 40);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          showProgress('Silnik audytowy analizuje pozycje kosztorysu...', 75);
          const res = await fetch('/api/upload-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64,
              voivodeship: document.getElementById('voivodeshipSelect').value,
            }),
          });
          const data = await res.json();
          hideProgress();
          if (data.error) {
            alert('Błąd odczytu PDF: ' + data.error);
            return;
          }
          currentAuditReport = data.auditReport;
          currentAuditRawText = data.extractedText;
          renderAuditResults(data.auditReport);
          showToast('Pomyślnie sparsowano kosztorys PDF!');
        } catch (err) {
          hideProgress();
          alert('Błąd podczas komunikacji z serwerem: ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    }

    // Obsługa OCR zdjęć
    async function handleImageFile(file) {
      showProgress('Silnik OCR analizuje zdjęcie kosztorysu...', 35);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          showProgress('Rozpoznawanie stawek, części i potrąceń...', 70);
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              voivodeship: document.getElementById('voivodeshipSelect').value,
            }),
          });
          const data = await res.json();
          hideProgress();
          if (data.error) {
            alert('Błąd przetwarzania obrazu: ' + data.error);
            return;
          }
          currentAuditReport = data.auditReport;
          currentAuditRawText = data.extractedText;
          renderAuditResults(data.auditReport);
          showToast('Zdjęcie kosztorysu rozpoznane pomyślnie!');
        } catch (err) {
          hideProgress();
          alert('Błąd OCR: ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    }

    // Test OCR na gotowym zdjęciu
    async function testOcrWithPreloadedImage() {
      showProgress('Pobieranie zdjęcia testowego desk-audit-comparison.jpg...', 30);
      try {
        const imgRes = await fetch('/images/desk-audit-comparison.jpg');
        const blob = await imgRes.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1];
          showProgress('Przetwarzanie OCR i silnik audytowy...', 75);
          const res = await fetch('/api/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              voivodeship: document.getElementById('voivodeshipSelect').value,
            }),
          });
          const data = await res.json();
          hideProgress();
          currentAuditReport = data.auditReport;
          currentAuditRawText = data.extractedText;
          renderAuditResults(data.auditReport);
          showToast('Rozpoznano tekst z testowego zdjęcia kosztorysu!');
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        hideProgress();
        alert('Błąd testu: ' + err.message);
      }
    }

    // Wczytanie i natychmiastowy audyt przykładowego tekstu
    async function loadSampleTextAndAudit() {
      showProgress('Pobieranie przykładowej kalkulacji Toyota Corolla...', 30);
      try {
        const res = await fetch('/api/sample');
        const text = await res.text();
        document.getElementById('rawTextarea').value = text;
        switchTab('text');

        showProgress('Wykonywanie audytu różnicowego...', 75);
        const auditRes = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: text,
            voivodeship: document.getElementById('voivodeshipSelect').value,
          }),
        });
        const report = await auditRes.json();
        hideProgress();
        currentAuditReport = report;
        currentAuditRawText = text;
        renderAuditResults(report);
        showToast('Wczytano i zbadano przykładowy kosztorys!');
      } catch (err) {
        hideProgress();
        alert('Błąd: ' + err.message);
      }
    }

    // Ręczne uruchomienie audytu
    async function runCurrentAudit() {
      const rawText = document.getElementById('rawTextarea').value;
      if (!rawText.trim()) {
        alert('Najpierw wklej treść kosztorysu lub kliknij przycisk „Wczytaj przykładowy kosztorys”.');
        return;
      }
      showProgress('Audytowanie kalkulacji wg stawek PIM 2026...', 50);
      try {
        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText,
            voivodeship: document.getElementById('voivodeshipSelect').value,
          }),
        });
        const report = await res.json();
        hideProgress();
        currentAuditReport = report;
        currentAuditRawText = rawText;
        renderAuditResults(report);
        showToast('Audyt zakończony pomyślnie!');
      } catch (err) {
        hideProgress();
        alert('Błąd audytu: ' + err.message);
      }
    }

    // Renderowanie wyników (Etap 1: Teaser & Paywall)
    function renderAuditResults(report) {
      const area = document.getElementById('auditResultsArea');
      area.style.display = 'block';
      document.getElementById('teaserView').style.display = 'block';
      document.getElementById('unlockedView').style.display = 'none';

      const h = report.header;
      const s = report.summary;

      document.getElementById('teaserVehicleTitle').textContent = 'Pojazd: ' + h.vehicleMakeModel + ' (' + h.productionYear + ')';
      document.getElementById('teaserClaimMeta').textContent = 
        'Szkoda nr: ' + h.claimNumber + ' | Ubezpieczyciel: ' + h.insurerName + ' | Rejestracja: ' + h.registrationNumber;
      document.getElementById('teaserViolationsCount').textContent = 
        '(wykryto ' + report.violations.length + ' kategorie bezprawnych potrąceń)';

      // Szacowany przedział kwoty
      const minEstimated = Math.floor((s.totalLossGross * 0.9) / 100) * 100;
      const maxEstimated = Math.ceil((s.totalLossGross * 1.1) / 100) * 100;
      document.getElementById('teaserEstimatedRange').textContent = 
        'od ' + minEstimated.toLocaleString('pl-PL') + ' zł do ' + maxEstimated.toLocaleString('pl-PL') + ' zł';

      // Przewiń stronę do wyników natychmiast
      setTimeout(() => {
        area.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    // Odblokowanie pełnego raportu i wezwania
    function unlockFullReport() {
      document.getElementById('teaserView').style.display = 'none';
      document.getElementById('unlockedView').style.display = 'block';

      const s = currentAuditReport.summary;
      document.getElementById('unlockedUndisputedGross').textContent = s.undisputedAmountGross.toFixed(2) + ' zł';
      document.getElementById('unlockedUndisputedNet').textContent = 'Netto: ' + s.undisputedAmountNet.toFixed(2) + ' zł';

      document.getElementById('unlockedTotalLossGross').textContent = '+' + s.totalLossGross.toFixed(2) + ' zł';
      document.getElementById('unlockedTotalLossNet').textContent = 'Netto: ' + s.totalLossNet.toFixed(2) + ' zł (z VAT 23%)';

      document.getElementById('unlockedFairGross').textContent = s.fairAmountGross.toFixed(2) + ' zł';
      document.getElementById('unlockedFairNet').textContent = 'Netto: ' + s.fairAmountNet.toFixed(2) + ' zł';

      // Renderowanie listy naruszeń
      const vContainer = document.getElementById('violationsList');
      vContainer.innerHTML = '';
      currentAuditReport.violations.forEach((v, i) => {
        const card = document.createElement('div');
        card.className = 'violation-card severity-high';
        
        let itemsHtml = '';
        if (v.affectedItems && v.affectedItems.length > 0) {
          itemsHtml = '<div class="violation-items"><strong>Wykaz zakwestionowanych pozycji:</strong><ul>' + 
            v.affectedItems.map(it => '<li>' + it + '</li>').join('') + '</ul></div>';
        }

        const amountText = v.lossGross > 0 ? '+' + v.lossGross.toFixed(2) + ' zł brutto' : 'Naruszenie technologiczne';

        card.innerHTML = 
          '<div class="violation-header">' +
            '<div class="violation-title">' + (i + 1) + '. ' + v.title + '</div>' +
            '<div class="violation-amount">' + amountText + '</div>' +
          '</div>' +
          '<div class="violation-basis">Podstawa prawna: ' + v.legalBasis + '</div>' +
          '<div class="violation-desc">' + v.description + '</div>' +
          itemsHtml;

        vContainer.appendChild(card);
      });

      // Wygeneruj pismo
      generateAndDisplayLetter();
      showToast('Pełny raport odblokowany!');

      setTimeout(() => {
        document.getElementById('unlockedView').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    let currentLetterText = '';

    // Generowanie pisma wezwania do zapłaty (od razu w pełni spersonalizowane)
    async function generateAndDisplayLetter() {
      if (!currentAuditReport) return;

      const claimantName = document.getElementById('claimantName').value;
      const claimantAddress = document.getElementById('claimantAddress').value;
      const bankAccountNumber = document.getElementById('claimantIban').value;
      const customApiKey = '';

      document.getElementById('letterPreview').textContent = 'Trwa generowanie spersonalizowanego wezwania do zapłaty...';

      try {
        const res = await fetch('/api/generate-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: currentAuditReport,
            options: { claimantName, claimantAddress, bankAccountNumber },
            useAi: true,
            customApiKey,
          }),
        });
        const data = await res.json();
        currentLetterText = data.letter;
        document.getElementById('letterPreview').textContent = data.letter;
        showToast('Wezwanie do zapłaty zostało wygenerowane.');
      } catch (err) {
        alert('Błąd generowania pisma: ' + err.message);
      }
    }

    // Pobieranie wezwania w wybranym formacie (DOC, PDF, RTF, TXT)
    async function downloadLetter(format) {
      if (!currentLetterText) {
        await generateAndDisplayLetter();
      }
      const claimSafe = (currentAuditReport && currentAuditReport.header && currentAuditReport.header.claimNumber)
        ? currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_')
        : 'szkoda';
      const filename = 'wezwanie_do_zaplaty_' + claimSafe;
      await exportDocument({
        text: currentLetterText,
        title: 'PRZEDSĄDOWE WEZWANIE DO ZAPŁATY - SZKODA ' + (currentAuditReport ? currentAuditReport.header.claimNumber : ''),
        format: format,
        filename: filename,
      });
    }

    // Pobieranie załącznika (attachment1, attachment2, attachment3) w wybranym formacie
    async function downloadAttachment(attachmentId, format) {
      if (!currentAuditReport) return;
      showProgress('Przygotowywanie załącznika do pobrania...', 40);
      try {
        const res = await fetch('/api/attachments/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentAuditReport }),
        });
        const data = await res.json();
        hideProgress();
        const att = data.attachments.find(a => a.id === attachmentId);
        if (!att) throw new Error('Nie odnaleziono załącznika');

        const claimSafe = currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_');
        const filename = att.id + '_' + claimSafe;
        await exportDocument({
          text: att.textContent,
          html: att.htmlContent,
          title: att.title,
          format: format,
          filename: filename,
        });
      } catch (err) {
        hideProgress();
        alert('Błąd pobierania załącznika: ' + err.message);
      }
    }

    // Pobieranie kompletnego pakietu procesowego (Wezwanie + Załączniki w jednym pliku)
    async function downloadBundle(format) {
      if (!currentAuditReport) return;
      if (!currentLetterText) {
        await generateAndDisplayLetter();
      }
      showProgress('Generowanie kompletnego pakietu procesowego...', 40);
      try {
        const res = await fetch('/api/attachments/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentAuditReport }),
        });
        const data = await res.json();
        hideProgress();

        let bundleText = currentLetterText + '\\n\\n' + '='.repeat(60) + '\\n\\n';
        let bundleHtml = '<div style="page-break-after: always;">' + currentLetterText.replace(/\\n\\n/g, '<br><br>').replace(/\\n/g, '<br>') + '</div>';

        data.attachments.forEach((att) => {
          bundleText += '\\n\\n' + '='.repeat(60) + '\\n' + att.title + '\\n' + '='.repeat(60) + '\\n\\n' + att.textContent + '\\n';
          bundleHtml += '<div style="page-break-before: always; margin-top: 30pt;">' + att.htmlContent + '</div>';
        });

        const claimSafe = currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_');
        const filename = 'kompletny_pakiet_procesowy_' + claimSafe;

        await exportDocument({
          text: bundleText,
          html: bundleHtml,
          title: 'KOMPLETNY PAKIET PROCESOWY - SZKODA ' + currentAuditReport.header.claimNumber,
          format: format,
          filename: filename,
        });
      } catch (err) {
        hideProgress();
        alert('Błąd generowania pakietu: ' + err.message);
      }
    }

    // Uniwersalna funkcja pobierania pliku
    async function exportDocument(params) {
      showProgress('Przygotowywanie pliku ' + params.format.toUpperCase() + '...', 60);
      try {
        const res = await fetch('/api/export-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (!res.ok) throw new Error('Serwer zwrócił kod błędu ' + res.status);
        const blob = await res.blob();
        hideProgress();

        const ext = params.format === 'doc' ? '.doc' : params.format === 'pdf' ? '.pdf' : params.format === 'rtf' ? '.rtf' : '.txt';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = params.filename + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Pobrano dokument ' + params.format.toUpperCase() + '.');
      } catch (err) {
        hideProgress();
        alert('Błąd eksportu: ' + err.message);
      }
    }

    function copyLetterToClipboard() {
      const text = document.getElementById('letterPreview').textContent;
      navigator.clipboard.writeText(text).then(() => {
        showToast('Treść wezwania do zapłaty została skopiowana.');
      });
    }
  </script>
</body>
</html>
`;

export function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const host = req.headers.host || 'localhost';
  const rawReqUrl = new URL(req.url ?? '/', `http://${host}`);
  const forwardedPath = rawReqUrl.searchParams.get('__url')
    || (req.headers['x-forwarded-uri'] as string)
    || (req.headers['x-matched-path'] as string)
    || req.url
    || '/';
  const url = new URL(forwardedPath.startsWith('/') ? forwardedPath : `/${forwardedPath}`, `http://${host}`);

    // GET / - Główna aplikacja
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(HTML_PAGE);
      return;
    }

    // GET /przykladowy_kosztorys_pzu.pdf - Pobranie przykładowego pliku PDF z wymuszonym nagłówkiem attachment
    if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/przykladowy_kosztorys_pzu.pdf' || url.pathname === '/sample_kosztorys_pzu.pdf')) {
      const pdfPath = path.resolve('public/przykladowy_kosztorys_pzu.pdf');
      if (fs.existsSync(pdfPath)) {
        const stat = fs.statSync(pdfPath);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="przykladowy_kosztorys_pzu.pdf"',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(pdfPath).pipe(res);
        return;
      }
    }

    // GET /api/sample/txt - Pobranie przykładowego kosztorysu jako plik .txt
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/sample/txt') {
      const buffer = Buffer.from(SAMPLE_ESTIMATE_TEXT, 'utf-8');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': buffer.length,
        'Content-Disposition': 'attachment; filename="przykladowy_kosztorys_toyota_corolla.txt"',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(buffer);
      return;
    }

    // GET /favicon.ico - Bezpośrednie serwowanie ikony favicon
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/favicon.ico') {
      const faviconPath = path.resolve('public/favicon.ico');
      if (fs.existsSync(faviconPath)) {
        const stat = fs.statSync(faviconPath);
        res.writeHead(200, {
          'Content-Type': 'image/x-icon',
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(faviconPath).pipe(res);
        return;
      }
    }

    // GET /images/* - Serwowanie grafik i fotografii użytkownika
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/images/')) {
      const imageName = path.basename(url.pathname);
      const imagePath = path.resolve('public/images', imageName);
      if (fs.existsSync(imagePath)) {
        const ext = path.extname(imageName).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        if (ext === '.ico') contentType = 'image/x-icon';
        const stat = fs.statSync(imagePath);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(imagePath).pipe(res);
        return;
      }
    }

    // GET /api/sample - Przykładowy kosztorys (tekst)
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/sample') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(SAMPLE_ESTIMATE_TEXT);
      return;
    }

    // GET /health - Health check
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
      return;
    }

    // GET /api/benchmarks - Lista stawek referencyjnych dla 16 województw
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/benchmarks') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(JSON.stringify(REGIONAL_BENCHMARKS));
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

          // Serverless (Vercel): worker pdf.js musi być załadowany jawnie, inaczej brak pliku w paczce funkcji
          if (!(globalThis as any).pdfjsWorker) {
            // @ts-ignore brak typów dla pliku workera
            (globalThis as any).pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
          }
          const { PDFParse } = await import('pdf-parse');
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

    // POST /api/upload-image - Silnik OCR / AI rozpoznawania obrazu
    if (req.method === 'POST' && url.pathname === '/api/upload-image') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const voivodeship = (payload.voivodeship ?? 'mazowieckie') as Voivodeship;

          const result = await geminiService.auditEstimateWithVision({
            imageBase64: payload.imageBase64,
            voivodeship,
            customApiKey: payload.customApiKey,
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            auditReport: result.auditReport,
            extractedText: result.extractedText,
            aiInsights: result.aiInsights,
          }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd silnika rozpoznawania obrazu';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/gemini/compare-damage - Porównanie foto uszkodzeń auta z kosztorysem
    if (req.method === 'POST' && url.pathname === '/api/gemini/compare-damage') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const result = await geminiService.compareDamagePhotoWithEstimate({
            photoBase64: payload.photoBase64,
            estimateText: payload.estimateText || SAMPLE_ESTIMATE_TEXT,
            customApiKey: payload.customApiKey,
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd inspekcji uszkodzeń Gemini';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/gemini/enhance-letter - Personalizacja kancelaryjna wezwania z Gemini
    if (req.method === 'POST' && url.pathname === '/api/gemini/enhance-letter') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const letter = await geminiService.enhanceDemandLetter({
            report: payload.report,
            claimantName: payload.claimantName || 'Jan Kowalski',
            claimantAddress: payload.claimantAddress || 'ul. Marszałkowska 10/12, 00-001 Warszawa',
            bankAccountNumber: payload.bankAccountNumber || '12 1020 1026 0000 1234 5678 9012',
            userContext: payload.userContext,
            customApiKey: payload.customApiKey,
          });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ letter }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd personalizacji Gemini';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/audit - Przetwarzanie kosztorysu i audyt z tekstu
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

    // POST /api/generate-letter - Natychmiastowe generowanie spersonalizowanego pisma procesowego
    if (req.method === 'POST' && url.pathname === '/api/generate-letter') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          let letter: string;

          if (payload.useAi && geminiService.isConfigured(payload.customApiKey)) {
            try {
              letter = await geminiService.enhanceDemandLetter({
                report: payload.report,
                claimantName: payload.options?.claimantName || 'Jan Kowalski',
                claimantAddress: payload.options?.claimantAddress || 'ul. Marszałkowska 10/12, 00-001 Warszawa',
                bankAccountNumber: payload.options?.bankAccountNumber || '12 1020 1026 0000 1234 5678 9012',
                userContext: payload.options?.userContext,
                customApiKey: payload.customApiKey,
              });
            } catch {
              letter = generateDemandLetter(payload.report, payload.options);
            }
          } else {
            letter = generateDemandLetter(payload.report, payload.options);
          }

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

    // POST /api/attachments/generate - Zwraca komplet danych dla wszystkich 3 załączników
    if (req.method === 'POST' && url.pathname === '/api/attachments/generate') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const report = payload.report as AuditReport;
          const att1 = generateAttachment1Audit(report);
          const att2 = generateAttachment2PimRates(report.header.voivodeship, report.header.vehicleSegment);
          const att3 = generateAttachment3LegalBasis();

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ attachments: [att1, att2, att3] }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd generowania załączników';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    // POST /api/export-document - Uniwersalny eksport dokumentów procesowych (DOC, RTF, TXT, PDF)
    if (req.method === 'POST' && url.pathname === '/api/export-document') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const format = String(payload.format || 'txt').toLowerCase();
          const title = payload.title || 'Dokument procesowy';
          const text = payload.text || '';
          const html = payload.html || demandLetterToHtml(text);
          const filename = payload.filename || 'dokument';

          let buffer: Buffer;
          let contentType: string;
          let ext: string;

          switch (format) {
            case 'doc':
              buffer = exportToDoc(html, title);
              contentType = 'application/msword; charset=utf-8';
              ext = '.doc';
              break;
            case 'rtf':
              buffer = exportToRtf(text);
              contentType = 'application/rtf; charset=utf-8';
              ext = '.rtf';
              break;
            case 'pdf':
              buffer = await exportToPdf(text, title);
              contentType = 'application/pdf';
              ext = '.pdf';
              break;
            case 'txt':
            default:
              buffer = exportToTxt(text);
              contentType = 'text/plain; charset=utf-8';
              ext = '.txt';
              break;
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Content-Disposition': `attachment; filename="${filename}${ext}"`,
          });
          res.end(buffer);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd eksportu dokumentu';
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: message }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

export function createServer(port = 3000) {
  const server = http.createServer(handleRequest);
  return server;
}

export default handleRequest;

// Uruchomienie serwera jeśli wywołany bezpośrednio
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  const PORT = Number(process.env.PORT) || 3000;
  const server = createServer(PORT);
  server.listen(PORT, () => {
    console.log(`ClaimCheck server running on http://localhost:${PORT}`);
  });
}

