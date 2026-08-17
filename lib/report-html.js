import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function markdownToHtml(markdown) {
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
      html.push(tableHtml(headers || [], rows));
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
    const assetPath = path.join(__dirname, '..', 'assets', 'brand', filename);
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
  const body = markdownToHtml(markdown);
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
      a { color: var(--bridge-dark); text-decoration: none; }
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
