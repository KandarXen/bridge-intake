const BASE_URL = process.env.BTAI_SMOKE_BASE_URL || 'https://intake.bridgetoai.ca';
const EMAIL = process.env.BTAI_SMOKE_EMAIL || 'darren@randles.ca';
const now = new Date();
const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const recordId = process.env.BTAI_SMOKE_RECORD_ID || `smoke_test_snapshot_${stamp}`;

async function postJson(path, body, timeoutMs = 180000, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok || data.error) {
      throw new Error(`${path} failed ${response.status}: ${data.error || data.message || text}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const answers = [
  'This is a backend smoke test record for Bridge To AI. The business is a small specialty food processor that sells packaged products through retail partners and direct local orders. Do not treat this as a real client record.',
  'The most frustrating workflow is preparing weekly retailer follow-up, order-status updates, and production planning notes. The owner copies details from email, spreadsheets, and memory into separate messages.',
  'This happens several times per week. It is not a crisis, but it creates delay and means important follow-up sometimes waits until the owner has quiet time.',
  'Today the owner checks the inbox, opens the order spreadsheet, looks at production notes, then writes each follow-up manually. If the owner is busy, the task waits.',
  'The handoff is usually owner to production helper, then owner to retail buyer. Most of the coordination still comes back to the owner.',
  'The owner, one production helper, and occasional admin support touch the workflow. The owner still makes the final judgment call before anything goes to a customer or buyer.',
  'Useful information lives in email, a spreadsheet, a basic product list, and rough production notes. It is usable, but not tidy enough for unattended automation.',
  'There are repeat email examples, a simple order spreadsheet, and product descriptions. There is no clean SOP yet for what good follow-up should include.',
  'AI could help draft follow-up messages, summarize order status, and create a checklist for what needs attention. It should not send messages automatically or make commitments without owner review.',
  'The owner wants human review kept in place for buyer communication, production promises, pricing, ingredients, and anything that could affect food safety or customer trust.',
  'A useful first win would be a weekly follow-up draft that pulls non-sensitive order-status notes into a clear message the owner can review and edit.',
  'If this repeated admin work became easier, the owner would use the time to contact more retail buyers, improve product presentation, and follow up faster on warm opportunities.'
];

const prompt = `You are a business analyst for Bridge To AI, an AI implementation consulting firm run by Darren Randles.

A test client has completed the shorter Snapshot First interview. Produce a confidential AI Opportunity Snapshot Brief from the answers below. This is a BACKEND SMOKE TEST, not a real client. Keep the output realistic enough to test the report engine, but do not invent private financials, customer names, recipes, supplier contracts, payroll details, invoices, confidential formulas, exact ROI, exact savings, or exact implementation cost.

CLIENT INFORMATION:
Owner Name: Snapshot Smoke Test
Owner Email: ${EMAIL}
Business Name: BTAI Snapshot Smoke Test Food Co.
Business Category: Food / Beverage / Manufacturing
Specific Niche: Specialty packaged food processor
Detail-Sharing Comfort: General examples only
Website URL: Not provided
Company Size: 1-5 people
Owner Work Status / Capacity: Full-time owner/operator
Departments / Functions: Operations, Sales, Admin
Privacy Consent: Accepted
Privacy Policy Version: 2026-07-25-v1.56.1
Privacy Consent Timestamp: ${now.toISOString()}
Partner: Smoke Test
Campaign: snapshot_first_backend_smoke
Intake Variant: snapshot_first
Question Set: Snapshot First short set
Interview Date: ${now.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}

INTERVIEW DEPTH NOTE:
This was the shorter Snapshot First campaign. Treat missing detail as an intentional limitation of the first pass. Give Darren a high-signal opportunity brief, but do not create a business voice/DNA profile. Label deeper workflow sequencing, readiness scoring, ROI, implementation assumptions, and voice/brand conclusions as Needs confirmation or Requires the deeper interview.

SNAPSHOT FIRST ANSWERS:
${answers.map((answer, index) => `Q${index + 1}: ${answer}`).join('\n\n')}

Produce markdown with these sections:
# BTAI Snapshot Smoke Test Food Co. - AI OPPORTUNITY SNAPSHOT BRIEF
## Snapshot First Interview | ${now.toLocaleDateString('en-CA')}
### SECTION 1: CLIENT IDENTITY
### SECTION 2: WHAT THIS BUSINESS DOES
### SECTION 3: IDEAL CLIENT PROFILE
### SECTION 4: REVENUE ENGINE
### SECTION 5: OPERATIONS & DELIVERY
### SECTION 6: INFORMATION & SYSTEMS
### SECTION 7: PEOPLE & DECISION-MAKING
### SECTION 8: OWNER MASTERY PROFILE
State clearly that the full owner mastery profile was not captured in the free Snapshot First interview.
### SECTION 9: VOICE & STANDARDS PROFILE
State clearly that Voice & Standards were not captured in the free Snapshot First interview.
### SECTION 10: AI OPPORTUNITY PORTFOLIO
### SECTION 11: READINESS SCORECARD
### SECTION 12: DO NOW / BUILD NEXT / AVOID FOR NOW
### SECTION 13: 30-60-90 DAY ROADMAP
### SECTION 14: KEY QUOTES
### SECTION 15: CONSULTANT NOTES FOR DARREN

Evidence discipline: mark major findings as Client-stated, Derived, Inferred, or Needs confirmation. Be direct and practical.`;

const payload = {
  version: 2,
  storageMode: 'server_encrypted_supabase',
  savedAt: now.toISOString(),
  clientDraftId: recordId,
  clientName: 'Snapshot Smoke Test',
  clientEmail: EMAIL,
  privacyConsent: true,
  privacyConsentAt: now.toISOString(),
  privacyPolicyVersion: '2026-07-25-v1.56.1',
  btaiFollowupInterest: 'smoke_test',
  btaiFollowupInterestAt: now.toISOString(),
  campaignPartner: 'Smoke Test',
  campaignId: 'snapshot_first_backend_smoke',
  partnerDisplayName: 'Bridge To AI Smoke Test',
  intakeVariant: 'snapshot_first',
  questionSet: 'snapshot_first_short_set',
  businessName: 'BTAI Snapshot Smoke Test Food Co.',
  businessCategory: 'Food / Beverage / Manufacturing',
  businessNiche: 'Specialty packaged food processor',
  shareComfort: 'General examples only',
  websiteUrl: '',
  companySize: '1-5',
  ownerWorkStatus: 'Full-time owner/operator',
  departments: ['Operations', 'Sales', 'Admin'],
  currentQ: answers.length - 1,
  answers,
  masteryFollowups: [],
  masteryFollowupQ: '',
  domainProbes: {},
  snapshotAnswersArchive: [],
  scenarioText: '',
  scenarioGood: '',
  scenarioBad: '',
  scenarioStage: '',
  scenarioDone: false,
  businessContext: null,
  subStep: 'snapshot_backend_smoke_complete',
  activeProbe: null,
  interviewStarted: true,
  smokeTest: true
};

console.log(`Smoke test record: ${recordId}`);
console.log(`Recipient: ${EMAIL}`);
console.log('1/4 Saving encrypted draft...');
const draft = await postJson('/api/draft', { action: 'save', payload }, 60000);
console.log(`Draft saved: ${draft.saved}`);

console.log('2/4 Generating and storing Venture DNA...');
const dna = await postJson('/api/generate-dna', {
  prompt,
  clientDraftId: recordId,
  sourceMeta: {
    partner: 'Smoke Test',
    campaign: 'snapshot_first_backend_smoke',
    partnerDisplayName: 'Bridge To AI Smoke Test',
    intakeVariant: 'snapshot_first',
    questionSet: 'snapshot_first_short_set',
    businessCategory: payload.businessCategory,
    companySize: payload.companySize,
    ownerWorkStatus: payload.ownerWorkStatus,
    questionCount: answers.length,
    soloOrNoStaff: true,
    privacyConsent: true,
    privacyConsentAt: payload.privacyConsentAt,
    privacyPolicyVersion: payload.privacyPolicyVersion,
    partnerAggregateDisclosureShown: false,
    partnerAggregateDisclosureAccepted: false,
    crossBorderProcessingNoticePresented: true,
    serviceProviderPolicyAvailable: true,
    privacyContactPresented: true,
    deletionRequestPathAvailable: true,
    smokeTest: true
  }
}, 240000);
console.log(`DNA stored: ${!!dna.secureStorage?.saved}`);
console.log(`DNA output ID: ${dna.secureStorage?.outputId || '(none)'}`);

console.log('3/4 Generating free report and sending email...');
const email = await postJson('/api/report-pack', {
  action: 'generate-free-email',
  clientDraftId: recordId,
  clientEmail: EMAIL
}, 360000);
console.log(`Email sent: ${!!email.emailed}`);
console.log(`Resend ID: ${email.id || '(none)'}`);
console.log(`Internal brief: ${JSON.stringify(email.internalBrief || {})}`);

let status = { status: 'Skipped protected admin status check. Set BTAI_SMOKE_ADMIN_SECRET to verify stored formats.' };
if (process.env.BTAI_SMOKE_ADMIN_SECRET) {
  console.log('4/4 Checking protected report status...');
  status = await postJson('/api/report-pack', {
    action: 'status',
    clientDraftId: recordId
  }, 60000, {
    'x-btai-admin-secret': process.env.BTAI_SMOKE_ADMIN_SECRET
  });
} else {
  console.log('4/4 Skipping protected report status check. Email/report generation already returned success.');
}
console.log(JSON.stringify({
  recordId,
  recipient: EMAIL,
  reportStatus: status.status?.formats || status.status,
  email
}, null, 2));
