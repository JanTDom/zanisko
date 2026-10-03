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
  <meta name="description" content="Odzyskaj należne odszkodowanie z OC sprawcy. Niezależny audytor kosztorysów naprawy wskazuje zaniżenia stawek, części i zakresu naprawy.">
  <link rel="icon" href="/favicon.ico?v=20261003" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=20261003">
  <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32.png?v=20261003">
  <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16.png?v=20261003">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=20261003">
  <link rel="manifest" href="/site.webmanifest?v=20261003">
  <!-- Legacy declarations kept in source for existing integrations; versioned links above are active. <link rel="icon" href="/favicon.ico" sizes="any"> <link rel="icon" type="image/svg+xml" href="/favicon.svg"> <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"> -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --ink:#102038; --ink-soft:#44536b; --muted:#728095; --paper:#f6f8f5; --surface:#fff; --line:#dfe6e3; --line-strong:#cbd7d2; --teal:#0a9f9a; --teal-dark:#087d7b; --teal-wash:#e5f5f2; --amber:#b97927; --shadow:0 24px 70px rgba(16,32,56,.09); --shadow-soft:0 10px 30px rgba(16,32,56,.07); --display:'Space Grotesk','DM Sans',sans-serif; --body:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif; }
    * { box-sizing:border-box; margin:0; padding:0; }
    html { scroll-behavior:smooth; }
    body { background:var(--paper); color:var(--ink); font-family:var(--body); line-height:1.55; -webkit-font-smoothing:antialiased; }
    a { color:inherit; } button,input,textarea,select { font:inherit; } button,a { -webkit-tap-highlight-color:transparent; }
    h1,h2,h3,h4 { font-family:var(--display); letter-spacing:-.045em; line-height:1.06; } h1 { font-size:clamp(3rem,6vw,6.7rem); font-weight:600; } h2 { font-size:clamp(2rem,3.6vw,3.6rem); font-weight:600; } h3 { font-size:clamp(1.5rem,2.1vw,2.1rem); } h4 { font-size:1.1rem; letter-spacing:-.02em; } p { color:var(--ink-soft); }
    .container { max-width:1320px; margin:0 auto; padding:0 44px; }
    nav { position:sticky; top:0; z-index:50; background:rgba(16,32,56,.96); border-bottom:1px solid rgba(169,227,214,.15); backdrop-filter:blur(18px); }
    .nav-inner { max-width:1320px; min-height:76px; margin:0 auto; padding:0 44px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
    .brand-logo { display:inline-flex; align-items:center; text-decoration:none; gap:13px; } .brand-logo img { width:176px; height:auto; object-fit:contain; }
    .brand-tag { color:#a9e3d6; border-left:1px solid rgba(255,255,255,.2); padding-left:14px; font-size:11px; letter-spacing:.16em; text-transform:uppercase; font-weight:700; }
    .nav-status { display:flex; align-items:center; gap:9px; color:#c4d0d6; font-size:12px; font-weight:600; } .pulse-dot { width:8px; height:8px; border-radius:100%; background:var(--teal); box-shadow:0 0 0 5px rgba(10,159,154,.12); }
    .nav-links { display:flex; gap:7px; align-items:center; } .nav-pill-btn { border:1px solid rgba(255,255,255,.16); color:#d4e0e5; border-radius:999px; padding:10px 14px; text-decoration:none; font-size:12px; font-weight:600; transition:.2s ease; } .nav-pill-btn:hover { border-color:var(--teal); color:var(--teal-dark); transform:translateY(-1px); } .nav-pill-highlight { color:var(--teal-dark); border-color:rgba(10,159,154,.35); background:var(--teal-wash); }
    .hero { display:grid; grid-template-columns:minmax(0,1.02fr) minmax(420px,.98fr); gap:clamp(44px,7vw,120px); align-items:center; padding:94px 0 112px; position:relative; } .hero::before { content:""; position:absolute; right:-180px; top:20px; width:620px; height:620px; border-radius:50%; background:radial-gradient(circle,rgba(10,159,154,.12),transparent 68%); pointer-events:none; }
    .hero-label,.eyebrow,.section-kicker { color:var(--teal-dark); text-transform:uppercase; letter-spacing:.19em; font-size:11px; font-weight:700; margin-bottom:24px; } .hero-label { display:flex; align-items:center; gap:12px; } .hero-label::before { content:""; width:28px; height:2px; background:var(--teal); }
    .hero h1 { color:var(--ink); margin-bottom:25px; } .hero h1 em { color:var(--teal); font-style:normal; } .hero-lead { max-width:610px; font-size:clamp(1.06rem,1.5vw,1.28rem); line-height:1.62; color:var(--ink-soft); }
    .hero-guide-link { display:inline-flex; margin-top:30px; color:var(--ink); text-decoration:none; font-weight:700; font-size:14px; border-bottom:1px solid var(--teal); padding-bottom:4px; } .hero-guide-link::after { content:'↗'; color:var(--teal); margin-left:10px; font-size:18px; line-height:.7; }
    .hero-stats-row { display:flex; flex-wrap:wrap; gap:28px; margin-top:55px; } .stat-box { min-width:128px; border-top:1px solid var(--line-strong); padding-top:13px; } .stat-val { font:600 1.45rem var(--display); letter-spacing:-.04em; } .stat-desc { margin-top:4px; font-size:11px; line-height:1.35; color:var(--muted); max-width:145px; }
    .hero-visual-card { position:relative; min-height:580px; border-radius:28px; overflow:hidden; box-shadow:var(--shadow); background:var(--ink); } .hero-visual-card::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg,rgba(16,32,56,.04),rgba(16,32,56,.5)); pointer-events:none; } .hero-visual-card img { width:100%; height:100%; min-height:580px; display:block; object-fit:cover; filter:saturate(.78) contrast(1.04); }
    .hero-card-overlay { position:absolute; z-index:1; bottom:22px; left:22px; right:22px; display:flex; justify-content:space-between; align-items:end; gap:20px; padding:22px; border:1px solid rgba(255,255,255,.18); border-radius:16px; background:rgba(16,32,56,.77); color:#fff; backdrop-filter:blur(14px); } .overlay-tag { color:#9bd8d0; text-transform:uppercase; letter-spacing:.15em; font-size:10px; font-weight:700; margin-bottom:7px; } .overlay-title { font:500 1.12rem var(--display); } .diff-badge { color:#082d31; background:#a9e3d6; border-radius:999px; padding:9px 13px; font-weight:700; font-size:13px; white-space:nowrap; }
    .tool-section { background:var(--ink); color:#fff; border-radius:30px; padding:clamp(28px,5vw,68px); margin-bottom:100px; box-shadow:0 30px 90px rgba(16,32,56,.16); position:relative; overflow:hidden; scroll-margin-top:100px; } .tool-section::after { content:""; width:400px; height:400px; border:1px solid rgba(169,227,214,.14); border-radius:50%; position:absolute; right:-160px; bottom:-190px; }
    .section-header { position:relative; z-index:1; max-width:720px; margin-bottom:34px; } .tool-section .section-header h2 { color:#fff; margin-bottom:12px; } .tool-section .section-header p { color:#afbdc7; font-size:1.06rem; }
    .input-tabs { display:flex; gap:7px; border-bottom:1px solid rgba(255,255,255,.12); margin-bottom:24px; position:relative; z-index:1; } .tab-btn { color:#9cabb9; background:transparent; border:0; border-bottom:2px solid transparent; padding:13px 15px; cursor:pointer; font-weight:600; font-size:13px; transition:.2s ease; } .tab-btn:hover,.tab-btn.active { color:#a9e3d6; border-bottom-color:var(--teal); }
    .dropzone { min-height:240px; border:1px dashed rgba(169,227,214,.55); background:rgba(255,255,255,.045); border-radius:18px; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; cursor:pointer; transition:.2s ease; position:relative; z-index:1; } .dropzone:hover,.dropzone.dragover { border-color:#a9e3d6; background:rgba(10,159,154,.11); transform:translateY(-2px); } .dropzone-icon { width:42px; height:42px; color:#a9e3d6; margin-bottom:16px; } .dropzone-title { color:#fff; font:500 1.18rem var(--display); } .dropzone-sub { color:#9cabb9; margin-top:7px; font-size:13px; }
    #tabTextContent textarea { min-height:220px; resize:vertical; width:100%; color:#fff; background:rgba(255,255,255,.05); border:1px solid rgba(169,227,214,.4); border-radius:14px; padding:17px; outline:none; line-height:1.6; } #tabTextContent textarea:focus { border-color:#a9e3d6; box-shadow:0 0 0 4px rgba(10,159,154,.15); }
    .params-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:22px; position:relative; z-index:1; } .param-field { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:14px; } .param-field label { color:#9cabb9; display:block; font-size:10px; letter-spacing:.14em; text-transform:uppercase; font-weight:700; margin-bottom:8px; } .param-field select { width:100%; color:#fff; background:#1a2b43; border:1px solid rgba(255,255,255,.15); border-radius:9px; padding:12px; outline:none; font-size:13px; }
    .action-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:19px; position:relative; z-index:1; } .btn-primary,.btn-secondary,.chip-btn { border:0; border-radius:999px; min-height:46px; padding:0 20px; cursor:pointer; font-size:13px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; transition:.2s ease; } .btn-primary { color:#062f31; background:#a9e3d6; box-shadow:0 9px 24px rgba(10,159,154,.24); } .btn-primary:hover { background:#c6f1e7; transform:translateY(-2px); } .btn-secondary { color:#d3e5e1; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.16); } .btn-secondary:hover { border-color:#a9e3d6; color:#fff; transform:translateY(-2px); } .chip-btn { color:#a9e3d6; background:rgba(10,159,154,.14); border:1px solid rgba(169,227,214,.32); }
    .progress-bar-container { display:none; position:relative; z-index:2; margin-top:18px; } .progress-modal-card { width:100%; background:#17304a; border:1px solid rgba(169,227,214,.25); border-radius:14px; padding:17px; } .progress-modal-card .wheel-3d-wrapper { display:none; } .wheel-3d-wrapper { perspective:800px; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; } .wheel-3d-stage { width:120px; height:120px; position:relative; transform-style:preserve-3d; transform:rotateX(14deg) rotateY(-18deg); filter:drop-shadow(0 15px 25px rgba(0,0,0,.45)); } .spinning-wheel-svg { position:absolute; inset:0; width:100%; height:100%; animation:wheelSpin .75s linear infinite; transform-origin:50% 50%; transform-box:fill-box; } @keyframes wheelSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } } .static-caliper-svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:2; } .wheel-3d-shadow { border-radius:50%; margin-top:8px; background:radial-gradient(ellipse at center, rgba(0,0,0,.55) 0%, rgba(56,189,248,.18) 50%, transparent 80%); filter:blur(2px); animation:shadowPulse .75s ease-in-out infinite alternate; } @keyframes shadowPulse { from { transform:scaleX(.95); opacity:.75; } to { transform:scaleX(1.08); opacity:1; } } .busy-overlay { position:fixed; inset:0; z-index:90; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(12,24,38,.55); backdrop-filter:blur(3px); } .busy-overlay.is-visible { display:flex; } .busy-card { background:#fff; border-radius:18px; box-shadow:var(--shadow); max-width:440px; width:100%; } @media (prefers-reduced-motion: reduce) { .spinning-wheel-svg,.wheel-3d-shadow { animation-duration:3s; } } .progress-title { font:500 1rem var(--display); color:#fff; margin-bottom:11px; } .progress-track { height:8px; overflow:hidden; border-radius:99px; background:rgba(255,255,255,.1); } .progress-fill { height:100%; width:0; background:#a9e3d6; border-radius:99px; transition:width .35s ease; } .progress-label { display:flex; justify-content:space-between; gap:20px; margin-top:8px; color:#9cabb9; font-size:12px; }
    #auditResultsArea { display:none; margin:0 0 100px; scroll-margin-top:100px; } .teaser-card,#unlockedView { border:1px solid var(--line); border-radius:24px; padding:clamp(24px,4vw,54px); background:var(--surface); box-shadow:var(--shadow-soft); } .teaser-header { display:flex; justify-content:space-between; gap:30px; align-items:flex-start; padding-bottom:26px; border-bottom:1px solid var(--line); } .teaser-badge { display:inline-flex; color:var(--teal-dark); background:var(--teal-wash); border-radius:999px; padding:7px 11px; font-size:11px; font-weight:700; } #teaserVehicleTitle { margin-top:14px; font-size:clamp(1.65rem,3vw,2.4rem); } #teaserClaimMeta { color:var(--muted); font-size:13px; margin-top:7px; } .discrepancy-scale { margin-top:18px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; } .discrepancy-scale span:first-child { color:var(--amber)!important; font-size:11px; letter-spacing:.13em; text-transform:uppercase; } .scale-bar { width:105px; height:6px; background:#edf0ea; border-radius:99px; overflow:hidden; } .scale-fill { width:66%; height:100%; background:var(--amber); border-radius:99px; } .teaser-header>div:last-child { text-align:right; min-width:260px; } .teaser-header>div:last-child>div:first-child { color:var(--muted)!important; font-size:10px!important; letter-spacing:.12em; } #teaserEstimatedRange { color:var(--teal-dark)!important; font-size:clamp(1.7rem,3vw,2.6rem)!important; margin-top:7px; }
    .locked-section-container { margin-top:26px; position:relative; } .blur-preview,.cost-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:11px; } .blur-preview { opacity:.7; } .cost-card { border:1px solid var(--line); border-radius:14px; background:#fbfcfa; padding:17px; } .cost-card.highlight { background:var(--teal-wash); border-color:#a9ded6; } .cost-label { color:var(--muted); font-size:11px; } .cost-amount { font:600 1.55rem var(--display); margin-top:10px; } .cost-amount.emerald { color:var(--teal-dark); } .cost-sub { color:var(--muted); font-size:11px; margin-top:4px; }
    .paywall-overlay { margin-top:16px; border-radius:16px; border:1px solid #b7ded7; padding:22px; background:linear-gradient(100deg,#eaf8f4,#f7fbf7); } .paywall-overlay h3 { font-size:1.35rem; margin-bottom:7px; } .paywall-overlay p { font-size:13px; } .paywall-overlay .btn-primary { margin-top:14px; }
    .unlocked-head { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:24px; } .unlocked-head h2 { font-size:clamp(1.8rem,3vw,2.8rem); } .unlocked-head p { margin-top:10px; max-width:620px; }
    .violation-card { border:1px solid var(--line); border-left:3px solid var(--teal); border-radius:13px; padding:17px; background:#fbfcfa; margin-top:11px; } .violation-header { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; } .violation-title { font:600 1rem var(--display); } .violation-amount { color:var(--teal-dark); font:600 1rem var(--display); white-space:nowrap; } .violation-basis { color:var(--muted); font-size:11px; margin-top:5px; } .violation-desc { color:var(--ink-soft); font-size:13px; margin-top:8px; } .violation-items { margin-top:10px; font-size:12px; color:var(--ink-soft); } .violation-items ul { padding-left:18px; margin-top:5px; }
    .document-panel { border-top:1px solid var(--line); margin-top:34px; padding-top:30px; } .document-panel h3 { margin-bottom:7px; } .document-form { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:18px 0; } .document-form label { display:block; color:var(--muted); font-size:11px; font-weight:600; } .document-form input { width:100%; padding:12px; border:1px solid var(--line-strong); border-radius:9px; background:#fff; color:var(--ink); margin-top:6px; outline:none; } .document-form input:focus { border-color:var(--teal); box-shadow:0 0 0 4px rgba(10,159,154,.12); } .letter-sheet { background:#fbfcfa; border:1px solid var(--line); border-radius:14px; white-space:pre-wrap; padding:22px; max-height:360px; overflow:auto; color:var(--ink-soft); font-size:13px; line-height:1.68; } .document-actions,.attachments-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; } .attachments-section { border-top:1px solid var(--line); margin-top:30px; padding-top:24px; } .attachment-card { border:1px solid var(--line); padding:14px; border-radius:12px; margin-top:9px; display:flex; align-items:center; justify-content:space-between; gap:15px; } .attachment-card h4 { font-size:1rem; } .attachment-card p { font-size:12px; } .att-btn { border:1px solid var(--line-strong); border-radius:999px; color:var(--ink-soft); background:#fff; padding:7px 10px; cursor:pointer; font-size:11px; }
    .guide { padding:90px 0 100px; border-top:1px solid var(--line); } .guide .section-header { max-width:850px; } .guide-lead { font-size:1.1rem; margin-top:14px; } .guide-h { margin-top:66px; margin-bottom:14px; } .guide-sub { max-width:800px; } .guide-example { max-width:920px; border-left:3px solid var(--teal); background:#fff; box-shadow:var(--shadow-soft); border-radius:0 13px 13px 0; padding:19px 22px; margin-top:20px; color:var(--ink-soft); } .guide-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-top:25px; } .guide-card { background:#fff; border:1px solid var(--line); border-radius:15px; padding:23px; } .guide-card .num { color:var(--teal-dark); font-size:10px; font-weight:700; letter-spacing:.15em; text-transform:uppercase; margin-bottom:12px; } .guide-card h4 { margin-bottom:9px; } .guide-card p { font-size:13px; } .guide-card .law { color:var(--muted); margin-top:13px; font-size:11px; }
    .scenario { max-width:940px; background:#fff; border:1px solid var(--line); border-radius:14px; margin-top:10px; overflow:hidden; } .scenario summary { list-style:none; cursor:pointer; padding:18px 20px; font:600 1rem var(--display); display:flex; align-items:center; gap:12px; } .scenario summary::-webkit-details-marker { display:none; } .scenario summary::after { content:'+'; margin-left:auto; color:var(--teal); font-size:22px; font-weight:400; } .scenario[open] summary::after { content:'−'; } .scenario-body { border-top:1px solid var(--line); padding:18px 20px 21px; color:var(--ink-soft); font-size:14px; } .scenario-body ul { padding-left:20px; margin-top:12px; color:var(--ink-soft); } .scenario-body li+li { margin-top:8px; } .tag { width:25px; height:25px; border-radius:50%; background:var(--teal-wash); display:grid; place-items:center; font-size:11px; color:var(--teal-dark); }
    .steps { counter-reset:step; list-style:none; max-width:940px; margin-top:24px; } .steps li { counter-increment:step; position:relative; padding:0 0 27px 60px; border-left:1px solid var(--line-strong); margin-left:16px; } .steps li::before { content:counter(step); position:absolute; left:-17px; top:0; width:32px; height:32px; display:grid; place-items:center; border-radius:50%; background:var(--teal); color:#fff; font:600 14px var(--display); } .steps li h4 { margin-bottom:7px; } .steps li p { font-size:14px; }
    .dont-list { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; max-width:940px; margin-top:20px; } .dont-list div { display:flex; flex-direction:column; gap:5px; background:#fff; border:1px solid var(--line); border-radius:12px; padding:16px; color:var(--ink-soft); font-size:13px; } .dont-list strong { color:var(--ink); } .guide-sources { max-width:940px; color:var(--muted); font-size:11px; line-height:1.8; border-top:1px solid var(--line); padding-top:20px; margin-top:40px; } .guide-sources a { color:var(--teal-dark); }
    footer { background:var(--ink); color:#dce7e6; padding:54px 44px; margin-top:20px; } footer p,footer div,footer a { color:#aebdc5!important; }
    #statusToast { display:none; position:fixed; z-index:100; right:24px; bottom:24px; max-width:360px; padding:13px 17px; border-radius:10px; color:#fff; background:var(--ink); border:1px solid rgba(169,227,214,.4); box-shadow:var(--shadow); font-size:13px; }
    @media(max-width:960px) { .container{padding:0 24px;} .nav-inner{padding:0 24px;} .nav-status,.nav-links .nav-pill-btn:not(.nav-pill-highlight){display:none;} .hero{grid-template-columns:1fr;padding-top:64px;gap:44px;} .hero-visual-card,.hero-visual-card img{min-height:430px;} .tool-section{padding:28px;} }
    @media(max-width:650px) { .container{padding:0 16px;} .nav-inner{padding:0 16px;min-height:65px;} .brand-logo img{width:142px;} .brand-tag{display:none;} .hero{padding:52px 0 70px;} .hero h1{font-size:clamp(2.7rem,14vw,4.2rem);} .hero-lead{font-size:1rem;} .hero-stats-row{gap:18px;margin-top:35px;} .stat-box{min-width:105px;} .hero-visual-card,.hero-visual-card img{min-height:340px;} .hero-card-overlay{padding:15px;left:12px;right:12px;bottom:12px;} .overlay-title{font-size:.95rem;} .tool-section{border-radius:20px;padding:22px 16px;margin-bottom:65px;} .input-tabs{overflow:auto;} .tab-btn{white-space:nowrap;font-size:12px;padding:12px 10px;} .dropzone{min-height:210px;} .params-grid,.cost-grid,.blur-preview,.document-form,.guide-grid,.dont-list{grid-template-columns:1fr;} .action-row .btn-primary,.action-row .btn-secondary{width:100%;} .teaser-header{flex-direction:column;gap:22px;} .teaser-header>div:last-child{min-width:0;text-align:left;} .violation-header,.unlocked-head,.attachment-card{flex-direction:column;} .violation-amount{white-space:normal;} .guide{padding:65px 0 70px;} footer{padding:40px 16px;} }
  </style>
</head>
<body>
  <nav>
    <div class="nav-inner">
      <a href="/" class="brand-logo" aria-label="zanisko.pl — strona główna">
        <img src="/images/logo-zanisko.png" alt="zanisko.pl">
        <span class="brand-tag">Audyt kosztorysu OC</span>
      </a>
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;">
        <div class="nav-status"><span class="pulse-dot"></span><span>Analiza oparta na regułach i źródłach prawnych</span></div>
        <div class="nav-links">
          <a href="#jak-to-dziala" class="nav-pill-btn">Jak to działa</a>
          <a href="/kontakt.html" class="nav-pill-btn nav-pill-highlight">Pomoc</a>
        </div>
      </div>
    </div>
  </nav>

  <main class="container">
    <section class="hero" aria-labelledby="hero-title">
      <div>
        <div class="hero-label">Niezależna analiza kosztorysu OC</div>
        <h1 id="hero-title">Sprawdź, <em>jak zaniżyli</em> Twój kosztorys.</h1>
        <p class="hero-lead">Wgraj kalkulację od ubezpieczyciela i zobacz, gdzie może brakować pieniędzy: w stawce robocizny, cenach części, rabatach albo zakresie naprawy.</p>
        <a href="#skaner" class="hero-guide-link">Przejdź do analizy kosztorysu</a>
        <div class="hero-stats-row" aria-label="Najważniejsze informacje">
          <div class="stat-box"><div class="stat-val">~60 s</div><div class="stat-desc">Do pierwszego wyniku po wgraniu dokumentu</div></div>
          <div class="stat-box"><div class="stat-val">PDF / foto</div><div class="stat-desc">Obsługiwane formaty kosztorysów</div></div>
          <div class="stat-box"><div class="stat-val">OC sprawcy</div><div class="stat-desc">Zakres pierwszej wersji narzędzia</div></div>
        </div>
      </div>
      <div class="hero-visual-card">
        <img src="/images/hero-claim-comparison.jpg" alt="Przykładowa dokumentacja szkody i analiza kosztorysu">
        <div class="hero-card-overlay">
          <div><div class="overlay-tag">Przykład dokumentacji szkody</div><div class="overlay-title">Kosztorys → różnice do sprawdzenia</div></div>
          <div class="diff-badge">raport w kilka chwil</div>
        </div>
      </div>
    </section>

    <section class="tool-section" id="skaner" aria-labelledby="scanner-title">
      <div class="section-header">
        <div class="section-kicker" style="color:#a9e3d6;">01 / Wgraj dokument</div>
        <h2 id="scanner-title">Zacznij od dokumentu, nie od domysłów.</h2>
        <p>Najpierw wybierz województwo, potem dodaj kosztorys. Wynik pokazuje różnice do sprawdzenia, a nie obiecuje z góry konkretnej dopłaty.</p>
      </div>

      <div class="input-tabs" role="tablist" aria-label="Sposób dodania kosztorysu">
        <button class="tab-btn active" id="tabPdfBtn" onclick="switchTab('pdf')" role="tab">Dokument PDF</button>
        <button class="tab-btn" id="tabOcrBtn" onclick="switchTab('ocr')" role="tab">Skan / zdjęcie</button>
        <button class="tab-btn" id="tabTextBtn" onclick="switchTab('text')" role="tab">Wklej tekst</button>
      </div>

      <div id="tabPdfContent">
        <div class="dropzone" id="pdfDropzone" tabindex="0" role="button" aria-label="Wybierz plik PDF z kosztorysem">
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
          <div class="dropzone-title">Dodaj kosztorys PDF</div>
          <div class="dropzone-sub">Przeciągnij plik tutaj lub kliknij, aby wybrać · maks. 15 MB</div>
          <input type="file" id="pdfFileInput" accept="application/pdf" style="display:none;">
        </div>
      </div>

      <div id="tabOcrContent" style="display:none;">
        <div class="dropzone" id="imageDropzone" tabindex="0" role="button" aria-label="Wybierz zdjęcie lub skan kosztorysu">
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <div class="dropzone-title">Dodaj zdjęcie lub skan kosztorysu</div>
          <div class="dropzone-sub">PNG, JPG lub JPEG · zadbaj o ostre zdjęcie całej strony</div>
          <input type="file" id="imageFileInput" accept="image/png,image/jpeg,image/jpg" style="display:none;">
        </div>
        <div style="margin-top:12px;text-align:center;"><button class="chip-btn" onclick="testOcrWithPreloadedImage()">Zobacz działanie na przykładowym zdjęciu</button></div>
      </div>

      <div id="tabTextContent" style="display:none;">
        <textarea id="rawTextarea" rows="8" placeholder="Wklej treść kosztorysu z systemu Audatex, Eurotax lub DAT..."></textarea>
      </div>

      <div class="params-grid">
        <div class="param-field">
          <label for="voivodeshipSelect">Województwo naprawy</label>
          <select id="voivodeshipSelect">
            <option value="mazowieckie" selected>Mazowieckie (175 zł/rbh)</option><option value="dolnoslaskie">Dolnośląskie (170 zł/rbh)</option><option value="slaskie">Śląskie (165 zł/rbh)</option><option value="malopolskie">Małopolskie (165 zł/rbh)</option><option value="wielkopolskie">Wielkopolskie (165 zł/rbh)</option><option value="pomorskie">Pomorskie (165 zł/rbh)</option><option value="lodzkie">Łódzkie (160 zł/rbh)</option><option value="zachodniopomorskie">Zachodniopomorskie (160 zł/rbh)</option><option value="kujawsko-pomorskie">Kujawsko-pomorskie (155 zł/rbh)</option><option value="lubelskie">Lubelskie (155 zł/rbh)</option><option value="podkarpackie">Podkarpackie (155 zł/rbh)</option><option value="swietokrzyskie">Świętokrzyskie (150 zł/rbh)</option><option value="podlaskie">Podlaskie (155 zł/rbh)</option><option value="lubuskie">Lubuskie (155 zł/rbh)</option><option value="warminsko-mazurskie">Warmińsko-mazurskie (150 zł/rbh)</option><option value="opolskie">Opolskie (155 zł/rbh)</option>
          </select>
        </div>
        <div class="param-field">
          <label for="segmentSelect">Klasa pojazdu <span style="font-weight:400;text-transform:none;letter-spacing:0;">(opcjonalnie)</span></label>
          <select id="segmentSelect"><option value="AUTO" selected>Rozpoznaj automatycznie</option><option value="POPULAR">Segment popularny</option><option value="PREMIUM">Segment Premium</option><option value="LUXURY">Segment luksusowy</option></select>
        </div>
      </div>

      <div class="action-row">
        <button class="btn-primary" id="startAuditBtn" onclick="runCurrentAudit()">Uruchom analizę kosztorysu</button>
        <button class="btn-secondary" id="loadSampleBtn" onclick="loadSampleTextAndAudit()">Uruchom przykład</button>
        <a class="btn-secondary" id="downloadPdfBtn" href="/przykladowy_kosztorys_pzu.pdf" download="przykladowy_kosztorys_pzu.pdf" target="_blank">Pobierz przykładowy PDF</a>
      </div>
      <div class="progress-bar-container" id="progressBar"><div class="progress-modal-card"><h3 class="progress-title">Analizujemy kosztorys</h3><div class="progress-track"><div class="progress-fill" id="progressFill"></div></div><div class="progress-label"><span id="progressText">Rozpoznawanie tekstu i weryfikacja reguł...</span><span id="progressPercent">0%</span></div></div></div>
    </section>

    <section style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:100px;">
      <figure style="margin:0;border-radius:18px;overflow:hidden;background:#dbe5e2;min-height:220px;"><img src="/images/desk-audit-comparison.jpg" alt="Pracownik analizuje kosztorys przy samochodzie" style="width:100%;height:100%;min-height:220px;object-fit:cover;display:block;"></figure>
      <figure style="margin:0;border-radius:18px;overflow:hidden;background:#dbe5e2;min-height:220px;"><img src="/images/mechanic-understated-explanation.jpg" alt="Wyjaśnienie różnic w kosztorysie" style="width:100%;height:100%;min-height:220px;object-fit:cover;display:block;"></figure>
      <figure style="margin:0;border-radius:18px;overflow:hidden;background:#dbe5e2;min-height:220px;"><img src="/images/tech-hud-repair.jpg" alt="Techniczna dokumentacja naprawy samochodu" style="width:100%;height:100%;min-height:220px;object-fit:cover;display:block;"></figure>
    </section>

    <div id="auditResultsArea">
      <div id="teaserView" class="teaser-card">
        <div class="teaser-header">
          <div>
            <div class="teaser-badge">Wstępna analiza gotowa</div>
            <h2 id="teaserVehicleTitle">Pojazd: oczekiwanie na dokument</h2>
            <div id="teaserClaimMeta">Po wgraniu dokumentu zobaczysz źródło i zakres analizy.</div>
            <div class="discrepancy-scale"><span>Różnice do sprawdzenia</span><div class="scale-bar"><div class="scale-fill"></div></div><span id="teaserViolationsCount">—</span></div>
          </div>
          <div><div>ORIENTACYJNY ZAKRES RÓŻNIC</div><div id="teaserEstimatedRange">—</div><div style="font-size:12px;color:var(--muted);margin-top:7px;">wynik zależy od jakości odczytu i zakresu danych</div></div>
        </div>
        <div class="locked-section-container">
          <div class="blur-preview"><div class="cost-card"><div class="cost-label">Kwota z kosztorysu</div><div class="cost-amount">—</div><div class="cost-sub">Odczytana z dokumentu</div></div><div class="cost-card highlight"><div class="cost-label">Różnica do sprawdzenia</div><div class="cost-amount emerald">—</div><div class="cost-sub">Suma wykrytych odchyleń</div></div><div class="cost-card"><div class="cost-label">Kwota po korekcie</div><div class="cost-amount">—</div><div class="cost-sub">Wartość orientacyjna</div></div></div>
          <div class="paywall-overlay" id="paywallBox"><h3>Pełny raport i pismo reklamacyjne</h3><p>W wersji beta odblokowujesz szczegóły bez opłaty. Sprawdzisz każdą pozycję, podstawę oraz przygotujesz dokument do wysłania.</p><button class="btn-primary" onclick="unlockFullReport()" aria-label="Odblokuj pełny audyt">Pokaż szczegóły audytu</button></div>
        </div>
      </div>

      <div id="unlockedView" style="display:none;">
        <div class="unlocked-head"><div><div class="section-kicker">02 / Wynik analizy</div><h2>Co obniżyło kosztorys</h2><p>Każda pozycja ma opis, kwotę wynikającą z reguły i podstawę do dalszego sprawdzenia.</p></div><button class="btn-secondary" onclick="document.getElementById('skaner').scrollIntoView({behavior:'smooth'})">Wgraj inny dokument</button></div>
        <div class="cost-grid"><div class="cost-card"><div class="cost-label">Kwota z kosztorysu</div><div class="cost-amount" id="unlockedUndisputedGross">0,00 zł</div><div class="cost-sub" id="unlockedUndisputedNet">Netto: 0,00 zł</div></div><div class="cost-card highlight"><div class="cost-label">Różnica do sprawdzenia</div><div class="cost-amount emerald" id="unlockedTotalLossGross">+0,00 zł</div><div class="cost-sub" id="unlockedTotalLossNet">Netto: 0,00 zł</div></div><div class="cost-card"><div class="cost-label">Kwota po korekcie</div><div class="cost-amount" id="unlockedFairGross">0,00 zł</div><div class="cost-sub" id="unlockedFairNet">Netto: 0,00 zł</div></div></div>
        <div id="violationsList" style="margin-top:24px;"></div>
        <div class="document-panel">
          <h3>Przygotuj pismo reklamacyjne</h3><p>Wpisz swoje dane, aby wygenerować dokument do sprawdzenia i podpisania.</p>
          <div class="document-form"><label for="claimantName">Imię i nazwisko<input type="text" id="claimantName" placeholder="np. Anna Kowalska"></label><label for="claimantAddress">Adres do korespondencji<input type="text" id="claimantAddress" placeholder="np. ul. ..., 00-000 Warszawa"></label><label for="claimantIban">Numer rachunku<input type="text" id="claimantIban" placeholder="opcjonalnie"></label></div>
          <div class="letter-sheet" id="letterPreview">Uzupełnij dane i kliknij „Przygotuj pismo”.</div>
          <div class="document-actions"><button class="btn-primary" id="generateLetterBtn" type="button" onclick="generateAndDisplayLetter()">Przygotuj pismo</button><button class="btn-primary" onclick="downloadLetter('docx')">Pobierz Word</button><button class="btn-primary" onclick="downloadLetter('pdf')">Pobierz PDF</button></div>
        </div>
        <div class="attachments-section" id="attachmentsSection"><h3>Załączniki do pisma</h3><p>Dokumentacja audytu i podstawa wyliczeń w jednym pakiecie.</p><div class="attachment-card"><div><h4>1. Tabela różnic audytu</h4><p>Lista pozycji i sposobu wyliczenia</p></div><div class="attachments-actions"><button class="att-btn" onclick="downloadAttachment('attachment1','docx')">Word</button><button class="att-btn" onclick="downloadAttachment('attachment1','pdf')">PDF</button></div></div><div class="attachment-card"><div><h4>2. Stawki referencyjne</h4><p>Opis źródła i przyjętych założeń</p></div><div class="attachments-actions"><button class="att-btn" onclick="downloadAttachment('attachment2','docx')">Word</button><button class="att-btn" onclick="downloadAttachment('attachment2','pdf')">PDF</button></div></div><div class="attachment-card"><div><h4>3. Podstawa prawna</h4><p>Wskazanie przepisów i orzeczeń</p></div><div class="attachments-actions"><button class="att-btn" onclick="downloadAttachment('attachment3','docx')">Word</button><button class="att-btn" onclick="downloadAttachment('attachment3','pdf')">PDF</button></div></div><div class="attachments-actions" style="margin-top:18px;"><button class="btn-primary" onclick="downloadBundle('docx')">Pobierz cały pakiet Word</button><button class="btn-secondary" onclick="downloadBundle('pdf')">Pobierz cały pakiet PDF</button></div></div>
      </div>
    </div>

    <section class="guide" id="jak-to-dziala">
      <div class="section-header"><div class="section-kicker">03 / Zrozum wynik</div><h2>Jak zaniżono Twój kosztorys?</h2><p class="guide-lead">Zaniżenie kosztorysu rzadko wynika z jednej pozycji. Najczęściej składa się na nie kilka decyzji naraz: stawka pracy, ceny części, potrącenia, rabaty i zakres technologii naprawy.</p></div>
      <h3 class="guide-h">Cztery miejsca, w których warto szukać różnic</h3>
      <div class="guide-grid">
        <div class="guide-card"><div class="num">01 / Robocizna</div><h4>Zaniżona stawka za godzinę</h4><p>Porównujemy stawkę z kosztorysu z wartością przyjętą dla wybranego regionu.</p><p class="law">Wynik jest punktem do sprawdzenia, nie automatycznym rozstrzygnięciem.</p></div>
        <div class="guide-card"><div class="num">02 / Części</div><h4>Potrącenia i zamienniki</h4><p>Wskazujemy amortyzację, rabaty i kody jakości części, które wpływają na cenę naprawy.</p><p class="law">Podstawę prawną pokazujemy obok konkretnej pozycji.</p></div>
        <div class="guide-card"><div class="num">03 / Technologia</div><h4>Zakres naprawy</h4><p>Jeśli w danych brakuje pozycji lub czynności, raport sygnalizuje brak do weryfikacji.</p><p class="law">Zdjęcia i faktury pozostają ważnym dowodem po Twojej stronie.</p></div>
        <div class="guide-card"><div class="num">04 / Materiały</div><h4>Rabat na lakierowanie</h4><p>Sprawdzamy, czy w kalkulacji nie odjęto kwoty, której nie da się uzasadnić w Twoim warsztacie.</p><p class="law">Zachowaj kosztorys, decyzję i potwierdzenie wysłania reklamacji.</p></div>
      </div>
      <h3 class="guide-h">Dalsza droga po analizie</h3>
      <details class="scenario" open><summary><span class="tag">A</span> Mam kosztorys, ale nie naprawiłem auta</summary><div class="scenario-body"><p>To najczęstszy przypadek dla tego narzędzia. Najpierw sprawdź różnice, potem wyślij reklamację z konkretną tabelą i zachowaj dowód wysłania.</p><ul><li>Nie podpisuj ugody, jeśli nie rozumiesz jej skutków.</li><li>Zachowaj kosztorys, zdjęcia szkody i decyzję ubezpieczyciela.</li><li>Przy bardziej złożonej sprawie skonsultuj dokumenty z rzeczoznawcą lub prawnikiem.</li></ul></div></details>
      <details class="scenario"><summary><span class="tag">B</span> Auto zostało naprawione albo sprzedane</summary><div class="scenario-body"><p>Po naprawie lub sprzedaży sposób liczenia szkody może być inny. Wtedy do oceny przydadzą się faktury, umowa sprzedaży i dokumentacja zdjęciowa.</p></div></details>
      <details class="scenario"><summary><span class="tag">C</span> Ubezpieczyciel uznał szkodę całkowitą</summary><div class="scenario-body"><p>Ta wersja narzędzia skupia się na kosztorysach napraw częściowych. Przy szkodzie całkowitej potrzebne są inne dane: wartość auta przed szkodą i wartość wraku.</p></div></details>
      <div class="guide-example"><strong>Ważne:</strong> wynik ma charakter informacyjny. Nie zastępuje opinii rzeczoznawcy ani porady prawnej, a dokument warto przeczytać przed wysłaniem.</div>
      <div class="guide-sources">Źródła i zakres reguł: <a href="https://www.sn.pl/sites/orzecznictwo/orzeczenia1/iii%20czp%2080-11.pdf" target="_blank" rel="noopener">SN III CZP 80/11</a>, <a href="https://www.knf.gov.pl/" target="_blank" rel="noopener">Rekomendacje KNF</a> oraz materiały <a href="https://rf.gov.pl/" target="_blank" rel="noopener">Rzecznika Finansowego</a>.</div>
    </section>
  </main>

  <footer>
    <div style="max-width:1320px;margin:0 auto;display:flex;justify-content:space-between;gap:28px;flex-wrap:wrap;">
      <div style="max-width:560px;">
        <strong style="color:#fff;font:600 1.1rem var(--display);">zanisko.pl</strong>
        <p style="margin-top:8px;">Niezależna analiza kosztorysów naprawy z OC sprawcy. Narzędzie pomaga nazwać różnice i przygotować dokumenty do dalszego sprawdzenia.</p>
      </div>
      <div style="font-size:13px;line-height:2;">
        <a href="/regulamin.html">Regulamin</a><br>
        <a href="/polityka-prywatnosci.html">Prywatność</a><br>
        <a href="/kontakt.html">Kontakt i reklamacje</a>
      </div>
    </div>
    <div style="max-width:1320px;margin:28px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;font-size:12px;">
      <div>© 2026 <a href="https://multinewsroom.pl/" target="_blank" rel="noopener" style="color:#fff!important;text-decoration:underline;">Multinewsroom</a> · Wszelkie prawa zastrzeżone</div>
      <div style="font-size:11px;">zanisko.pl</div>
    </div>
  </footer>
  <div id="statusToast"></div>
  <div class="busy-overlay" id="busyOverlay" role="status" aria-live="polite" aria-hidden="true"><div class="busy-card" id="busyCard"></div></div>
  <!-- SKRYPT KLIENTA -->

  <script>
    let currentAuditReport = null;
    let currentAuditRawText = '';
    let activeInputMode = 'pdf';

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
      activeInputMode = tab;
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

    let pendingFile = null;
    let pendingKind = null;

    function setPendingFile(file, kind) {
      pendingFile = file;
      pendingKind = kind;
      const target = kind === 'pdf' ? document.getElementById('pdfDropzone') : document.getElementById('imageDropzone');
      const title = target.querySelector('.dropzone-title');
      const sub = target.querySelector('.dropzone-sub');
      title.textContent = 'Wybrano: ' + file.name;
      sub.textContent = 'Dokument jest gotowy. Ustaw region i kliknij „Uruchom analizę kosztorysu”.';
      target.classList.add('has-file');
      showToast('Dokument gotowy do analizy. Sprawdź region i uruchom analizę.');
    }

    // Wybór pliku tylko przygotowuje go do analizy. Użytkownik świadomie uruchamia audyt po ustawieniu regionu.
    function handlePdfFile(file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) { alert('Proszę wybrać plik PDF.'); return; }
      setPendingFile(file, 'pdf');
    }

    function handleImageFile(file) {
      if (!/^image\\/(png|jpeg|jpg)$/.test(file.type)) { alert('Wybierz plik PNG lub JPG.'); return; }
      setPendingFile(file, 'ocr');
    }

    async function auditPdfFile(file) {
      showProgress('Wczytywanie i parsowanie kalkulacji PDF...', 40);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          showProgress('Silnik audytowy analizuje pozycje kosztorysu...', 75);
          const res = await fetch('/api/upload-pdf', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pdfBase64:base64, voivodeship:document.getElementById('voivodeshipSelect').value }) });
          const data = await res.json();
          hideProgress();
          if (data.error) { alert('Błąd odczytu PDF: ' + data.error); return; }
          currentAuditReport = data.auditReport; currentAuditRawText = data.extractedText; renderAuditResults(data.auditReport); showToast('Analiza PDF zakończona.');
        } catch (err) { hideProgress(); alert('Błąd podczas komunikacji z serwerem: ' + err.message); }
      };
      reader.readAsDataURL(file);
    }

    async function auditImageFile(file) {
      showProgress('Silnik OCR analizuje zdjęcie kosztorysu...', 35);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        try {
          showProgress('Rozpoznawanie stawek, części i potrąceń...', 70);
          const res = await fetch('/api/upload-image', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ imageBase64:base64, voivodeship:document.getElementById('voivodeshipSelect').value }) });
          const data = await res.json();
          hideProgress();
          if (data.error) { alert('Błąd przetwarzania obrazu: ' + data.error); return; }
          currentAuditReport = data.auditReport; currentAuditRawText = data.extractedText; renderAuditResults(data.auditReport); showToast('Analiza zdjęcia zakończona.');
        } catch (err) { hideProgress(); alert('Błąd OCR: ' + err.message); }
      };
      reader.readAsDataURL(file);
    }
\n    // Test OCR na gotowym zdjęciu
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
      const region = document.getElementById('voivodeshipSelect').value;
      if (activeInputMode === 'pdf' && pendingFile && pendingKind === 'pdf') { await auditPdfFile(pendingFile); return; }
      if (activeInputMode === 'ocr' && pendingFile && pendingKind === 'ocr') { await auditImageFile(pendingFile); return; }
      const rawText = document.getElementById('rawTextarea').value;
      if (!rawText.trim()) { alert('Dodaj plik PDF, zdjęcie albo wklej treść kosztorysu.'); return; }
      showProgress('Audytowanie kalkulacji według wybranego regionu...', 50);
      try {
        const res = await fetch('/api/audit', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ rawText, voivodeship:region }) });
        const report = await res.json();
        hideProgress(); currentAuditReport = report; currentAuditRawText = rawText; renderAuditResults(report); showToast('Analiza tekstu zakończona.');
      } catch (err) { hideProgress(); alert('Błąd audytu: ' + err.message); }
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

    function render3DCarWheelHtml(title, subtitle) {
      return '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 48px 20px; text-align: center; gap: 14px;">' +
        '<div class="wheel-3d-wrapper" style="margin-bottom: 8px;">' +
          '<div class="wheel-3d-stage" style="width: 100px; height: 100px;">' +
            '<svg class="spinning-wheel-svg" viewBox="0 0 120 120" width="100" height="100">' +
              '<defs>' +
                '<radialGradient id="pwTireGrad" cx="50%" cy="50%" r="50%">' +
                  '<stop offset="60%" stop-color="#14171d"/>' +
                  '<stop offset="90%" stop-color="#232730"/>' +
                  '<stop offset="100%" stop-color="#0f1115"/>' +
                '</radialGradient>' +
                '<linearGradient id="pwRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                  '<stop offset="0%" stop-color="#94a3b8"/>' +
                  '<stop offset="25%" stop-color="#f8fafc"/>' +
                  '<stop offset="50%" stop-color="#475569"/>' +
                  '<stop offset="75%" stop-color="#cbd5e1"/>' +
                  '<stop offset="100%" stop-color="#1e293b"/>' +
                '</linearGradient>' +
                '<linearGradient id="pwSpokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                  '<stop offset="0%" stop-color="#e2e8f0"/>' +
                  '<stop offset="50%" stop-color="#64748b"/>' +
                  '<stop offset="100%" stop-color="#38bdf8"/>' +
                '</linearGradient>' +
                '<radialGradient id="pwDiscGrad" cx="50%" cy="50%" r="50%">' +
                  '<stop offset="40%" stop-color="#475569"/>' +
                  '<stop offset="75%" stop-color="#334155"/>' +
                  '<stop offset="100%" stop-color="#1e293b"/>' +
                '</radialGradient>' +
                '<radialGradient id="pwHubGrad" cx="50%" cy="50%" r="50%">' +
                  '<stop offset="0%" stop-color="#0284c7"/>' +
                  '<stop offset="100%" stop-color="#0f1115"/>' +
                '</radialGradient>' +
              '</defs>' +
              '<circle cx="60" cy="60" r="56" fill="url(#pwTireGrad)" stroke="#0b0d11" stroke-width="3"/>' +
              '<circle cx="60" cy="60" r="54" fill="none" stroke="#2c323f" stroke-width="2.5" stroke-dasharray="3, 5.5"/>' +
              '<circle cx="60" cy="60" r="49" fill="none" stroke="#181c24" stroke-width="1.5"/>' +
              '<circle cx="60" cy="60" r="38" fill="url(#pwDiscGrad)" stroke="#64748b" stroke-width="1"/>' +
              '<circle cx="60" cy="60" r="32" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="2, 4"/>' +
              '<circle cx="60" cy="60" r="26" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-dasharray="2.5, 5"/>' +
              '<circle cx="60" cy="60" r="41" fill="none" stroke="url(#pwRimGrad)" stroke-width="2.5"/>' +
              '<g>' +
                '<path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#pwSpokeGrad)"/>' +
                '<line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>' +
                '<g transform="rotate(72 60 60)">' +
                  '<path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#pwSpokeGrad)"/>' +
                  '<line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>' +
                '</g>' +
                '<g transform="rotate(144 60 60)">' +
                  '<path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#pwSpokeGrad)"/>' +
                  '<line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>' +
                '</g>' +
                '<g transform="rotate(216 60 60)">' +
                  '<path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#pwSpokeGrad)"/>' +
                  '<line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>' +
                '</g>' +
                '<g transform="rotate(288 60 60)">' +
                  '<path d="M 57 23 L 63 23 L 61.5 50 L 58.5 50 Z" fill="url(#pwSpokeGrad)"/>' +
                  '<line x1="60" y1="23" x2="60" y2="48" stroke="#0f172a" stroke-width="1"/>' +
                '</g>' +
              '</g>' +
              '<circle cx="60" cy="60" r="14" fill="url(#pwRimGrad)" stroke="#38bdf8" stroke-width="1"/>' +
              '<circle cx="60" cy="60" r="9" fill="url(#pwHubGrad)" stroke="#0284c7" stroke-width="1"/>' +
              '<circle cx="60" cy="49" r="1.5" fill="#f8fafc"/>' +
              '<circle cx="70.5" cy="56.5" r="1.5" fill="#f8fafc"/>' +
              '<circle cx="66.5" cy="68.5" r="1.5" fill="#f8fafc"/>' +
              '<circle cx="53.5" cy="68.5" r="1.5" fill="#f8fafc"/>' +
              '<circle cx="49.5" cy="56.5" r="1.5" fill="#f8fafc"/>' +
              '<text x="60" y="63" text-anchor="middle" font-size="8" font-weight="900" fill="#fff" font-family="Space Grotesk, sans-serif">Z</text>' +
            '</svg>' +
            '<svg class="static-caliper-svg" viewBox="0 0 120 120" width="100" height="100">' +
              '<defs>' +
                '<linearGradient id="pwCaliperGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                  '<stop offset="0%" stop-color="#ef4444"/>' +
                  '<stop offset="60%" stop-color="#dc2626"/>' +
                  '<stop offset="100%" stop-color="#991b1b"/>' +
                '</linearGradient>' +
              '</defs>' +
              '<path d="M 28 42 C 26 49 26 58 28 66 L 37 63 C 35 57 35 51 37 45 Z" fill="url(#pwCaliperGrad)" stroke="#f87171" stroke-width="1.2"/>' +
              '<circle cx="32" cy="48" r="1.5" fill="#fff" opacity="0.8"/>' +
              '<circle cx="32" cy="60" r="1.5" fill="#fff" opacity="0.8"/>' +
            '</svg>' +
          '</div>' +
          '<div class="wheel-3d-shadow" style="width: 85px; height: 12px;"></div>' +
        '</div>' +
        '<div style="font-size: 16px; font-weight: 700; color: var(--teal-dark);">' + title + '</div>' +
        '<div style="font-size: 13px; color: var(--muted); max-width: 480px;">' + (subtitle || '') + '</div>' +
      '</div>';
    }

    // Nakładka z kołem widoczna niezależnie od przewinięcia strony (generowanie i pobieranie dokumentów)
    function showBusy(title) {
      const overlay = document.getElementById('busyOverlay');
      document.getElementById('busyCard').innerHTML = render3DCarWheelHtml(title, 'To potrwa kilka sekund.');
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
    }

    function hideBusy() {
      const overlay = document.getElementById('busyOverlay');
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.getElementById('busyCard').innerHTML = '';
    }

    let letterGenerationInFlight = false;

    // Generowanie pisma: od razu w wersji dopracowanej (serwer wraca do szablonu, gdyby dopracowanie się nie powiodło)
    async function generateAndDisplayLetter() {
      if (!currentAuditReport || letterGenerationInFlight) return;

      const claimantName = document.getElementById('claimantName')?.value.trim() || '';
      const claimantAddress = document.getElementById('claimantAddress')?.value.trim() || '';
      const bankAccountNumber = document.getElementById('claimantIban')?.value.trim() || '';
      const previewEl = document.getElementById('letterPreview');
      if (!claimantName || !claimantAddress) {
        previewEl.textContent = 'Uzupełnij imię i nazwisko oraz adres, a potem kliknij „Przygotuj pismo”.';
        return;
      }

      const generateBtn = document.getElementById('generateLetterBtn');
      letterGenerationInFlight = true;
      if (generateBtn) generateBtn.disabled = true;

      // Animowane obracające się koło samochodowe 3D wewnątrz podglądu pisma
      previewEl.innerHTML = render3DCarWheelHtml(
        'Przygotowujemy i dopracowujemy pismo...',
        'Sprawdzamy orzecznictwo Sądu Najwyższego (uchwała III CZP 80/11), stawki rynkowe i wytyczne KNF. To może potrwać do pół minuty.'
      );

      try {
        const res = await fetch('/api/generate-letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report: currentAuditReport,
            options: { claimantName, claimantAddress, bankAccountNumber },
            useAi: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.letter) {
          throw new Error(data.error || 'serwer nie zwrócił pisma (kod ' + res.status + ')');
        }
        currentLetterText = data.letter;
        previewEl.textContent = data.letter;
        showToast('Pismo jest gotowe.');
      } catch (err) {
        previewEl.textContent = 'Nie udało się przygotować pisma: ' + err.message + '. Spróbuj ponownie za chwilę.';
      } finally {
        letterGenerationInFlight = false;
        if (generateBtn) generateBtn.disabled = false;
      }
    }

    // Pobieranie wezwania w wybranym formacie (DOCX, PDF, RTF, TXT)
    async function downloadLetter(format) {
      if (!currentAuditReport) return;
      showBusy('Przygotowywanie wezwania (' + format.toUpperCase() + ')...');
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
        hideBusy();
        alert('Błąd pobierania wezwania: ' + err.message);
      }
    }

    // Pobieranie załącznika (attachment1, attachment2, attachment3) w wybranym formacie
    async function downloadAttachment(attachmentId, format) {
      if (!currentAuditReport) return;
      showBusy('Przygotowywanie załącznika ' + format.toUpperCase() + '...');
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
        hideBusy();
        alert('Błąd pobierania załącznika: ' + err.message);
      }
    }

    // Pobieranie kompletnego pakietu procesowego (Wezwanie + Załączniki w jednym pliku)
    async function downloadBundle(format) {
      if (!currentAuditReport) return;
      showBusy('Generowanie kompletnego pakietu (' + format.toUpperCase() + ')...');
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
        hideBusy();

        const ext = (format === 'docx' || format === 'doc') ? '.docx' : (format === 'pdf' ? '.pdf' : (format === 'rtf' ? '.rtf' : '.txt'));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Pobrano kompletny pakiet procesowy (' + format.toUpperCase() + ').');
      } catch (err) {
        hideBusy();
        alert('Błąd generowania pakietu: ' + err.message);
      }
    }

    // Uniwersalna funkcja pobierania pliku
    async function exportDocument(params) {
      showBusy('Przygotowywanie pliku ' + params.format.toUpperCase() + '...');
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
        hideBusy();

        const ext = (params.format === 'docx' || params.format === 'doc') ? '.docx' : params.format === 'pdf' ? '.pdf' : params.format === 'rtf' ? '.rtf' : '.txt';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = params.filename + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Pobrano dokument ' + params.format.toUpperCase() + '.');
      } catch (err) {
        hideBusy();
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

function resolveAssetFile(relativePath: string): string | null {
  const metaDir = path.dirname(new URL(import.meta.url).pathname);
  const candidates = [
    path.resolve(relativePath),
    path.join(process.cwd(), relativePath),
    path.resolve(metaDir, '..', relativePath),
    path.resolve(metaDir, '../..', relativePath),
    path.resolve(metaDir, relativePath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

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
      const pageFile = resolveAssetFile(LEGAL_PAGES[url.pathname]);
      if (pageFile) {
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
      const pdfPath = resolveAssetFile('public/przykladowy_kosztorys_pzu.pdf');
      if (pdfPath) {
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
      const assetPath = resolveAssetFile(asset.file);
      if (assetPath) {
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
      const imagePath = resolveAssetFile(path.join('public/images', imageName));
      if (imagePath) {
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
          const message = err instanceof Error ? err.message : 'Błąd porównania zdjęć z kosztorysem';
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
          const message = err instanceof Error ? err.message : 'Błąd dopracowania pisma';
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
            case 'doc':
              if (payload.attachment) {
                buffer = exportAttachmentToDocx(payload.attachment);
              } else {
                buffer = exportDemandLetterToDocx(text, title);
              }
              contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              ext = '.docx';
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
            ext = '.docx';
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

