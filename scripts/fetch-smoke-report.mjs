import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const recordId = process.argv[2] || process.env.BTAI_SMOKE_RECORD_ID;
if (!recordId) {
  console.error('Usage: node scripts/fetch-smoke-report.mjs <recordId>');
  process.exit(1);
}

const { decryptJson } = await import('../lib/crypto.js');
const { getIntakeEvents, getLatestIntakeOutput } = await import('../lib/supabase-rest.js');

const mdRow = await getLatestIntakeOutput(recordId, 'report_free_snapshot');
const htmlRow = await getLatestIntakeOutput(recordId, 'report_free_snapshot_html');
const btaiRow = await getLatestIntakeOutput(recordId, 'report_btai_advisor_brief_html');
const events = await getIntakeEvents(recordId, 200);

if (!mdRow || !htmlRow) {
  console.error(`Free report outputs not found for ${recordId}`);
  process.exit(1);
}

const markdownPayload = decryptJson(mdRow.encrypted_payload);
const htmlPayload = decryptJson(htmlRow.encrypted_payload);
const html = Buffer.from(htmlPayload.contentBase64 || '', 'base64').toString('utf8');
const outDir = path.join(root, 'smoke-output');
fs.mkdirSync(outDir, { recursive: true });
const markdownPath = path.join(outDir, `${recordId}_free_snapshot.md`);
const htmlPath = path.join(outDir, `${recordId}_free_snapshot.html`);
fs.writeFileSync(markdownPath, markdownPayload.markdown || '', 'utf8');
fs.writeFileSync(htmlPath, html, 'utf8');

const eventTypes = events.map(event => `${event.event_type}:${event.status}`);
console.log(JSON.stringify({
  recordId,
  businessName: markdownPayload.businessName || htmlPayload.businessName || '',
  hasSnapshotScorecard: /Snapshot Scorecard/i.test(markdownPayload.markdown || html),
  hasTryThisThisWeek: /Try This This Week/i.test(markdownPayload.markdown || html),
  hasPrivacyStatement: /How This Was Handled Privately/i.test(markdownPayload.markdown || html),
  freeMarkdownOutputId: mdRow.id || '',
  freeHtmlOutputId: htmlRow.id || '',
  internalBriefHtmlReady: !!btaiRow,
  reportEmailLogged: eventTypes.some(type => type === 'free_report_emailed:success'),
  eventCount: events.length,
  markdownPath,
  htmlPath
}, null, 2));
