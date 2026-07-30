function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cleanText(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/â€”|â€“/g, '-')
    .replace(/â†’/g, '->')
    .replace(/Ã—/g, 'x')
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€¦/g, '...');
}

function runXml(text, opts = {}) {
  const props = [];
  if (opts.bold) props.push('<w:b/>');
  if (opts.color) props.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.size) props.push(`<w:sz w:val="${opts.size}"/>`);
  return `<w:r>${props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(cleanText(text))}</w:t></w:r>`;
}

function paragraphXml(text, style = 'BodyText', opts = {}) {
  const pPr = [`<w:pStyle w:val="${style}"/>`];
  if (opts.keepNext) pPr.push('<w:keepNext/>');
  if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
  return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runXml(text, opts)}</w:p>`;
}

function bulletXml(text) {
  return `<w:p><w:pPr><w:pStyle w:val="BulletText"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>${runXml(text)}</w:p>`;
}

function cellXml(text, header = false) {
  const fill = header ? '<w:shd w:fill="E8F4F1"/>' : '';
  const color = header ? '0D6E5E' : '111827';
  const bold = header;
  return `<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/>${fill}<w:tcMar><w:top w:w="100" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/></w:pPr>${runXml(text, { bold, color })}</w:p></w:tc>`;
}

function tableXml(headers, rows) {
  const colCount = Math.max(headers.length, ...rows.map(row => row.length));
  const grid = Array.from({ length: colCount }, () => '<w:gridCol w:w="2200"/>').join('');
  const rowXml = [headers, ...rows].map((row, rowIndex) => {
    const cells = Array.from({ length: colCount }, (_, idx) => cellXml(row[idx] || '', rowIndex === 0)).join('');
    return `<w:tr>${cells}</w:tr>`;
  }).join('');
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:firstRow="1" w:noHBand="1" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowXml}</w:tbl>`;
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
  const rows = tableLines.map(line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cleanText(cell.trim())));
  return { rows, next: i };
}

function markdownToBody(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const body = [];
  let inCode = false;
  let firstTitle = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\t/g, '  ');
    const line = raw.trimEnd();
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (!inCode && /^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const parsed = parseTable(lines, i);
      const [headers, ...rows] = parsed.rows;
      body.push(tableXml(headers || [], rows));
      body.push(paragraphXml('', 'BodyText'));
      i = parsed.next - 1;
      continue;
    }
    if (!line.trim()) {
      body.push(paragraphXml('', 'BodyText'));
      continue;
    }
    if (!inCode && line.startsWith('# ')) {
      body.push(paragraphXml(line.replace(/^#\s+/, ''), firstTitle ? 'Title' : 'Heading1', { keepNext: true }));
      firstTitle = false;
    } else if (!inCode && line.startsWith('## ')) {
      body.push(paragraphXml(line.replace(/^##\s+/, ''), 'Heading1', { keepNext: true }));
    } else if (!inCode && line.startsWith('### ')) {
      body.push(paragraphXml(line.replace(/^###\s+/, ''), 'Heading2', { keepNext: true }));
    } else if (!inCode && /^[-*]\s+/.test(line)) {
      body.push(bulletXml(line.replace(/^[-*]\s+/, '')));
    } else if (!inCode && /^\d+\.\s+/.test(line)) {
      body.push(bulletXml(line.replace(/^\d+\.\s+/, '')));
    } else if (line.startsWith('>')) {
      body.push(paragraphXml(line.replace(/^>\s*/, ''), 'CalloutText'));
    } else {
      body.push(paragraphXml(line, inCode ? 'CodeText' : 'BodyText'));
    }
  }
  return body.join('\n');
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="BodyText"><w:name w:val="Body Text"/><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:color w:val="111827"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="0" w:after="220"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="42"/><w:color w:val="0D6E5E"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:spacing w:before="300" w:after="120"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos Display" w:hAnsi="Aptos Display"/><w:b/><w:sz w:val="30"/><w:color w:val="0D6E5E"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:pPr><w:spacing w:before="220" w:after="80"/><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:b/><w:sz w:val="24"/><w:color w:val="1F2937"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="BulletText"><w:name w:val="Bullet Text"/><w:pPr><w:spacing w:after="90" w:line="276" w:lineRule="auto"/><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:color w:val="111827"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:pPr><w:spacing w:after="20" w:line="252" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="19"/><w:color w:val="111827"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CalloutText"><w:name w:val="Callout Text"/><w:pPr><w:spacing w:before="120" w:after="120" w:line="276" w:lineRule="auto"/><w:ind w:left="240" w:right="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:i/><w:sz w:val="21"/><w:color w:val="374151"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CodeText"><w:name w:val="Code Text"/><w:pPr><w:spacing w:after="80"/><w:ind w:left="240"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/><w:color w:val="374151"/></w:rPr></w:style>
  <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D1D5DB"/><w:left w:val="single" w:sz="4" w:color="D1D5DB"/><w:bottom w:val="single" w:sz="4" w:color="D1D5DB"/><w:right w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideH w:val="single" w:sz="4" w:color="D1D5DB"/><w:insideV w:val="single" w:sz="4" w:color="D1D5DB"/></w:tblBorders></w:tblPr></w:style>
</w:styles>`;
}

function numberingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
}

function markdownToDocumentXml(markdown) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${markdownToBody(markdown)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

export function createDocxBuffer(markdown) {
  const files = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      name: 'word/_rels/document.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`
    },
    { name: 'word/document.xml', content: markdownToDocumentXml(markdown) },
    { name: 'word/styles.xml', content: stylesXml() },
    { name: 'word/numbering.xml', content: numberingXml() }
  ];

  return createZipBuffer(files);
}

function crc32Buffer(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function u16(value) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value);
  return b;
}

function u32(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
}

export function createZipBuffer(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  files.forEach(file => {
    const name = Buffer.from(file.name, 'utf8');
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || ''), 'utf8');
    const crc = crc32Buffer(content);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc),
      u32(content.length), u32(content.length), u16(name.length), u16(0), name, content
    ]);
    localParts.push(local);

    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc),
      u32(content.length), u32(content.length), u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), name
    ]);
    centralParts.push(central);
    offset += local.length;
  });

  const central = Buffer.concat(centralParts);
  const local = Buffer.concat(localParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(local.length), u16(0)
  ]);

  return Buffer.concat([local, central, end]);
}
