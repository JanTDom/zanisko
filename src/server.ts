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
import {
  exportToDoc,
  exportBundleToDoc,
  exportToRtf,
  exportToTxt,
  exportToPdf,
  exportDemandLetterToDocx,
  exportAttachmentToDocx,
  exportBundleToDocx,
} from './services/document-exporter.js';
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
  <title>zanisko.pl – Niezależny audytor kosztorysów naprawy z OC sprawcy</title>
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
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
      text-wrap: pretty;
      orphans: 2;
      widows: 2;
    }

    /* TYPOGRAFIA */
    h1, h2, h3, h4, .brand-font {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
      text-wrap: balance;
    }
    p, li {
      text-wrap: pretty;
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
      position: relative;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #fff;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 14px 26px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(2, 132, 199, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
      display: inline-flex;
      align-items: center;
      gap: 10px;
      transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      overflow: hidden;
      user-select: none;
    }
    .btn-primary::after {
      content: '';
      position: absolute;
      top: -50%;
      left: -60%;
      width: 40%;
      height: 200%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
      transform: rotate(25deg);
      transition: all 0.65s ease;
      pointer-events: none;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #0369a1 0%, #0284c7 100%);
      transform: translateY(-2.5px) scale(1.02);
      box-shadow: 0 8px 25px rgba(2, 132, 199, 0.5), 0 0 16px rgba(56, 189, 248, 0.4);
      border-color: rgba(56, 189, 248, 0.8);
    }
    .btn-primary:hover::after {
      left: 140%;
    }
    .btn-primary:active {
      transform: translateY(1px) scale(0.98);
      box-shadow: 0 2px 10px rgba(2, 132, 199, 0.3);
    }
    .btn-secondary {
      background: var(--surface-elevated);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 14px 22px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }
    .btn-secondary:hover {
      border-color: rgba(56, 189, 248, 0.45);
      background: #1c263c;
      color: #fff;
      transform: translateY(-2px) scale(1.015);
      box-shadow: 0 6px 20px -3px rgba(0, 0, 0, 0.4), 0 0 14px rgba(56, 189, 248, 0.2);
    }
    .btn-secondary:active {
      transform: translateY(1px) scale(0.98);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
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
      padding: 7px 13px;
      border-radius: 8px;
      background: var(--surface-elevated);
      border: 1px solid var(--border);
      color: #e2e8f0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      user-select: none;
    }
    .att-btn:hover {
      border-color: var(--accent);
      color: #fff;
      background: rgba(56, 189, 248, 0.15);
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 4px 14px rgba(56, 189, 248, 0.25);
    }
    .att-btn:active {
      transform: translateY(0.5px) scale(0.98);
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

    /* SEKCJA: JAK DZIAŁA ZANIŻANIE I CO ZROBIĆ */
    .guide { margin: 70px 0 20px; scroll-margin-top: 100px; }
    .guide-lead { font-size: 17px; color: var(--text-muted); max-width: 820px; margin-top: 10px; }
    .guide h2 { font-size: 32px; color: #fff; }
    .guide h3.guide-h { font-size: 22px; color: #fff; margin: 48px 0 6px; }
    .guide-sub { font-size: 15px; color: var(--text-muted); margin-bottom: 20px; max-width: 820px; }
    .guide-example { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 12px; padding: 22px 24px; margin-top: 24px; font-size: 15px; color: var(--text-muted); }
    .guide-example strong { color: #fff; }
    .guide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px; }
    .guide-card { background: var(--gradient-card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }
    .guide-card .num { font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: var(--accent-crimson); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
    .guide-card h4 { font-size: 17px; color: #fff; margin: 6px 0 8px; }
    .guide-card p { font-size: 14px; color: var(--text-muted); margin-bottom: 10px; }
    .guide-card .law { font-size: 12.5px; color: var(--accent-emerald); border-top: 1px solid var(--border); padding-top: 10px; margin: 0; }
    .scenario { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
    .scenario summary { cursor: pointer; list-style: none; padding: 18px 22px; display: flex; gap: 14px; align-items: center; font-weight: 600; color: #fff; font-size: 16px; }
    .scenario summary::-webkit-details-marker { display: none; }
    .scenario summary .tag { flex-shrink: 0; font-family: 'Space Grotesk', sans-serif; font-size: 13px; background: rgba(56,189,248,0.12); color: var(--accent); border: 1px solid var(--border-accent); border-radius: 8px; padding: 3px 10px; }
    .scenario summary::after { content: '+'; margin-left: auto; color: var(--text-dim); font-size: 22px; font-weight: 400; }
    .scenario[open] summary::after { content: '–'; }
    .scenario-body { padding: 0 22px 20px 22px; font-size: 15px; color: var(--text-muted); }
    .scenario-body p { margin-bottom: 10px; }
    .scenario-body ul { margin: 0 0 10px 20px; }
    .scenario-body li { margin-bottom: 6px; }
    .scenario-body strong { color: #fff; }
    .scenario-body .verdict { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 12px 14px; color: #d1fae5; margin-top: 8px; }
    .scenario-body .warn { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 12px 14px; color: #fde68a; margin-top: 8px; }
    .steps { list-style: none; counter-reset: s; margin: 0; padding: 0; }
    .steps > li { counter-increment: s; position: relative; padding: 0 0 26px 62px; border-left: 2px solid var(--border); margin-left: 20px; }
    .steps > li:last-child { border-left-color: transparent; }
    .steps > li::before { content: counter(s); position: absolute; left: -21px; top: -4px; width: 40px; height: 40px; border-radius: 50%; background: var(--surface-elevated); border: 1px solid var(--border-accent); color: var(--accent); font-family: 'Space Grotesk', sans-serif; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .steps h4 { font-size: 17px; color: #fff; margin-bottom: 6px; }
    .steps p, .steps li li { font-size: 14.5px; color: var(--text-muted); }
    .steps p { margin-bottom: 8px; }
    .steps ul { margin: 4px 0 8px 18px; }
    .fee-table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 13.5px; max-width: 460px; }
    .fee-table td { border-bottom: 1px solid var(--border); padding: 6px 8px; color: var(--text-muted); }
    .fee-table td:last-child { text-align: right; color: #fff; font-weight: 600; }
    .dont-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .dont-list div { background: rgba(244,63,94,0.06); border: 1px solid rgba(244,63,94,0.25); border-radius: 12px; padding: 16px; font-size: 14px; color: var(--text-muted); }
    .dont-list strong { display: block; color: #fecdd3; margin-bottom: 4px; }
    .guide-sources { font-size: 12.5px; color: var(--text-dim); margin-top: 40px; border-top: 1px solid var(--border); padding-top: 18px; }
    .guide-sources a { color: var(--accent); text-decoration: none; }
    .hero-guide-link { display: inline-block; margin-top: 18px; color: var(--accent); text-decoration: none; font-weight: 600; font-size: 15px; }
    .hero-guide-link:hover { text-decoration: underline; }
    @media (max-width: 640px) { .guide h2 { font-size: 26px; } .steps > li { padding-left: 46px; } .input-tabs { flex-wrap: wrap; } }

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

    /* LOADER 3D - KOŁO SAMOCHODU 3D & PROGRESS */
    .progress-bar-container {
      position: fixed;
      inset: 0;
      background: rgba(7, 9, 14, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeInOverlay 0.25s ease-out;
    }
    @keyframes fadeInOverlay {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .progress-modal-card {
      background: linear-gradient(180deg, rgba(22, 29, 46, 0.96) 0%, rgba(15, 20, 32, 0.98) 100%);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 24px;
      padding: 36px 32px 30px;
      width: 90%;
      max-width: 440px;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15);
      animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes modalScaleIn {
      from { transform: scale(0.9) translateY(20px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }
    .wheel-3d-wrapper {
      perspective: 800px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 22px;
      position: relative;
    }
    .wheel-3d-stage {
      width: 120px;
      height: 120px;
      position: relative;
      transform-style: preserve-3d;
      transform: rotateX(14deg) rotateY(-18deg);
      filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.7));
    }
    .spinning-wheel-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      animation: wheelSpin 0.7s linear infinite;
      transform-origin: 60px 60px;
    }
    @keyframes wheelSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .static-caliper-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
    }
    .wheel-3d-shadow {
      width: 105px;
      height: 14px;
      background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.85) 0%, rgba(56, 189, 248, 0.2) 50%, transparent 80%);
      border-radius: 50%;
      margin-top: 8px;
      filter: blur(2px);
      animation: shadowPulse 0.7s ease-in-out infinite alternate;
    }
    @keyframes shadowPulse {
      from { transform: scaleX(0.95); opacity: 0.75; }
      to { transform: scaleX(1.08); opacity: 1; }
    }
    .progress-title {
      font-size: 19px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      font-family: 'Space Grotesk', sans-serif;
      letter-spacing: -0.02em;
    }
    .progress-track {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      overflow: hidden;
      position: relative;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }
    .progress-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #34d399 100%);
      border-radius: 999px;
      transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.6);
    }
    .progress-label {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
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
      <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
        <div class="nav-status">
          <div class="pulse-dot"></div>
          <span>Baza stawek PIM &amp; KNF 2026 (16 województw)</span>
        </div>
        <div class="nav-links" style="display: flex; gap: 14px; font-size: 13px; font-weight: 500;">
          <a href="/regulamin.html" style="color: var(--text-muted); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Regulamin</a>
          <a href="/polityka-prywatnosci.html" style="color: var(--text-muted); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Prywatność</a>
          <a href="/kontakt.html" style="color: var(--text-muted); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Kontakt i reklamacje</a>
        </div>
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
        <a href="#jak-to-dziala" class="hero-guide-link">Jak działa zaniżanie odszkodowania i co możesz zrobić →</a>
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

      <!-- LOADER / 3D WHEEL SPINNER MODAL -->
      <div class="progress-bar-container" id="progressBar">
        <div class="progress-modal-card">
          <div class="wheel-3d-wrapper">
            <div class="wheel-3d-stage">
              <!-- Spinning Wheel & Disc -->
              <svg class="spinning-wheel-svg" viewBox="0 0 120 120" width="120" height="120">
                <defs>
                  <radialGradient id="tireGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="60%" stop-color="#14171d"/>
                    <stop offset="90%" stop-color="#232730"/>
                    <stop offset="100%" stop-color="#0f1115"/>
                  </radialGradient>
                  <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#94a3b8"/>
                    <stop offset="25%" stop-color="#f8fafc"/>
                    <stop offset="50%" stop-color="#475569"/>
                    <stop offset="75%" stop-color="#cbd5e1"/>
                    <stop offset="100%" stop-color="#1e293b"/>
                  </linearGradient>
                  <linearGradient id="spokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#e2e8f0"/>
                    <stop offset="50%" stop-color="#64748b"/>
                    <stop offset="100%" stop-color="#38bdf8"/>
                  </linearGradient>
                  <radialGradient id="discGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="40%" stop-color="#475569"/>
                    <stop offset="75%" stop-color="#334155"/>
                    <stop offset="100%" stop-color="#1e293b"/>
                  </radialGradient>
                  <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="#0284c7"/>
                    <stop offset="100%" stop-color="#0f172a"/>
                  </radialGradient>
                </defs>

                <!-- 1. Opona zewnętrzna z nacięciami bieżnika -->
                <circle cx="60" cy="60" r="56" fill="url(#tireGrad)" stroke="#0b0d11" stroke-width="3"/>
                <circle cx="60" cy="60" r="54" fill="none" stroke="#2c323f" stroke-width="2.5" stroke-dasharray="3, 5.5"/>
                <circle cx="60" cy="60" r="49" fill="none" stroke="#181c24" stroke-width="1.5"/>

                <!-- 2. Perforowana tarcza hamulcowa -->
                <circle cx="60" cy="60" r="38" fill="url(#discGrad)" stroke="#64748b" stroke-width="1"/>
                <circle cx="60" cy="60" r="32" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="2, 4"/>
                <circle cx="60" cy="60" r="26" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="2.5, 5"/>

                <!-- 3. Rant alufelgi -->
                <circle cx="60" cy="60" r="41" fill="none" stroke="url(#rimGrad)" stroke-width="2.5"/>

                <!-- 4. Ramiona alufelgi (5 podwójnych ramion) -->
                <g id="wheelSpokes">
                  <path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#spokeGrad)"/>
                  <line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>
                  <g transform="rotate(72 60 60)">
                    <path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#spokeGrad)"/>
                    <line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>
                  </g>
                  <g transform="rotate(144 60 60)">
                    <path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#spokeGrad)"/>
                    <line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>
                  </g>
                  <g transform="rotate(216 60 60)">
                    <path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#spokeGrad)"/>
                    <line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>
                  </g>
                  <g transform="rotate(288 60 60)">
                    <path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#spokeGrad)"/>
                    <line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>
                  </g>
                </g>

                <!-- 5. Piasta centralna i śruby mocujące -->
                <circle cx="60" cy="60" r="14" fill="url(#rimGrad)" stroke="#38bdf8" stroke-width="1"/>
                <circle cx="60" cy="60" r="9" fill="url(#hubGrad)" stroke="#0284c7" stroke-width="1"/>
                <circle cx="60" cy="49" r="1.5" fill="#f8fafc"/>
                <circle cx="70.5" cy="56.5" r="1.5" fill="#f8fafc"/>
                <circle cx="66.5" cy="68.5" r="1.5" fill="#f8fafc"/>
                <circle cx="53.5" cy="68.5" r="1.5" fill="#f8fafc"/>
                <circle cx="49.5" cy="56.5" r="1.5" fill="#f8fafc"/>
                <text x="60" y="63" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="'Space Grotesk', sans-serif">Z</text>
              </svg>

              <!-- Static Sport Brake Caliper (Brembo red) -->
              <svg class="static-caliper-svg" viewBox="0 0 120 120" width="120" height="120">
                <defs>
                  <linearGradient id="caliperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#ef4444"/>
                    <stop offset="60%" stop-color="#dc2626"/>
                    <stop offset="100%" stop-color="#991b1b"/>
                  </linearGradient>
                </defs>
                <path d="M 28 42 C 26 49 26 58 28 66 L 37 63 C 35 57 35 51 37 45 Z" fill="url(#caliperGrad)" stroke="#f87171" stroke-width="1.2"/>
                <circle cx="32" cy="48" r="1.5" fill="#fff" opacity="0.8"/>
                <circle cx="32" cy="60" r="1.5" fill="#fff" opacity="0.8"/>
              </svg>
            </div>
            <div class="wheel-3d-shadow"></div>
          </div>

          <h3 class="progress-title">Przetwarzanie kalkulacji</h3>
          <div class="progress-track">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="progress-label">
            <span id="progressText">Rozpoznawanie tekstu i weryfikacja algorytmiczna...</span>
            <span id="progressPercent">0%</span>
          </div>
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
            <div style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 6px 0 2px 0;">
              <span style="color: #38bdf8;">49,00 zł</span> brutto <span style="font-size: 13px; font-weight: 500; color: #10b981; margin-left: 6px;">(Wersja beta: 0 zł)</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 10px;">
              Cena zawiera 23% VAT. Treści cyfrowe (raport i pliki procesowe) dostarczane natychmiast po zatwierdzeniu.
            </div>

            <!-- ZGODA KONSUMENCKA / WYŁĄCZENIE ODSTĄPIENIA (ART. 38 PKT 13 USTAWY O PRAWACH KONSUMENTA) -->
            <div style="max-width: 580px; margin: 0 auto 12px auto; text-align: left; font-size: 11px; line-height: 1.45; color: var(--text-muted); background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px;">
              <label style="display: flex; gap: 8px; align-items: flex-start; cursor: pointer;">
                <input type="checkbox" id="p24ConsentCheck" checked style="margin-top: 2px; accent-color: #38bdf8;">
                <span>Zgadzam się na natychmiastowe rozpoczęcie świadczenia usługi i dostarczenie treści cyfrowych przed upływem 14-dniowego terminu do odstąpienia od umowy i przyjmuję do wiadomości utratę prawa do odstąpienia od umowy z chwilą ich pełnego dostarczenia. Akceptuję <a href="/regulamin.html" target="_blank" style="color: #38bdf8; text-decoration: underline;">Regulamin</a> oraz <a href="/polityka-prywatnosci.html" target="_blank" style="color: #38bdf8; text-decoration: underline;">Politykę prywatności</a>.</span>
              </label>
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; align-items: center;">
              <button class="btn-primary" onclick="unlockFullReport()">
                Odblokuj raport i dokumenty – 49 zł
              </button>
              <button class="btn-secondary" onclick="unlockFullReport()">
                Tryb testowy (bezpłatny dostęp)
              </button>
            </div>

            <!-- METODY PŁATNOŚCI I OPERATOR -->
            <div style="display: flex; gap: 8px; justify-content: center; align-items: center; margin-top: 12px; flex-wrap: wrap; font-size: 11px; color: var(--text-muted);">
              <span>Bezpieczne płatności obsługuje <strong>PayPro S.A. (Przelewy24)</strong>:</span>
              <span style="background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; font-weight: 600; color: #fff;">BLIK</span>
              <span style="background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; font-weight: 600; color: #fff;">Visa</span>
              <span style="background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; font-weight: 600; color: #fff;">Mastercard</span>
              <span style="background: rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 4px; font-weight: 600; color: #fff;">Przelew online</span>
            </div>

            <div style="font-size: 11px; color: var(--text-dim); margin-top: 8px;">
              Sprzedawca: Multinewsroom Jan Domaniewski &bull; NIP: 525-218-92-41 &bull; REGON: 147154574 &bull; e-mail: <a href="mailto:kontakt@zanisko.pl" style="color: var(--text-dim); text-decoration: underline;">kontakt@zanisko.pl</a>
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
            <button class="btn-primary" onclick="downloadLetter('docx')">
              Pobierz Word (DOCX)
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
            <button class="btn-secondary" onclick="enhanceLetterWithAi()">
              Wzbogać z AI (Gemini)
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
                  <button class="att-btn" onclick="downloadAttachment('attachment1', 'docx')">Word (DOCX)</button>
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
                  <button class="att-btn" onclick="downloadAttachment('attachment2', 'docx')">Word (DOCX)</button>
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
                  <button class="att-btn" onclick="downloadAttachment('attachment3', 'docx')">Word (DOCX)</button>
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
                <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Pobierz Wezwanie do Zapłaty wraz ze wszystkimi Załącznikami (1, 2 i 3) scalone w jeden plik z podziałem na strony.</div>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-primary" onclick="downloadBundle('docx')">Pobierz pakiet Word (DOCX)</button>
                <button class="btn-primary" onclick="downloadBundle('pdf')">Pobierz pakiet PDF</button>
                <button class="btn-secondary" onclick="downloadBundle('rtf')">Pobierz pakiet RTF</button>
                <button class="btn-secondary" onclick="downloadBundle('txt')">Pobierz pakiet TXT</button>
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

    <!-- SEKCJA: ZANIŻANIE ODSZKODOWANIA – WYJAŚNIENIE I SCENARIUSZE -->
    <section class="guide" id="jak-to-dziala">
      <div class="section-header">
        <h2>Na czym polega zaniżanie odszkodowania z&nbsp;OC – i&nbsp;co możesz z&nbsp;tym zrobić</h2>
        <p class="guide-lead">
          Wyjaśniamy bez żargonu: skąd bierze się zbyt niska wypłata, jak sprawdzić, czy dotyczy Ciebie, i&nbsp;jaką drogę wybrać w&nbsp;Twojej konkretnej sytuacji.
        </p>
      </div>

      <h3 class="guide-h">1. Jak to działa – w&nbsp;trzech zdaniach</h3>
      <p class="guide-sub">
        Gdy ktoś uszkodzi Twoje auto, jego ubezpieczyciel OC musi pokryć koszt przywrócenia samochodu do&nbsp;stanu sprzed wypadku. Najczęściej nie płaci za&nbsp;rzeczywistą naprawę, tylko wylicza ją w&nbsp;programie (Audatex, Eurotax, DAT) – to jest <strong>kosztorys</strong>. W&nbsp;tym kosztorysie ubezpieczyciel sam ustala ceny, a&nbsp;wiele z&nbsp;nich można ustawić niżej, niż wynosi realny koszt naprawy w&nbsp;warsztacie w&nbsp;Twojej okolicy.
      </p>
      <div class="guide-example">
        <strong>Przykład liczbowy (dane przykładowe):</strong> kosztorys zakłada 18&nbsp;roboczogodzin po&nbsp;70&nbsp;zł netto. Warsztaty w&nbsp;Twoim mieście biorą 175&nbsp;zł netto za&nbsp;godzinę. Różnica to 105&nbsp;zł × 18&nbsp;h = <strong>1&nbsp;890&nbsp;zł netto</strong>, których w&nbsp;wypłacie brakuje, choć zakres naprawy jest taki sam. Do&nbsp;tego dochodzą zwykle potrącenia na&nbsp;częściach i&nbsp;materiałach.
      </div>

      <h3 class="guide-h">2. Cztery najczęstsze sposoby zaniżania</h3>
      <p class="guide-sub">Każdy z&nbsp;nich widać w&nbsp;kosztorysie, jeśli wiesz, gdzie patrzeć. Nasz audyt sprawdza je automatycznie.</p>
      <div class="guide-grid">
        <div class="guide-card">
          <div class="num">Nożyczki nr 1</div>
          <h4>Zaniżona stawka za&nbsp;roboczogodzinę</h4>
          <p>Ubezpieczyciel wpisuje stawkę niższą niż ta, którą faktycznie biorą warsztaty w&nbsp;Twojej okolicy. Każda godzina pracy blacharza i&nbsp;lakiernika jest przez to „tańsza” tylko na&nbsp;papierze.</p>
          <p class="law">Rekomendacja 15 KNF (pkt&nbsp;15.3): stawka powinna wynikać z&nbsp;cen warsztatów działających na&nbsp;rynku lokalnym.</p>
        </div>
        <div class="guide-card">
          <div class="num">Nożyczki nr 2</div>
          <h4>Potrącenie „amortyzacji” z&nbsp;części</h4>
          <p>Nowy zderzak kosztuje 1&nbsp;850&nbsp;zł, ale ubezpieczyciel odejmuje np.&nbsp;40%, bo „auto ma już kilka lat”. Tymczasem do&nbsp;naprawy trzeba kupić część nową – za&nbsp;pełną cenę.</p>
          <p class="law">Uchwała 7 sędziów SN z&nbsp;12.04.2012, III CZP 80/11 i&nbsp;Rekomendacja 17 KNF (pkt&nbsp;17.2): co do&nbsp;zasady bez amortyzacji. Potrącenie jest możliwe tylko, gdy ubezpieczyciel wykaże, że&nbsp;naprawa podniosła wartość całego auta.</p>
        </div>
        <div class="guide-card">
          <div class="num">Nożyczki nr 3</div>
          <h4>Najtańsze zamienniki zamiast oryginałów</h4>
          <p>W&nbsp;kosztorysie część oryginalna zostaje zastąpiona tańszym zamiennikiem – nawet jeśli w&nbsp;aucie były oryginały albo samochód jest na&nbsp;gwarancji producenta.</p>
          <p class="law">Rekomendacja 18 KNF: wartość części ma zapewnić przywrócenie stanu sprzed szkody; pkt&nbsp;18.1: przy aucie na&nbsp;gwarancji, która wymaga części oryginalnych – tylko części O.</p>
        </div>
        <div class="guide-card">
          <div class="num">Nożyczki nr 4</div>
          <h4>Rabaty, których nikt Ci nie da</h4>
          <p>Od&nbsp;ceny części i&nbsp;lakieru odejmowany jest „rabat”, który obowiązuje wyłącznie w&nbsp;warsztatach współpracujących z&nbsp;ubezpieczycielem – nie w&nbsp;warsztacie, który wybierzesz Ty.</p>
          <p class="law">Rekomendacja 17 KNF (pkt&nbsp;17.3): ubezpieczyciel nie może powoływać się na&nbsp;rabaty obowiązujące w&nbsp;swoich warsztatach i&nbsp;punktach sprzedaży.</p>
        </div>
      </div>

      <h3 class="guide-h">3. Najpierw ustal, w&nbsp;jakiej jesteś sytuacji</h3>
      <p class="guide-sub">
        To najważniejszy krok. Od&nbsp;tego, co stało się z&nbsp;autem po&nbsp;wypadku, zależy, <strong>jak liczy się odszkodowanie</strong>. Kliknij swój przypadek.
      </p>

      <details class="scenario" open>
        <summary><span class="tag">A</span> Nie naprawiłem auta i&nbsp;nadal je mam</summary>
        <div class="scenario-body">
          <p>To sytuacja, w&nbsp;której kosztorys ma największe znaczenie. Należy Ci się kwota odpowiadająca <strong>realnemu kosztowi naprawy</strong> – nawet jeśli auta nie naprawisz albo naprawisz je taniej we&nbsp;własnym zakresie.</p>
          <ul>
            <li>Sprawdź kosztorys ubezpieczyciela w&nbsp;naszym audycie – zobaczysz każdą zaniżoną pozycję i&nbsp;jej wartość.</li>
            <li>Wyślij reklamację z&nbsp;żądaniem dopłaty (gotowe pismo generujemy po&nbsp;audycie).</li>
            <li><strong>Nie sprzedawaj i&nbsp;nie naprawiaj auta, zanim sprawa się nie wyjaśni</strong> – albo zrób wcześniej pełną dokumentację zdjęciową uszkodzeń i&nbsp;zachowaj kosztorys. Po&nbsp;sprzedaży lub naprawie zmienia się sposób liczenia (patrz B i&nbsp;C).</li>
          </ul>
          <div class="verdict">Twoja droga: audyt kosztorysu → reklamacja → (jeśli trzeba) Rzecznik Finansowy → sąd. Szczegóły w&nbsp;punkcie 4.</div>
        </div>
      </details>

      <details class="scenario">
        <summary><span class="tag">B</span> Już naprawiłem auto</summary>
        <div class="scenario-body">
          <p>Sąd Najwyższy w&nbsp;uchwale 7 sędziów z&nbsp;11.09.2024 (III CZP 65/23) uznał, że&nbsp;po naprawie <strong>nie liczy się już hipotetycznego kosztorysu</strong>. Odszkodowanie odpowiada temu, ile naprawa faktycznie i&nbsp;zasadnie kosztowała.</p>
          <ul>
            <li>Zbierz faktury i&nbsp;rachunki za&nbsp;naprawę (części, robocizna, lakierowanie).</li>
            <li>Jeśli faktury są wyższe niż wypłata – żądaj dopłaty różnicy na&nbsp;podstawie faktur.</li>
            <li>Jeśli naprawa była tańsza niż wypłata – trudno będzie dochodzić więcej.</li>
          </ul>
          <div class="warn">Uwaga: w&nbsp;2025&nbsp;r. trzyosobowy skład SN (uchwała z&nbsp;24.09.2025, III CZP 32/24) dopuścił liczenie według kosztorysu także po&nbsp;naprawie. Orzecznictwo jest więc rozbieżne, a&nbsp;uchwała 7 sędziów ma większą wagę. Ta sama uchwała z&nbsp;2025&nbsp;r. wskazała, że&nbsp;jeśli zapłaciłeś za&nbsp;naprawę bez VAT, odszkodowanie nie obejmuje VAT.</div>
        </div>
      </details>

      <details class="scenario">
        <summary><span class="tag">C</span> Sprzedałem auto bez naprawy</summary>
        <div class="scenario-body">
          <p>Według tej samej uchwały SN III CZP 65/23 po&nbsp;sprzedaży nienaprawionego auta odszkodowanie liczy się zwykle jako <strong>różnicę</strong> między wartością auta przed wypadkiem a&nbsp;ceną, za&nbsp;którą je sprzedałeś (tzw. metoda dyferencyjna).</p>
          <ul>
            <li>Przygotuj umowę sprzedaży (cena) i&nbsp;dowody wartości auta przed szkodą (np.&nbsp;wycena, ogłoszenia podobnych aut).</li>
            <li>Kosztorys ubezpieczyciela ma tu mniejsze znaczenie – liczy się, ile realnie straciłeś na&nbsp;wartości auta.</li>
          </ul>
          <div class="verdict">Nasz audyt kosztorysu pomoże pokazać skalę uszkodzeń, ale głównym argumentem będzie różnica w&nbsp;wartości auta.</div>
        </div>
      </details>

      <details class="scenario">
        <summary><span class="tag">D</span> Prowadzę firmę i&nbsp;odliczam VAT</summary>
        <div class="scenario-body">
          <p>Jeśli auto jest w&nbsp;firmie i&nbsp;możesz odliczyć VAT od&nbsp;naprawy, odszkodowanie wypłacane jest co do&nbsp;zasady w&nbsp;kwotach <strong>netto</strong> – VAT odzyskujesz w&nbsp;rozliczeniu z&nbsp;urzędem skarbowym, a&nbsp;nie od&nbsp;ubezpieczyciela.</p>
          <ul>
            <li>Wszystkie zaniżenia (stawka, amortyzacja, części, rabaty) dotyczą Cię tak samo – tylko liczone są od&nbsp;kwot netto.</li>
          </ul>
        </div>
      </details>

      <details class="scenario">
        <summary><span class="tag">E</span> Ubezpieczyciel uznał szkodę całkowitą</summary>
        <div class="scenario-body">
          <p>Szkoda całkowita to sytuacja, gdy naprawa jest nieopłacalna. Wtedy ubezpieczyciel wypłaca <strong>wartość auta sprzed wypadku minus wartość wraku</strong>. Spór dotyczy zwykle zaniżonej wartości auta albo zawyżonej wartości wraku – to inne zagadnienie niż kosztorys naprawy.</p>
          <div class="warn">Nasz audyt sprawdza kosztorysy szkód częściowych (naprawy). Przy szkodzie całkowitej warto sprawdzić, czy próg opłacalności naprawy nie został wyliczony z&nbsp;zaniżonej stawki – wtedy kosztorys naprawy też ma znaczenie.</div>
        </div>
      </details>

      <h3 class="guide-h">4. Co robić krok po&nbsp;kroku</h3>
      <p class="guide-sub">Ścieżka dla najczęstszej sytuacji: wypłata przyszła, ale jest za&nbsp;niska.</p>
      <ol class="steps">
        <li>
          <h4>Weź wypłatę – to nie zamyka sprawy</h4>
          <p>Przyjęcie przelewu nie oznacza zgody na&nbsp;jego wysokość. Możesz dochodzić dopłaty. <strong>Nie podpisuj jednak ugody ani oświadczenia, że&nbsp;nie masz dalszych roszczeń</strong> – to może zamknąć drogę do&nbsp;dopłaty.</p>
        </li>
        <li>
          <h4>Zdobądź kosztorys na&nbsp;piśmie</h4>
          <p>Poproś ubezpieczyciela o&nbsp;pełną kalkulację naprawy (PDF z&nbsp;Audatex / Eurotax / DAT). Ubezpieczyciel powinien ją przekazać (Rekomendacja 14 KNF). Bez kosztorysu nie da się wskazać, które pozycje są zaniżone.</p>
        </li>
        <li>
          <h4>Sprawdź kosztorys i&nbsp;wyślij reklamację</h4>
          <p>Wgraj kosztorys do&nbsp;audytu powyżej. Dostaniesz listę zaniżeń z&nbsp;kwotami i&nbsp;gotowe pismo reklamacyjne. Wyślij je listem poleconym lub przez formularz reklamacyjny ubezpieczyciela i&nbsp;<strong>zachowaj dowód wysłania</strong>.</p>
          <p>Ubezpieczyciel ma <strong>30&nbsp;dni</strong> na&nbsp;odpowiedź, a&nbsp;w&nbsp;szczególnie skomplikowanych sprawach – po&nbsp;poinformowaniu Cię o&nbsp;przyczynie – do&nbsp;60&nbsp;dni (ustawa o&nbsp;rozpatrywaniu reklamacji, art.&nbsp;5 i&nbsp;6). Jeśli nie odpowie w&nbsp;terminie, ustawa (art.&nbsp;8) każe uznać reklamację za&nbsp;rozpatrzoną zgodnie z&nbsp;Twoją wolą. W&nbsp;praktyce ubezpieczyciele i&nbsp;sądy różnie oceniają skutki tego przepisu – traktuj go jako mocny argument, nie automatyczną wygraną.</p>
        </li>
        <li>
          <h4>Oceń odpowiedź</h4>
          <ul>
            <li><strong>Dopłacili całość</strong> – sprawa zamknięta.</li>
            <li><strong>Dopłacili część</strong> – możesz przyjąć dopłatę i&nbsp;dochodzić reszty dalej.</li>
            <li><strong>Odmówili albo milczą</strong> – przejdź do&nbsp;kroku 5.</li>
          </ul>
        </li>
        <li>
          <h4>Rzecznik Finansowy</h4>
          <p>Po&nbsp;nieuwzględnionej reklamacji możesz złożyć wniosek do&nbsp;Rzecznika Finansowego o&nbsp;<strong>postępowanie interwencyjne</strong> – Rzecznik zwraca się do&nbsp;ubezpieczyciela o&nbsp;ponowne przeanalizowanie sprawy. Jest też <strong>postępowanie polubowne</strong> (próba ugody z&nbsp;udziałem Rzecznika). Szczegóły i&nbsp;formularze: <a href="https://rf.gov.pl" target="_blank" rel="noopener" style="color: var(--accent);">rf.gov.pl</a>.</p>
        </li>
        <li>
          <h4>Sąd</h4>
          <p>Jeśli nic nie pomoże, pozywasz ubezpieczyciela o&nbsp;dopłatę. Wysokość szkody ustala zwykle biegły. Przegrywający co do&nbsp;zasady zwraca koszty procesu. Opłata od&nbsp;pozwu przy kwotach do&nbsp;20&nbsp;000&nbsp;zł jest stała:</p>
          <table class="fee-table">
            <tr><td>do 500&nbsp;zł</td><td>30&nbsp;zł</td></tr>
            <tr><td>500 – 1&nbsp;500&nbsp;zł</td><td>100&nbsp;zł</td></tr>
            <tr><td>1&nbsp;500 – 4&nbsp;000&nbsp;zł</td><td>200&nbsp;zł</td></tr>
            <tr><td>4&nbsp;000 – 7&nbsp;500&nbsp;zł</td><td>400&nbsp;zł</td></tr>
            <tr><td>7&nbsp;500 – 10&nbsp;000&nbsp;zł</td><td>500&nbsp;zł</td></tr>
            <tr><td>10&nbsp;000 – 15&nbsp;000&nbsp;zł</td><td>750&nbsp;zł</td></tr>
            <tr><td>15&nbsp;000 – 20&nbsp;000&nbsp;zł</td><td>1&nbsp;000&nbsp;zł</td></tr>
          </table>
          <p>Powyżej 20&nbsp;000&nbsp;zł opłata wynosi 5% żądanej kwoty (art.&nbsp;13 ustawy o&nbsp;kosztach sądowych w&nbsp;sprawach cywilnych).</p>
          <p>Alternatywa: sprzedaż roszczenia firmie odszkodowawczej (cesja). Dostajesz pieniądze od&nbsp;razu, ale zwykle tylko część tego, co mógłbyś odzyskać.</p>
        </li>
      </ol>

      <div class="guide-example" style="border-left-color: var(--accent-amber);">
        <strong>Ile masz czasu?</strong> Roszczenie o&nbsp;naprawienie szkody przedawnia się co do&nbsp;zasady po&nbsp;<strong>3&nbsp;latach</strong> od&nbsp;dnia, w&nbsp;którym dowiedziałeś się o&nbsp;szkodzie i&nbsp;o&nbsp;tym, kto ma ją naprawić (art.&nbsp;442<sup>1</sup> § 1 k.c.). Zgłoszenie szkody ubezpieczycielowi przerywa bieg przedawnienia – liczy się on od&nbsp;nowa od&nbsp;dnia, w&nbsp;którym otrzymasz na&nbsp;piśmie decyzję ubezpieczyciela (art.&nbsp;819 § 4 k.c.). Zachowaj daty zgłoszenia i&nbsp;doręczenia decyzji.
      </div>

      <h3 class="guide-h">5. Czego nie robić</h3>
      <div class="dont-list">
        <div><strong>Nie podpisuj ugody „w ciemno”</strong>Oświadczenie o&nbsp;zrzeczeniu się dalszych roszczeń może zamknąć drogę do&nbsp;dopłaty.</div>
        <div><strong>Nie wyrzucaj dokumentów</strong>Kosztorys, decyzja, zdjęcia uszkodzeń, faktury i&nbsp;potwierdzenia wysyłki to Twoje dowody.</div>
        <div><strong>Nie sprzedawaj auta pochopnie</strong>Sprzedaż przed rozliczeniem zmienia sposób liczenia odszkodowania (scenariusz C).</div>
        <div><strong>Nie czekaj latami</strong>Pilnuj terminu przedawnienia i&nbsp;terminów odpowiedzi na&nbsp;reklamację.</div>
      </div>

      <div class="guide-sources">
        Informacje mają charakter ogólny i&nbsp;nie zastępują porady prawnej w&nbsp;konkretnej sprawie. Stan na&nbsp;październik 2026&nbsp;r. Źródła:
        <a href="https://www.sn.pl/sites/orzecznictwo/Orzeczenia3/III%20CZP%2065-23.pdf" target="_blank" rel="noopener">uchwała SN III CZP 65/23</a>,
        <a href="http://www.sn.pl/sites/orzecznictwo/orzeczenia1/iii%20czp%2080-11.pdf" target="_blank" rel="noopener">uchwała SN III CZP 80/11</a>,
        <a href="https://www.knf.gov.pl/knf/pl/komponenty/img/Rekomendacje_dot_likwidacji_szkod_z_ubezpieczen_komunikacyjnych_78983.pdf" target="_blank" rel="noopener">Rekomendacje KNF dot. likwidacji szkód komunikacyjnych (od 1.11.2022)</a>,
        <a href="https://rf.gov.pl/komunikat-rzecznika-finansowego-w-sprawie-uchwaly-sadu-najwyzszego-z-dnia-11-wrzesnia-2024-r-sygn-akt-iii-czp-65-23-aktualizacja/" target="_blank" rel="noopener">komunikat Rzecznika Finansowego</a>,
        <a href="https://rf.gov.pl/wp-content/uploads/2024/04/Edu-info-I-Roboczogodziny.pdf" target="_blank" rel="noopener">RF: roboczogodziny</a>,
        <a href="https://rf.gov.pl/wp-content/uploads/2022/06/Edu-info-III-Amortyzacja-wartosci-czesci.pdf" target="_blank" rel="noopener">RF: amortyzacja części</a>.
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <div style="max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; border-bottom: 1px solid var(--border); padding-bottom: 20px;">
          <div style="max-width: 520px;">
            <div style="font-weight: 700; color: #fff; font-size: 16px;">zanisko.pl – Niezależny audytor kosztorysów z OC sprawcy</div>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px; line-height: 1.6;">
              System automatycznej weryfikacji kalkulacji napraw powypadkowych oparty o orzecznictwo Sądu Najwyższego RP (uchwały III CZP 80/11, III CZP 32/03, III CZP 65/23) oraz Rekomendacje Komisji Nadzoru Finansowego (KNF).
            </p>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
            <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Informacje prawne i pomoc</div>
            <div><a href="/regulamin.html" style="color: var(--text-muted); text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Regulamin serwisu</a></div>
            <div><a href="/polityka-prywatnosci.html" style="color: var(--text-muted); text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Polityka prywatności i cookies</a></div>
            <div><a href="/kontakt.html" style="color: var(--text-muted); text-decoration: none;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'">Kontakt i procedura reklamacyjna (14 dni)</a></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; font-size: 12px; color: var(--text-dim);">
          <div>
            <strong>Sprzedawca:</strong> Multinewsroom Jan Domaniewski &bull; ul. Barcicka 44, 01-839 Warszawa &bull; NIP: 525-218-92-41 &bull; REGON: 147154574 &bull; E-mail: <a href="mailto:kontakt@zanisko.pl" style="color: var(--text-muted); text-decoration: underline;">kontakt@zanisko.pl</a>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-weight: 600; color: #fff; font-size: 11px;">BLIK</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-weight: 600; color: #fff; font-size: 11px;">Visa</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-weight: 600; color: #fff; font-size: 11px;">Mastercard</span>
            <span style="background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; font-weight: 600; color: #fff; font-size: 11px;">Przelewy24</span>
          </div>
        </div>

        <div style="font-size: 11px; color: var(--text-dim); line-height: 1.5;">
          Operatorem płatności jest PayPro S.A. z siedzibą w Poznaniu, ul. Pastelowa 8, 60-198 Poznań, wpisana do rejestru przedsiębiorców KRS pod numerem 0000347935, NIP 779-236-98-87, REGON 301345068, krajowa instytucja płatnicza nadzorowana przez Komisję Nadzoru Finansowego (KNF). Reklamacje dotyczące usług są rozpatrywane w terminie do 14 dni.
        </div>
      </div>
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
      pb.style.display = 'flex';
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
    async function generateAndDisplayLetter(options = {}) {
      if (!currentAuditReport) return;

      const claimantName = document.getElementById('claimantName')?.value || 'Jan Kowalski';
      const claimantAddress = document.getElementById('claimantAddress')?.value || 'ul. Marszałkowska 10/12, 00-001 Warszawa';
      const bankAccountNumber = document.getElementById('claimantIban')?.value || '12 1020 1026 0000 1234 5678 9012';
      const previewEl = document.getElementById('letterPreview');

      // Animowany obracający się spinner koła wewnątrz podglądu pisma
      previewEl.innerHTML = 
        '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 48px 20px; text-align: center; gap: 16px;">' +
          '<div class="wheel-3d-stage" style="width: 80px; height: 80px; margin: 0 auto;">' +
            '<svg class="spinning-wheel-svg" viewBox="0 0 120 120" width="80" height="80">' +
              '<circle cx="60" cy="60" r="56" fill="url(#tireGrad)" stroke="#0b0d11" stroke-width="3"/>' +
              '<circle cx="60" cy="60" r="54" fill="none" stroke="#2c323f" stroke-width="2.5" stroke-dasharray="3, 5.5"/>' +
              '<circle cx="60" cy="60" r="38" fill="url(#discGrad)" stroke="#64748b" stroke-width="1"/>' +
              '<circle cx="60" cy="60" r="41" fill="none" stroke="url(#rimGrad)" stroke-width="2.5"/>' +
              '<line x1="60" y1="20" x2="60" y2="100" stroke="url(#spokeGrad)" stroke-width="3.5" stroke-linecap="round"/>' +
              '<line x1="20" y1="60" x2="100" y2="60" stroke="url(#spokeGrad)" stroke-width="3.5" stroke-linecap="round"/>' +
              '<circle cx="60" cy="60" r="14" fill="url(#hubGrad)" stroke="#38bdf8" stroke-width="1.5"/>' +
            '</svg>' +
          '</div>' +
          '<div style="font-size: 16px; font-weight: 700; color: #38bdf8;">Trwa redagowanie spersonalizowanego wezwania do zapłaty...</div>' +
          '<div style="font-size: 13px; color: var(--text-muted); max-width: 480px;">' +
            'Weryfikacja orzecznictwa Sądu Najwyższego (uchwały III CZP 80/11 i III CZP 32/03), stawek rynkowych PIM 2026 oraz wytycznych KNF w toku.' +
          '</div>' +
        '</div>';

      try {
        const res = await fetch('/api/generate-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: currentAuditReport,
            options: { claimantName, claimantAddress, bankAccountNumber },
            useAi: Boolean(options.useAi),
          }),
        });
        const data = await res.json();
        currentLetterText = data.letter;
        previewEl.textContent = data.letter;
        showToast('Wezwanie do zapłaty zostało wygenerowane.');
      } catch (err) {
        previewEl.textContent = 'Błąd generowania pisma: ' + err.message;
      }
    }

    async function enhanceLetterWithAi() {
      showProgress('Trwa analiza orzecznictwa i redagowanie argumentacji przez Gemini...', 45);
      try {
        await generateAndDisplayLetter({ useAi: true });
      } finally {
        hideProgress();
      }
    }

    // Pobieranie wezwania w wybranym formacie (DOCX, PDF, RTF, TXT)
    async function downloadLetter(format) {
      if (!currentAuditReport) return;
      showProgress('Przygotowywanie wezwania (' + format.toUpperCase() + ')...', 45);
      try {
        const claimSafe = (currentAuditReport && currentAuditReport.header && currentAuditReport.header.claimNumber)
          ? currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_')
          : 'szkoda';
        const filename = 'wezwanie_do_zaplaty_' + claimSafe;
        await exportDocument({
          text: currentLetterText || '',
          report: currentAuditReport,
          options: {
            claimantName: document.getElementById('claimantName')?.value || 'Jan Kowalski',
            claimantAddress: document.getElementById('claimantAddress')?.value || 'ul. Marszałkowska 10/12, 00-001 Warszawa',
            bankAccountNumber: document.getElementById('claimantIban')?.value || '12 1020 1026 0000 1234 5678 9012',
          },
          title: 'PRZEDSĄDOWE WEZWANIE DO ZAPŁATY - SZKODA ' + (currentAuditReport ? currentAuditReport.header.claimNumber : ''),
          format: format,
          filename: filename,
        });
      } catch (err) {
        hideProgress();
        alert('Błąd pobierania wezwania: ' + err.message);
      }
    }

    // Pobieranie załącznika (attachment1, attachment2, attachment3) w wybranym formacie
    async function downloadAttachment(attachmentId, format) {
      if (!currentAuditReport) return;
      showProgress('Przygotowywanie załącznika ' + format.toUpperCase() + '...', 40);
      try {
        const res = await fetch('/api/attachments/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentAuditReport }),
        });
        const data = await res.json();
        const att = data.attachments.find(a => a.id === attachmentId);
        if (!att) throw new Error('Nie odnaleziono załącznika');

        const claimSafe = currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_');
        const filename = att.id + '_' + claimSafe;
        await exportDocument({
          text: att.textContent,
          html: att.htmlContent,
          attachment: att,
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
      showProgress('Generowanie kompletnego pakietu (' + format.toUpperCase() + ')...', 40);
      try {
        const claimSafe = currentAuditReport.header.claimNumber.split('/').join('_').split('\\\\').join('_');
        const filename = 'kompletny_pakiet_procesowy_' + claimSafe;

        const res = await fetch('/api/export-bundle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: currentAuditReport,
            letterText: currentLetterText || '',
            options: {
              claimantName: document.getElementById('claimantName')?.value || 'Jan Kowalski',
              claimantAddress: document.getElementById('claimantAddress')?.value || 'ul. Marszałkowska 10/12, 00-001 Warszawa',
              bankAccountNumber: document.getElementById('claimantIban')?.value || '12 1020 1026 0000 1234 5678 9012',
            },
            format: format,
            filename: filename,
            title: 'KOMPLETNY PAKIET PROCESOWY – SZKODA ' + currentAuditReport.header.claimNumber,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Błąd serwera ' + res.status);
        }

        const blob = await res.blob();
        hideProgress();

        const ext = (format === 'docx' || format === 'doc') ? '.docx' : (format === 'pdf' ? '.pdf' : (format === 'rtf' ? '.rtf' : '.txt'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Pobrano kompletny pakiet procesowy (' + format.toUpperCase() + ').');
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
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Serwer zwrócił kod błędu ' + res.status);
        }
        const blob = await res.blob();
        hideProgress();

        const ext = (params.format === 'docx' || params.format === 'doc') ? '.docx' : params.format === 'pdf' ? '.pdf' : params.format === 'rtf' ? '.rtf' : '.txt';
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

    // GET /regulamin, /regulamin.html, /polityka-prywatnosci, /polityka-prywatnosci.html, /kontakt, /kontakt.html - Wymogi prawne Przelewy24 (PayPro S.A.)
    const LEGAL_PAGES: Record<string, string> = {
      '/regulamin': 'public/regulamin.html',
      '/regulamin.html': 'public/regulamin.html',
      '/polityka-prywatnosci': 'public/polityka-prywatnosci.html',
      '/polityka-prywatnosci.html': 'public/polityka-prywatnosci.html',
      '/kontakt': 'public/kontakt.html',
      '/kontakt.html': 'public/kontakt.html',
    };

    if ((req.method === 'GET' || req.method === 'HEAD') && LEGAL_PAGES[url.pathname]) {
      const pageFile = path.resolve(LEGAL_PAGES[url.pathname]);
      if (fs.existsSync(pageFile)) {
        const content = fs.readFileSync(pageFile, 'utf-8');
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        res.end(content);
        return;
      }
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

    // GET /favicon.ico, /favicon.svg, /favicon.png, /apple-touch-icon*.png, /site.webmanifest - Zasoby główne dla Safari i Chrome
    const ROOT_STATIC_ASSETS: Record<string, { file: string; type: string }> = {
      '/favicon.ico': { file: 'public/favicon.ico', type: 'image/x-icon' },
      '/favicon.svg': { file: 'public/favicon.svg', type: 'image/svg+xml' },
      '/favicon.png': { file: 'public/favicon.png', type: 'image/png' },
      '/apple-touch-icon.png': { file: 'public/apple-touch-icon.png', type: 'image/png' },
      '/apple-touch-icon-precomposed.png': { file: 'public/apple-touch-icon-precomposed.png', type: 'image/png' },
      '/site.webmanifest': { file: 'public/site.webmanifest', type: 'application/manifest+json' },
    };

    if ((req.method === 'GET' || req.method === 'HEAD') && ROOT_STATIC_ASSETS[url.pathname]) {
      const asset = ROOT_STATIC_ASSETS[url.pathname];
      const assetPath = path.resolve(asset.file);
      if (fs.existsSync(assetPath)) {
        const stat = fs.statSync(assetPath);
        res.writeHead(200, {
          'Content-Type': asset.type,
          'Content-Length': stat.size,
          'Cache-Control': 'public, max-age=86400',
        });
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    // GET /images/* - Serwowanie grafik, ikon i fotografii użytkownika
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/images/')) {
      const imageName = path.basename(url.pathname);
      const imagePath = path.resolve('public/images', imageName);
      if (fs.existsSync(imagePath)) {
        const ext = path.extname(imageName).toLowerCase();
        let contentType = 'image/jpeg';
        if (ext === '.png') contentType = 'image/png';
        else if (ext === '.svg') contentType = 'image/svg+xml';
        else if (ext === '.ico') contentType = 'image/x-icon';
        else if (ext === '.webp') contentType = 'image/webp';
        else if (ext === '.webmanifest') contentType = 'application/manifest+json';
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

    // POST /api/export-document - Uniwersalny eksport dokumentów procesowych (DOCX, DOC, RTF, TXT, PDF)
    if (req.method === 'POST' && url.pathname === '/api/export-document') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const format = String(payload.format || 'txt').toLowerCase();
          const title = payload.title || 'Dokument procesowy';
          let text = payload.text || '';
          if (!text.trim() && payload.report) {
            text = generateDemandLetter(payload.report, payload.options || {
              claimantName: 'Poszkodowany',
              claimantAddress: 'ul. Marszałkowska 10/12, 00-001 Warszawa',
              bankAccountNumber: '12 1020 1026 0000 1234 5678 9012',
            });
          }
          const html = payload.html || demandLetterToHtml(text);
          const filename = payload.filename || 'dokument';

          let buffer: Buffer;
          let contentType: string;
          let ext: string;

          switch (format) {
            case 'docx':
              if (payload.attachment) {
                buffer = exportAttachmentToDocx(payload.attachment);
              } else {
                buffer = exportDemandLetterToDocx(text, title);
              }
              contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              ext = '.docx';
              break;
            case 'doc':
              if (payload.attachment) {
                buffer = exportAttachmentToDocx(payload.attachment);
              } else if (text) {
                buffer = exportDemandLetterToDocx(text, title);
              } else {
                buffer = exportToDoc(html, title);
              }
              contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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

    // POST /api/export-bundle - Kompletny pakiet procesowy (Wezwanie + Załączniki w jednym spójnym dokumencie)
    if (req.method === 'POST' && url.pathname === '/api/export-bundle') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const format = String(payload.format || 'docx').toLowerCase();
          const report = payload.report as AuditReport;
          const defaultOptions = {
            claimantName: 'Poszkodowany',
            claimantAddress: 'ul. Marszałkowska 10/12, 00-001 Warszawa',
            bankAccountNumber: '12 1020 1026 0000 1234 5678 9012',
          };

          if (!report) {
            throw new Error('Brak raportu audytowego do wygenerowania pakietu');
          }

          let letterText = payload.letterText || '';
          if (!letterText.trim()) {
            letterText = generateDemandLetter(report, payload.options || defaultOptions);
          }

          const filename = payload.filename || 'kompletny_pakiet_procesowy';
          const title = payload.title || 'Kompletny pakiet procesowy';

          const att1 = generateAttachment1Audit(report);
          const att2 = generateAttachment2PimRates(report.header.voivodeship, report.header.vehicleSegment);
          const att3 = generateAttachment3LegalBasis();
          const attachments = [att1, att2, att3];

          let buffer: Buffer;
          let contentType: string;
          let ext: string;

          if (format === 'docx' || format === 'doc') {
            buffer = exportBundleToDocx(letterText, attachments, title);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            ext = format === 'doc' ? '.doc' : '.docx';
          } else {
            let bundleText = letterText;
            for (const att of attachments) {
              bundleText += '\n\n\f\n\n' + '='.repeat(60) + '\n' + att.title + '\n' + '='.repeat(60) + '\n\n' + att.textContent;
            }

            if (format === 'pdf') {
              buffer = await exportToPdf(bundleText, title);
              contentType = 'application/pdf';
              ext = '.pdf';
            } else if (format === 'rtf') {
              buffer = exportToRtf(bundleText);
              contentType = 'application/rtf; charset=utf-8';
              ext = '.rtf';
            } else {
              buffer = exportToTxt(bundleText);
              contentType = 'text/plain; charset=utf-8';
              ext = '.txt';
            }
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Content-Disposition': `attachment; filename="${filename}${ext}"`,
          });
          res.end(buffer);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Błąd generowania pakietu procesowego';
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

