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

export function createReportHtml(markdown, options = {}) {
  const title = options.title || 'Bridge To AI Report';
  const businessName = options.businessName || 'Client Business';
  const tierLabel = options.tierLabel || 'AI Opportunity Report';
  const generatedAt = options.generatedAt || new Date().toISOString();
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
      --gold: #d4a62a;
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
      background: var(--bridge);
      color: white;
      padding: 34px 42px;
      border-bottom: 6px solid var(--gold);
    }
    .brand {
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 800;
      opacity: 0.9;
    }
    .cover h1 {
      margin: 14px 0 8px;
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .cover-meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 0.92rem;
      opacity: 0.95;
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
      background: var(--soft);
      color: var(--bridge-dark);
      text-align: left;
      font-weight: 800;
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
    }
    td {
      border-top: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
    }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .footer-note {
      margin-top: 34px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.82rem;
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
      <div class="brand">Bridge To AI</div>
      <h1>${escapeHtml(tierLabel)}</h1>
      <div class="cover-meta">
        <span>${escapeHtml(businessName)}</span>
        <span>Prepared ${escapeHtml(new Date(generatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }))}</span>
      </div>
    </header>
    <main class="content">
      ${body}
      <div class="footer-note">Prepared by Bridge To AI. This report is evidence-first and directional; implementation decisions should be validated during private scoping before build work begins.</div>
    </main>
  </article>
</body>
</html>`;
}
