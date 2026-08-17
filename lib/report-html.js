import fs from 'fs';
import path from 'path';

const BRAND_ASSET_DIR = path.resolve(process.cwd(), 'assets', 'brand');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)(?<!\s)\*/g, '$1<em>$2</em>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function parseTable(lines, start) {
  const tableLines = [];
  let i = start;
  while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
    if (!isTableDivider(lines[i])) tableLines.push(lines[i]);
    i++;
  }
  const rows = tableLines.map(line =>
    line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => inlineMarkdown(cell.trim()))
  );
  return { rows, next: i };
}

function tableHtml(headers, rows) {
  const head = `<thead><tr>${headers.map(cell => `<th>${cell}</th>`).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="table-wrap"><table>${head}${body}</table></div>`;
}

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function isSnapshotScorecard(headers = [], rows = []) {
  const normalized = headers.map(stripHtml).map(cell => cell.toLowerCase());
  return rows.length >= 5 &&
    normalized[0] === 'signal' &&
    normalized[1] === 'directional read' &&
    normalized[2] === 'what it means' &&
    normalized[3] === 'evidence from your answers';
}

function directionalLevel(value = '', signal = '') {
  const text = `${stripHtml(value)} ${stripHtml(signal)}`.toLowerCase();
  if (/high friction|cleanup first|human review needed/.test(text)) return 'high';
  if (/medium friction|needs confirmation|check|review/.test(text)) return 'medium';
  if (/good ai fit|ready to test|launch-ready|ready/.test(text)) return 'strong';
  return 'medium';
}

function levelLabel(level) {
  if (level === 'high') return 'Needs attention';
  if (level === 'strong') return 'Promising';
  return 'Confirm';
}

function scorecardVisualHtml(headers, rows) {
  const cards = rows.slice(0, 5).map(row => {
    const signal = row[0] || '';
    const read = row[1] || '';
    const meaning = row[2] || '';
    const level = directionalLevel(read, signal);
    return `<article class="scorecard-card scorecard-card-${level}">
      <div class="scorecard-card-top">
        <strong>${signal}</strong>
        <span>${read}</span>
      </div>
      <p>${meaning}</p>
    </article>`;
  }).join('');

  const barRows = rows
    .filter(row => /AI Fit|Information Readiness|Human Review Boundary/i.test(stripHtml(row[0])))
    .slice(0, 3)
    .map(row => {
      const signal = row[0] || '';
      const read = row[1] || '';
      const level = directionalLevel(read, signal);
      return `<div class="readiness-row readiness-${level}">
        <div class="readiness-label">${signal}</div>
        <div class="readiness-track"><span></span></div>
        <div class="readiness-value">${levelLabel(level)}</div>
      </div>`;
    }).join('');

  const body = tableHtml(headers, rows);
  return `<section class="visual-scorecard" aria-label="Snapshot Scorecard visual summary">
    <div class="visual-scorecard-head">
      <div>
        <div class="visual-kicker">Directional Snapshot Scorecard</div>
        <h3>Five signals from your answers</h3>
      </div>
      <span>Not a numeric score</span>
    </div>
    <div class="scorecard-grid">${cards}</div>
    <div class="readiness-panel">
      <strong>Readiness signals</strong>
      <p>These bars show direction only. The deeper interview confirms the real sequence.</p>
      ${barRows}
    </div>
    <details class="scorecard-evidence">
      <summary>Show evidence table</summary>
      ${body}
    </details>
  </section>`;
}

function markdownToHtml(markdown, options = {}) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let inList = false;
  let inCode = false;
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!inList) return;
    html.push('</ul>');
    inList = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\t/g, '  ');
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      flushParagraph();
      closeList();
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      html.push(`<pre>${escapeHtml(line)}</pre>`);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      flushParagraph();
      closeList();
      const parsed = parseTable(lines, i);
      const [headers, ...rows] = parsed.rows;
      if (options.reportTier === 'free' && isSnapshotScorecard(headers || [], rows)) {
        html.push(scorecardVisualHtml(headers || [], rows));
      } else {
        html.push(tableHtml(headers || [], rows));
      }
      i = parsed.next - 1;
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      closeList();
      html.push('<hr>');
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph();
      closeList();
      html.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      closeList();
      html.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      flushParagraph();
      closeList();
      html.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s*/, ''))}</blockquote>`);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}

function imageDataUri(filename) {
  try {
    const assetPath = path.join(BRAND_ASSET_DIR, filename);
    const data = fs.readFileSync(assetPath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return '';
  }
}

export function createReportHtml(markdown, options = {}) {
  const title = options.title || 'Bridge To AI Report';
  const businessName = options.businessName || 'Client Business';
  const tierLabel = options.tierLabel || 'AI Opportunity Report';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const intakeVersion = options.intakeVersion || 'version not recorded';
  const lockMark = imageDataUri('sil-lock-mark.png');
  const trustSeal = imageDataUri('sil-trust-seal.png');
  const body = markdownToHtml(markdown, options);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bridge: #0d6e5e;
      --bridge-dark: #075648;
      --bridge-deep: #043c33;
      --mint: #dff7ef;
      --gold: #d4a62a;
      --gold-bright: #f3c74d;
      --ink: #111827;
      --muted: #5f6773;
      --line: #d9ddd8;
      --paper: #fafaf8;
      --panel: #ffffff;
      --soft: #e8f4f1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Aptos, Arial, sans-serif;
      background: var(--paper);
      color: var(--ink);
      line-height: 1.58;
    }
    .report-shell {
      width: min(1120px, calc(100% - 36px));
      margin: 28px auto;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 20px 55px rgba(15, 23, 42, 0.08);
    }
    .cover {
      position: relative;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(255,255,255,0.12) 0 12%, transparent 12% 24%, rgba(255,255,255,0.08) 24% 36%, transparent 36%),
        linear-gradient(135deg, var(--bridge-deep) 0%, var(--bridge) 56%, #1e9a83 100%);
      color: white;
      padding: 38px 42px 36px;
      border-bottom: 7px solid var(--gold-bright);
    }
    .cover::after {
      content: "";
      position: absolute;
      inset: auto -70px -120px auto;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      background: rgba(243, 199, 77, 0.22);
      pointer-events: none;
    }
    .cover-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 112px;
      gap: 24px;
      align-items: start;
    }
    .brand-row {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .brand-mark {
      width: 48px;
      height: 48px;
      object-fit: contain;
      filter: drop-shadow(0 8px 18px rgba(0,0,0,0.22));
    }
    .brand {
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 800;
      color: #f7fff9;
      opacity: 0.98;
    }
    .cover-seal {
      width: 112px;
      height: 112px;
      object-fit: contain;
      align-self: start;
      filter: drop-shadow(0 12px 22px rgba(0,0,0,0.24));
    }
    .cover h1 {
      position: relative;
      z-index: 1;
      margin: 14px 0 8px;
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 1.05;
      letter-spacing: 0;
      color: #ffffff;
      max-width: 840px;
      text-shadow: 0 2px 18px rgba(0,0,0,0.22);
    }
    .cover-meta {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 0.92rem;
      color: #ffffff;
      opacity: 1;
    }
    .cover-meta span {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 5px 11px;
      border: 1px solid rgba(255,255,255,0.26);
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      color: #ffffff;
      font-weight: 700;
    }
    .trust-strip {
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      margin: 0 0 24px;
      padding: 12px 14px;
      border: 1px solid #cfe1dc;
      border-radius: 8px;
      background: linear-gradient(135deg, #f7fff9, #fff8df);
      color: var(--bridge-dark);
      font-size: 0.88rem;
      line-height: 1.42;
    }
    .trust-strip img {
      width: 48px;
      height: 48px;
      object-fit: contain;
    }
    .trust-strip strong {
      display: block;
      color: var(--ink);
      margin-bottom: 2px;
    }
    .content {
      padding: 34px 42px 44px;
    }
    h1, h2, h3 {
      color: var(--bridge-dark);
      line-height: 1.18;
      letter-spacing: 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .content > h1:first-child { display: none; }
    h2 {
      margin: 34px 0 12px;
      padding-top: 18px;
      border-top: 1px solid var(--line);
      font-size: 1.45rem;
    }
    h3 {
      margin: 24px 0 8px;
      font-size: 1.08rem;
      color: var(--ink);
    }
    p { margin: 0 0 13px; }
    a { color: var(--bridge); font-weight: 700; }
    blockquote {
      margin: 18px 0;
      padding: 14px 18px;
      border-left: 5px solid var(--gold);
      background: #fff8e2;
      color: #473a16;
    }
    hr {
      border: 0;
      border-top: 1px solid var(--line);
      margin: 26px 0;
    }
    ul {
      margin: 10px 0 16px 22px;
      padding: 0;
    }
    li { margin-bottom: 7px; }
    .visual-scorecard {
      margin: 18px 0 26px;
      padding: 18px;
      border: 1px solid #bedbd4;
      border-radius: 10px;
      background:
        linear-gradient(135deg, rgba(13,110,94,0.09) 0 26%, transparent 26% 52%, rgba(212,166,42,0.16) 52% 100%),
        #f7fffb;
    }
    .visual-scorecard-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: start;
      margin-bottom: 14px;
    }
    .visual-scorecard-head h3 {
      margin: 2px 0 0;
      color: var(--ink);
      font-size: 1.18rem;
    }
    .visual-scorecard-head > span {
      flex: 0 0 auto;
      padding: 5px 9px;
      border: 1px solid #cfe1dc;
      border-radius: 999px;
      background: rgba(255,255,255,0.78);
      color: var(--bridge-dark);
      font-size: 0.74rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .visual-kicker {
      color: var(--bridge);
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .scorecard-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .scorecard-card {
      min-height: 132px;
      padding: 11px;
      border: 1px solid #d8e5e1;
      border-radius: 8px;
      background: rgba(255,255,255,0.88);
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.045);
    }
    .scorecard-card-top {
      display: grid;
      gap: 7px;
      margin-bottom: 9px;
    }
    .scorecard-card strong {
      color: var(--ink);
      font-size: 0.86rem;
      line-height: 1.18;
    }
    .scorecard-card span {
      display: inline-flex;
      width: fit-content;
      max-width: 100%;
      padding: 4px 7px;
      border-radius: 999px;
      background: #e6f8f3;
      color: var(--bridge-dark);
      font-size: 0.72rem;
      font-weight: 800;
      line-height: 1.15;
    }
    .scorecard-card-high span { background: #fff1d2; color: #714d00; }
    .scorecard-card-medium span { background: #eef3f0; color: #40514c; }
    .scorecard-card p {
      margin: 0;
      color: var(--muted);
      font-size: 0.8rem;
      line-height: 1.38;
    }
    .readiness-panel {
      display: grid;
      gap: 8px;
      padding: 13px;
      border: 1px solid #d7e6e1;
      border-radius: 8px;
      background: rgba(255,255,255,0.82);
    }
    .readiness-panel > strong {
      color: var(--ink);
      font-size: 0.92rem;
    }
    .readiness-panel > p {
      margin: -4px 0 2px;
      color: var(--muted);
      font-size: 0.78rem;
    }
    .readiness-row {
      display: grid;
      grid-template-columns: 170px minmax(120px, 1fr) 112px;
      gap: 10px;
      align-items: center;
      font-size: 0.82rem;
    }
    .readiness-label {
      color: var(--ink);
      font-weight: 800;
    }
    .readiness-track {
      height: 10px;
      overflow: hidden;
      border-radius: 999px;
      background: #e8ebe6;
    }
    .readiness-track span {
      display: block;
      height: 100%;
      width: 58%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--bridge), #48b49f);
    }
    .readiness-high .readiness-track span {
      width: 82%;
      background: linear-gradient(90deg, #d4a62a, #f3c74d);
    }
    .readiness-strong .readiness-track span { width: 78%; }
    .readiness-medium .readiness-track span {
      width: 54%;
      background: linear-gradient(90deg, #83938e, #b8c7c2);
    }
    .readiness-value {
      color: var(--bridge-dark);
      font-size: 0.76rem;
      font-weight: 900;
      text-align: right;
    }
    .scorecard-evidence {
      margin-top: 12px;
      color: var(--muted);
      font-size: 0.84rem;
    }
    .scorecard-evidence summary {
      cursor: pointer;
      color: var(--bridge-dark);
      font-weight: 900;
    }
    .scorecard-evidence .table-wrap {
      margin: 10px 0 0;
      background: white;
    }
    .table-wrap {
      width: 100%;
      overflow-x: auto;
      margin: 18px 0 24px;
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    table {
      width: 100%;
      min-width: 860px;
      border-collapse: collapse;
      table-layout: auto;
      font-size: 0.92rem;
    }
    thead { display: table-header-group; }
    th {
      background: linear-gradient(135deg, var(--bridge-dark), var(--bridge));
      color: #ffffff;
      text-align: left;
      font-weight: 800;
      border-bottom: 1px solid rgba(7, 86, 72, 0.18);
      padding: 10px 12px;
      vertical-align: top;
    }
    td {
      border-top: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #f8fbf7; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .footer-note {
      margin-top: 34px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.82rem;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .footer-note img {
      width: 34px;
      height: 34px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .version-note {
      margin-top: 8px;
      color: #7a6a3f;
      font-size: 0.76rem;
    }
    @page {
      size: Letter;
      margin: 0.55in;
      @bottom-center {
        content: "Bridge To AI - Page " counter(page) " of " counter(pages);
        color: #6b7280;
        font-size: 9pt;
      }
    }
    @media print {
      body { background: white; }
      .report-shell {
        width: 100%;
        margin: 0;
        border: 0;
        box-shadow: none;
      }
      .cover {
        padding: 24px 0 18px;
        background: white !important;
        color: var(--bridge-dark) !important;
        border-bottom: 3px solid var(--gold);
      }
      .cover::after { display: none; }
      .cover-grid {
        grid-template-columns: minmax(0, 1fr) 86px;
      }
      .brand-mark { width: 38px; height: 38px; }
      .cover-seal { width: 86px; height: 86px; }
      .cover h1 {
        color: var(--bridge-dark) !important;
        text-shadow: none;
      }
      .cover-meta span {
        color: var(--bridge-dark);
        background: transparent;
        border: 1px solid var(--line);
      }
      .trust-strip {
        background: white;
        border-color: var(--line);
      }
      .content { padding: 22px 0 0; }
      h2 { break-after: avoid; page-break-after: avoid; }
      table {
        min-width: 0;
        font-size: 8.8pt;
      }
      th, td { padding: 6px 7px; }
      .visual-scorecard {
        padding: 12px;
        background: white;
        break-inside: avoid;
      }
      .scorecard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .readiness-row {
        grid-template-columns: 130px minmax(90px, 1fr) 88px;
      }
      a { color: var(--bridge-dark); text-decoration: none; }
    }
    @media (max-width: 840px) {
      .scorecard-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .readiness-row {
        grid-template-columns: 1fr;
        gap: 5px;
      }
      .readiness-value {
        text-align: left;
      }
    }
    @media (max-width: 560px) {
      .visual-scorecard-head {
        display: grid;
      }
      .scorecard-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <article class="report-shell">
    <header class="cover">
      <div class="cover-grid">
        <div>
          <div class="brand-row">
            ${lockMark ? `<img class="brand-mark" src="${lockMark}" alt="">` : ''}
            <div class="brand">Bridge To AI</div>
          </div>
          <h1>${escapeHtml(tierLabel)}</h1>
          <div class="cover-meta">
            <span>${escapeHtml(businessName)}</span>
            <span>Prepared ${escapeHtml(new Date(generatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }))}</span>
          </div>
        </div>
        ${trustSeal ? `<img class="cover-seal" src="${trustSeal}" alt="Secure Intelligence Layer">` : ''}
      </div>
    </header>
    <main class="content">
      <div class="trust-strip">
        ${lockMark ? `<img src="${lockMark}" alt="">` : '<span></span>'}
        <div><strong>Secure Intelligence Layer</strong> Encrypted intake, controlled use, private report delivery, and privacy-aware AI processing.</div>
      </div>
      ${body}
      <div class="footer-note">${lockMark ? `<img src="${lockMark}" alt="">` : ''}<span>Prepared by Bridge To AI. This report is evidence-first and directional; implementation decisions should be validated during private scoping before build work begins.</span></div>
      <div class="version-note">Built with Bridge To AI Intake ${escapeHtml(intakeVersion)}. Generated ${escapeHtml(new Date(generatedAt).toISOString())}.</div>
    </main>
  </article>
</body>
</html>`;
}
