# Bridge To AI Intake App - v1.72.1 Report Branding & Readability

This build keeps the trust-first, controlled industry-adaptive intake, live-intended report funnel, paid-report breadcrumbs, server-side privacy-proof logging, admin privacy proof export, deterministic privacy certificates, HTML-first client reports, privacy-safe partner aggregate intelligence reports, the private records console route, the regenerate report checkbox, report quality gates, the tightened Darren voice report prompt, the required high-value "Try This This Week" prompt in the free report, selectable report export formats, searchable/sortable admin interview index, deterministic final-section safety net, the clearer core-question/follow-up progress language, the Snapshot First campaign URL, and the real Snapshot Scorecard in the free report. v1.72.1 adds the Bridge To AI brand system to the intake and snapshot forms, including optimized SIL/partner badge assets, branded header styling, trust panels, and a more vibrant report header.

## Snapshot First Campaign

- Clean public URLs:
  - `/full` for the full diagnostic interview
  - `/AFPA` for the AFPA member 20-question intake
  - `/snapshot`
  - `/snapshot-first`
  - `/btai-console` for the private records console
- `snapshot.html` and `snapshot-first.html` are physical copies of `index.html` so Vercel `cleanUrls` can serve the campaign reliably even if rewrite handling changes.
- Query-string equivalent:
  - `/?campaign=snapshot_first`
- The normal `/` URL remains the full diagnostic.
- The AFPA member intake is available at `/AFPA`. It uses 20 fixed questions, skips the two Voice & Standards scenario prompts, and uses the business type plus specific niche field to tailor examples and report context.
- The snapshot campaign is intentionally not hard-branded as AFPA. AFPA can still use snapshot-style links where useful, but `/AFPA` is the clean member intake path.
- The campaign uses a purpose-built 12-question free interview: business snapshot, top bottleneck, frequency, current workaround, handoffs, roles involved, information location, readiness assets, AI comfort boundary, human-review boundary, first useful win, and practical leverage.
- Snapshot mode skips the two Voice & Standards prompts. Those belong to the deeper diagnostic because the free snapshot does not build a business voice/DNA profile.
- Snapshot mode limits adaptive AI probes to 2 instead of the full diagnostic cap of 5.
- Snapshot mode is recorded in draft, KPI, and report-generation metadata as `intakeVariant: snapshot_first`.
- Snapshot completion now offers an optional `Continue deeper interview` path. This keeps the free snapshot low-friction, then lets motivated users continue into the full diagnostic in the same secure browser session without re-entering their earlier answers.
- Free-report email now uses the deeper interview as the primary next step. Paid report options are described as later choices after the deeper interview, not direct payment links from the free email.
- Free Snapshot reports now include a directional **Snapshot Scorecard** covering Workflow Drag, AI Fit, Information Readiness, Human Review Boundary, and First Useful Win.
- The snapshot landing page now previews that scorecard instead of showing illustrative time-savings or fake workflow-drag metrics.
- The Business DNA prompt is aware that this is a shorter first-pass intake and must label deeper sequencing, readiness, ROI, and implementation assumptions as needing confirmation/private scoping.
- The same SIL rules apply: consent, data minimization, sensitive-data warnings, pseudonymization/tokenization where practical, encrypted Supabase storage, encrypted re-identification maps, privacy-proof logging, report quality/sensitive-data scans, and partner aggregate-only boundaries.

## What Changed

- Header version is now `v1.72.1`.
- Added optimized Bridge To AI logo assets under `assets/brand`.
- Replaced the generic header mark with the Bridge To AI SIL small lock mark.
- Added a Secure Intelligence Layer proof chip to the Snapshot splash page.
- Added a Privacy-First AI Processing trust panel to the start form.
- Added the Powered by Bridge To AI partner badge to the association/white-label explanation area.
- Updated the footer privacy mark to use the Bridge To AI SIL small lock mark.
- Refreshed HTML report header styling with brighter teal/gold branding and stronger title contrast.
- Added report provenance to generated HTML report footers: `Built with Bridge To AI Intake v1.72.1` plus generation timestamp.
- Added `/snapshot` and `/snapshot-first` rewrites to `vercel.json`.
- Added `snapshot.html` and `snapshot-first.html` static entry files for reliable clean URLs.
- Added campaign variant detection from path or `campaign=snapshot_first`.
- Added a curated short question set for Snapshot First while leaving the full diagnostic question set unchanged.
- Added variant-aware welcome copy for the shorter intake.
- Removed the Voice & Standards scenario from the free snapshot path and reserved it for the deeper interview.
- Replaced the shorter path's old filtered diagnostic/mastery list with a sharper free-report question set focused on workflow friction, readiness, boundaries, and practical value.
- Added an optional snapshot-to-full continuation path with preserved answers and a separate Hermes log event.
- Added secure email continuation links using `continue=deep&recordId=...` so free-report recipients can reopen their saved snapshot and continue into the deeper interview.
- Added variant-aware adaptive probe cap.
- Added `intakeVariant` and `questionSet` to draft payloads, KPI events, and report-generation source metadata.
- Added prompt guidance so the internal Business DNA file does not overstate what can be known from the shorter first-pass intake.
- Privacy Policy version is now `2026-07-25-v1.56.1`.
- Level 1 Free Snapshot prompt now stops before becoming a paid implementation plan.
- Level 1 still gives real value, likely opportunities, and one useful "Try This This Week" prompt.
- Level 1 now avoids full sequencing, deep readiness scoring, implementation phases, tool maps, and detailed 30-day plans.
- Level 2 Detailed Report prompt now must provide a visibly deeper paid layer: ranked diagnosis, ranking logic, ready-now vs cleanup-first separation, do-not-automate-yet guidance, 30-day action plan, risk/data/privacy considerations, success measures, and confirmation questions.
- Level 2 final note now avoids repeating the Level 1 closing and must explain the practical paid-report value.
- If the model repair pass still misses the required final section, the server can add a safe deterministic closing section for that report tier instead of failing the whole run.
- The admin Record ID field is now capped to a practical dashboard width.
- The regenerate checkbox is now aligned with its label.
- Report generation now attempts one completion repair pass when the first draft fails only because the final section is missing, the last line is too short, or the last line ends mid-thought.
- Free Snapshot token room increased to reduce cutoff risk on the highest-use report.
- Report generation now combines all returned model text blocks before validation instead of assuming the first block contains the whole report.
- Interview Index now includes a search box for client name, business name, email, category, partner/campaign, status, or Record ID.
- Interview Index headers are now sortable, with newest records shown first by default.
- The loaded Interview Index area is taller so more records are visible without turning the whole admin console into a long scrolling page.
- Interview Index CSV export now respects the current filtered/sorted view.
- Privacy proof actions now prioritize the Brief Certificate and Detailed Attestation, while the machine-readable JSON is renamed **Raw JSON Audit**.
- Admin console font sizes are increased across headings, labels, fields, buttons, status chips, table rows, empty states, and console output.
- The dashboard remains tuned for a one-screen desktop workflow after the readability pass.
- Report action controls now sit directly under the format selector instead of being pushed toward the bottom of the panel.
- Report status now uses compact status chips for faster scanning.
- Interview Index now shows a useful empty state before records are loaded.
- Console Output now starts with a clear ready state instead of an empty box.
- Desktop dashboard alignment now avoids stretching panels just to fill unused space.
- BTAI Records Console has been redesigned as a compact dashboard instead of a long scrolling form.
- Admin fields are now constrained to practical widths instead of stretching across the page.
- Report buttons are smaller and grouped in a dense left-side control rail.
- Privacy proof, interview index, partner aggregate intelligence, and console output now sit in adjacent dashboard panels.
- Interview index and console output use internal scroll areas so the page itself stays stable on desktop.
- Admin report generation now has a **Report output format** selector.
- HTML-only is now the default report-pack format for the cleanest ZIP and fastest non-DOCX workflow.
- Markdown-only, DOCX-only, HTML + Markdown, HTML + DOCX, and HTML + DOCX + Markdown are available when needed.
- ZIP downloads now use a format key, so an older all-format ZIP is not reused when the admin asks for HTML-only or Markdown-only.
- DOCX files are created only when DOCX is selected, reducing ZIP clutter and avoiding unnecessary Word conversion work.
- Existing stored report markdown can be reused to create HTML or DOCX without re-running the AI generation step.
- Free Snapshot reports now require a `Snapshot Scorecard` section plus a `Try This This Week` section with one copy/paste-ready AI prompt that creates a useful, safe win in under an hour.
- The free-report prompt must use the client's own words and quietly encode expert-level industry/customer context without gimmicky "act as a top expert" language.
- The free-report prompt must tell clients not to paste private financials, customer names, supplier names, recipes, payroll, invoices, contracts, formulas, or other sensitive information into public AI tools.
- The free-report quality gate now expects `## 9. Bridge To AI Note` because the real Snapshot Scorecard is section 2.
- Admin Report Actions are now grouped as Pack, Single Reports, Utilities, and Status inside a dominant full-width control block.
- Admin records console now displays its own visible version number.
- Admin records console now uses a wide top credential strip, warning strip, three action panels, interview index, and console output layout.
- The regenerate checkbox is now positioned inside the main Report Actions panel so it is much harder to miss.
- Pasted Record IDs are trimmed visibly before admin actions run.
- Report quality gate now accepts reasonable final-heading variants for the BTAI Advisor Brief and Preliminary Action Plan instead of failing only because the final heading wording varies.
- Admin console report errors now include a plainer explanation when the quality gate, secure email, or storage layer fails.
- ZIP building now includes available report formats and lists missing optional backup formats in `validation-summary.json` instead of failing the whole ZIP when one backup format is missing.
- Admin ZIP download now validates returned ZIP content and decodes large ZIP files in chunks.
- Processing screen spacing now prevents status text and timer overlap.
- Completed processing steps now render a proper checkmark instead of a question-mark placeholder.
- Completion page now uses a two-column layout on desktop: free snapshot and email action on the left, paid report and implementation options on the right.
- The free snapshot card now tells the user to use the button below to send the report, instead of implying the report was already sent before the button appears.
- The automatic-delivery failure message now points users to the visible **Email my free report** button and only asks them to contact Bridge To AI if that manual send does not confirm.
- The manual report-send button now shows a more specific failure reason for missing secure-session email, email mismatch, storage failure, email-service failure, report quality-gate failure, or network failure.
- Failed free-report delivery attempts are now logged server-side as `free_report_delivery_failed` events where possible.
- Welcome copy now clearly explains that the intake includes core questions and may add short follow-up questions when an answer needs more context.
- The AFPA welcome copy now includes the same core-question/follow-up transparency.
- The live progress counter now labels fixed prompts as `core step X of Y`.
- Adaptive probes and mastery follow-ups now display as `Follow-up after core step X of Y` instead of pretending to be part of the fixed question count.
- Client reports now normalize em dashes, curly quotes, and common mojibake sequences before storage to reduce broken copied/emailed characters such as `Ã¢â‚¬â€`.
- HTML report attachments now declare `text/html; charset=utf-8`.
- The client-facing privacy section is now shorter, plainer, and easier to trust at the end of a report.
- The paid-report handoff section is now titled `If You Want The Next Layer` and explains that the free report is meant to provide real value, not hold the value hostage.
- The upgrade copy now sells the next layer as deeper diagnosis, clearer ranking, and a build sequence, instead of sounding like a bolted-on sales block.
- The report polish layer now replaces known AI-ish table labels and phrases before storing HTML/DOCX outputs.
- Report generation now runs a completion quality gate before storing report files.
- Reports that appear cut off, miss the required final section, or end mid-thought are logged as failed and are not stored as deliverable client reports.
- Report validation now flags overused Darren-style phrases so the report does not sound artificially prompted.
- Report validation now flags generic AI/consultant phrases such as `genuinely strong`, `emotionally resonant`, `well positioned`, `significant opportunity`, and `implementation strategy`.
- HTML report rendering now converts italic markdown and horizontal rules more cleanly.
- Report prompts now tell the model not to use markdown horizontal rules, fenced code blocks, or ASCII-art diagrams.
- Report sections now use plainer labels such as `Where AI Looks Useful First`, `Quick Read`, `What I Would Build Around`, and `Build Order`.
- Ranked opportunity sections now require proof from the Venture DNA for why each opportunity deserves its rank.
- Report prompts now include Darren's opportunity-selection rule: do not default to email automation; first look for where the owner, highest-value person, or most expensive person is losing valuable time.
- Report prompts now push AI opportunity ranking toward repeated high-value work such as pitch decks, presentations, proposals, onboarding material, client paperwork, project summaries, quote preparation, compliance documents, weekly planning, buyer readiness, SOP capture, sales prep, social media planning, and decision prep.
- Report prompts now tell the model to use plainer Darren-style language such as "Here is what I am seeing", "That is probably the real pinch point", and "I would not automate this yet."
- Report prompts now warn against confident bad advice when the underlying data is not worth trusting.
- Free reports now explicitly require one useful, specific next move the client could act on without buying anything.
- The records console now includes a **Regenerate existing report files** checkbox.
- When unchecked, single report and full-pack buttons reuse stored reports where available.
- When checked, single report buttons regenerate only that selected tier from the current report prompt.
- When checked, **Generate Full Report Pack** regenerates all four report tiers from the current report prompt before rebuilding the ZIP.
- Report prompts now include a stronger Darren voice standard: plain-spoken, practical, curious, business-first, and direct without being harsh.
- Report prompts now include banned generic AI/consulting phrases such as `leverage`, `optimize`, `transform`, `unlock`, `robust`, `well positioned`, and `significant opportunity`.
- Report prompts now require a final voice rewrite pass before output.
- Each report tier now reinforces the practical advisor tone in addition to the shared source-of-truth rules.
- The records console now includes **Load Interview Index**.
- The interview index shows recent Record IDs, business names, client names, client emails, category, partner/campaign, status, and updated date.
- Clicking a row fills the Record ID and filename fields for faster Venture DNA retrieval or report generation.
- The interview index can be downloaded as CSV for private BTAI admin use.
- The index is protected by `BTAI_ADMIN_SECRET` and logs an admin access audit event.
- `vercel.json` now explicitly rewrites `/btai-console` to the private records console.
- The private records console file is now `btai-records-console.html`.
- With Vercel `cleanUrls`, use `/btai-console` instead of `/admin` or `/admin.html`.
- The obvious `admin.html` file is no longer included in the deploy package.
- This is reduced visibility, not the security boundary. The real protection remains `BTAI_ADMIN_SECRET` plus server-side authorization on the admin APIs.
- Partner aggregate reports now exclude completion-page test records and obvious test Record IDs by default.
- Partner aggregate reports now disclose how many test/demo records were excluded.
- Admin now includes a **Partner Aggregate Intelligence** section.
- New `/api/partner-aggregate` endpoint creates AFPA-style aggregate reports from `intake_kpi_events` only.
- Partner aggregate reports can be downloaded as polished HTML or editable Markdown.
- Partner aggregate reports do not decrypt raw interviews, include member names, include emails, expose raw answers, or include Venture DNA files.
- The first aggregate report includes participation funnel, member segment mix, intake quality/readiness signals, likely education themes, privacy boundaries, and recommended next conversation points.
- Report generation now stores a polished HTML version for each report tier in encrypted Supabase output.
- The free report email now attaches the HTML report instead of the rougher DOCX version.
- Admin report ZIPs now include `HTML_Reports/` as the primary readable report set and `DOCX_Backup/` as editable backup files.
- Existing report records with markdown/DOCX can be converted to HTML without re-running the AI generation step.
- Admin report status now shows whether each tier has HTML and DOCX outputs.
- The intake welcome page now explains that Bridge To AI reports are evidence-first, not AI sales pitches.
- The desktop welcome page now uses a wider two-column layout so the trust message, instructions, and start form are not stacked into one long narrow page.
- The direct BTAI welcome page now includes a subtle white-label positioning note for associations, training groups, and business communities; partner links hide this note from members.
- Admin report retrieval now surfaces the actual server message instead of hiding useful causes behind a generic "Server error".
- Admin report generation now shows a live elapsed timer while long report jobs run.
- Admin report status now shows server-recorded generation duration when available.
- Admin now provides two privacy proof downloads: **Brief Privacy Certificate** and **Detailed Privacy Attestation**.
- Privacy proof generation is deterministic from server logs; it does not send raw proof logs through an AI model.
- Cross-border proof now fails if the underlying notice/provider/contact proof fields are missing.
- Report privacy scans now separate blocking findings from non-blocking policy language, so delivery is only marked blocked when it should actually stop.
- Report ZIPs now include `BTAI_Report_Pack_Summary.md` in addition to the raw validation JSON.
- Report prompts now include a permanent Evidence-First / No-Sycophancy Standard.
- Reports are instructed to say when to build now, clean up first, or avoid automation for now.
- Free, Level 2, and Level 3 client reports now include the configured purchase/booking links inside the report content, not only in the email body.
- Every report now includes the standard BTAI Secure Intelligence Layer privacy statement.
- Reports are scanned before DOCX creation for obvious sensitive-data patterns, and the scan result is logged to the privacy proof trail.
- Server-side proof now records consent, Privacy Policy version, partner aggregate disclosure, cross-border processing notice, privacy contact availability, retention policy version, scheduled review date, and deletion request availability.
- Admin download of the raw Venture DNA markdown is logged as an admin access audit event.
- Privacy Proof JSON now includes a top-level conclusion and identifies missing improvement items instead of silently passing incomplete proof.
- The two Voice & Standards prompts are now counted as interview steps 1 and 2, so the first business question appears as step 3 of 44 instead of question 1 of 42.
- Back navigation from the first business question now returns to the second Voice & Standards prompt.
- Pure completion-page test mode now disables the report-send button and labels it as test-only.
- Server-side privacy-proof events are logged for consent, anonymized AI analysis, encrypted mapping storage, encrypted output storage, report generation, free-report email delivery, ZIP creation, and admin ZIP download.
- Admin page now includes **Download Privacy Proof JSON** so BTAI can produce an AFPA-safe proof package for a Record ID without exposing raw answers.
- Free-report delivery now logs timing data so Hermes can monitor generation speed, delivery speed, retries/failures, and report bottlenecks.
- The free report is generated automatically; Level 2 and Level 3 reports are positioned as on-demand paid upgrades.
- The internal BTAI Advisor Brief is generated after the free report unless `BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=false`.
- Free-report email now includes paid-report breadcrumbs, optional payment/booking links, and a plain-English workbench description.
- Report DOCX names now use the client-level convention: `Client_Name_Level1_report.docx`, `Client_Name_Level2_Report.docx`, `Client_Name_Level3_Report.docx`, and `Client_Name_Internal_brief.docx`.
- Admin page now includes **Send/Resend Free Report Email** so real report delivery can be tested from an existing Record ID without retaking the interview.
- Completion page now includes a visible deeper-support offer for the Detailed AI Opportunity Report, Preliminary AI Action Plan, and implementation support.
- The free-report email now includes the same optional deeper-support offer.
- Completed intakes can automatically trigger free report generation and delivery to the interviewee's email address.
- Completion page now uses **Email my free report** as the primary client-facing action instead of **Save preference**.
- BTAI follow-up preference is saved silently as part of the report-delivery request.
- Report delivery status now tells the interviewee when the report is being prepared, sent, already sent, or could not be confirmed.
- `/api/report-pack` now supports `generate-free-email` for the finished intake flow.
- `/api/report-pack` now supports `generate-all` so the admin page can generate the full report pack in one orchestration run.
- The admin page now has a **Generate Full Report Pack** button. The individual report buttons remain as recovery tools only.
- The DOCX builder has been upgraded with stronger Word styles, better spacing, heading hierarchy, bullet handling, and markdown table rendering.
- Completion-page next-step copy now matches the free-intake model instead of implying every user automatically receives a full roadmap and workbench build.
- Completion-page BTAI follow-up preference now supports the report-delivery CTA instead of a separate preference-saving action.
- Completion-page test mode is available with `?testComplete=1` so the final screen can be reviewed without taking a full interview. This does not submit an interview or send a report email.
- Privacy Policy now distinguishes reversible pseudonymization/tokenization from anonymized aggregate partner reporting.
- Privacy Policy now includes named privacy accountability, cross-border processing, concrete retention/deletion targets, OPC complaint escalation, AI provider data-use language, breach response, access/correction/deletion process, minimum aggregate-reporting threshold, age restriction, cookies/analytics language, and the first-intake vs paid-implementation boundary.
- Browser stores only a random session ID.
- Welcome screen now requires the interviewee email address for future report-link delivery and recovery.
- Welcome screen now explains that exact financials, recipes, customer lists, supplier contracts, payroll details, invoices, and confidential operating data are not needed for the first intake.
- Business category is now selected from a controlled list so questions can adapt examples without creating a free-roaming AI interview.
- Optional niche and detail-sharing comfort fields are captured for safer tailoring and later aggregate reporting.
- Welcome screen explains that the interview adapts: short answers may get clarifying follow-ups, while detailed answers can reduce unnecessary probing.
- Welcome screen requires Privacy Policy consent before the interview can start.
- Privacy consent version and timestamp are stored inside the encrypted intake record.
- `privacy.html` provides a standalone Privacy Policy page linked from the welcome screen and footer.
- The secure processing/KPI layer now captures partner/campaign tags, consent status, answer-depth buckets, short-answer rates, adaptive follow-up counts, completion summaries, business niche, share-comfort level, guardrail rejections, and report-pack generation events.
- Supabase setup now includes the `intake_kpi_events` reporting view for aggregate AFPA/member intelligence reporting without decrypting raw interviews.
- URL-based partner co-branding is supported. `partner=AFPA` changes the welcome page, completion copy, and consent language for the AFPA member program.
- Partner consent explains that AFPA receives anonymized aggregate insights only, not raw member interviews or individual answers.
- BTAI follow-up interest is asked on the completion screen, after the member finishes the interview.
- BTAI follow-up selections are logged as privacy-safe KPI/lead events without exposing raw answers or client email.
- Shared server helper code lives in `lib/` so Vercel Hobby does not count helper modules as serverless functions.
- Draft actions are consolidated into `/api/draft`.
- Adaptive interview AI actions are consolidated into `/api/interview-ai`.
- Draft answers are saved through `/api/draft`.
- Drafts are encrypted with `AES-256-GCM` before Supabase storage.
- Resume loads encrypted drafts through `/api/draft`.
- Completed Venture DNA output is encrypted and saved in Supabase.
- Re-identification maps are encrypted and saved in Supabase where required.
- Secure processing events are saved in Supabase instead of Google Drive.
- Adaptive AI probes are constrained by approved question types, forbidden sensitive-topic checks, repetition checks, and a maximum probe count.
- Email is notification-only by default.
- Private admin retrieval is available through `btai-records-console.html` and `/api/admin-output`.
- Admin-only three-report generation is available through `btai-records-console.html` and `/api/report-pack`.
- Report pack ZIP download includes three client-facing DOCX reports, one internal BTAI Advisor Brief DOCX, and a validation summary. The higher-tier reports are positioned as opportunity/action planning from first-intake data, not as validated ROI or final implementation scope.
- The raw Venture DNA markdown stays secure and is not included in the report pack ZIP.
- Plaintext Google Drive saving is no longer part of the normal completion path.

## Required Setup

Run `SUPABASE_SETUP.sql` in Supabase, then set the Vercel environment variables listed in `SECURE_DEPLOY_CHECKLIST.md`.

Required Vercel env vars:

```text
SUPABASE_URL
SUPABASE_SECRET_KEY
BTAI_ENCRYPTION_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
BTAI_ADMIN_SECRET
```

Recommended:

```text
INTAKE_EMAIL_ATTACHMENTS_ENABLED=false
BTAI_STORE_RECORD_LABELS=false
INTAKE_DIRECT_RECIPIENT=darren@ourcopacker.ca
INTAKE_BCC_RECIPIENT=darren.randles@gmail.com
BTAI_GENERATE_INTERNAL_BRIEF_AFTER_FREE=true
BTAI_LEVEL2_PRICE_LABEL=$147 introductory
BTAI_LEVEL3_PRICE_LABEL=$397 introductory
BTAI_LEVEL2_PAYMENT_URL=
BTAI_LEVEL3_PAYMENT_URL=
BTAI_CONSULTATION_URL=
```

Payment links should be Stripe Payment Links or another live purchase URL:

```text
BTAI_LEVEL2_PAYMENT_URL=https://buy.stripe.com/...
BTAI_LEVEL3_PAYMENT_URL=https://buy.stripe.com/...
```

## Admin Retrieval

## Completion Page Test Mode

To test the final page without taking the full interview, open:

```text
/?testComplete=1
```

AFPA/co-branded final page:

```text
/?partner=AFPA&campaign=demo&testComplete=1
```

Optional test labels:

```text
/?testComplete=1&name=Morgan%20Ellis&business=Prairie%20Hearth%20Bakery&email=demo@bridgetoai.test
```

This mode is for UX review only. It does not create a Supabase Venture DNA record and does not email the free report.

To test real report delivery from the completion page without retaking the interview, use an existing completed Record ID:

```text
/?testComplete=1&allowRealDelivery=1&recordId=PASTE_REAL_RECORD_ID&email=CLIENT_EMAIL_ON_THAT_RECORD
```

The email must match the email stored on that secure intake session. This mode does not submit a new interview; it only lets you test the final-page **Email my free report** action against an existing encrypted Supabase record.

After a completed intake, use:

```text
/btai-console
```

Paste the notification email's Record ID and the private `BTAI_ADMIN_SECRET` to download the decrypted `.md` file.

The DNA is decrypted server-side only after the admin secret is verified.

## Admin Report Pack

The admin page can also generate the report files:

```text
Client_Name_Level1_report.docx
Client_Name_Level2_Report.docx
Client_Name_Level3_Report.docx
Client_Name_Internal_brief.docx
```

Generate one report at a time, then download the ZIP. Each generated report is encrypted and stored in Supabase before retrieval.

The internal BTAI Advisor Brief is for Bridge To AI only. It summarizes what to clarify, what to listen for, likely opportunity angles, risk notes, and proposal direction without requiring the raw Venture DNA file to leave secure storage.

## Privacy Proof Export

Use `/btai-console`, paste the Record ID and `BTAI_ADMIN_SECRET`, then click **Download Privacy Proof JSON**.

The export is designed for AFPA/client trust review. It includes sanitized event proof such as:

```text
privacy_proof_consent_recorded
privacy_proof_cross_border_notice
privacy_proof_retention_policy_recorded
privacy_proof_anonymization_completed
privacy_proof_mapping_storage
privacy_proof_ai_analysis_requested
privacy_proof_secure_output_storage
report_privacy_scan_completed
report_generation_started
report_generated
free_report_emailed
admin_raw_dna_retrieved
admin_privacy_proof_downloaded
report_pack_zip_built
report_pack_zip_downloaded
```

The proof export does not include raw interview answers, raw Venture DNA content, client email, private recipes, supplier/customer details, payroll, invoices, formulas, or confidential operating data.

## Privacy Model

The secure path is:

```text
Client browser
  -> Vercel API
    -> BTAI secure processing layer
      -> encrypted Supabase storage
      -> anonymized model calls
      -> validated outputs
```

The browser does not keep the full intake in local storage.

## AFPA KPI Logging

AFPA campaign links can include:

```text
/?partner=AFPA&campaign=AFPA_December_AI_Course_2026
```

The secure processing layer logs anonymized KPI events only. It does not log raw answer text or client email. Useful events include:

```text
interview_started
interview_start_blocked
privacy_consent_checked
privacy_policy_link_clicked
btai_followup_interest_selected
answer_saved
business_domain_completed
adaptive_probe_requested
domain_probe_generated
domain_probe_skipped
interview_completed_answers
interview_submission_complete
submission_failed
report_generated
free_report_emailed
internal_brief_after_free_complete
report_pack_zip_built
report_pack_zip_downloaded
privacy_proof_anonymization_completed
privacy_proof_ai_analysis_requested
privacy_proof_secure_output_storage
```

Use the Supabase `intake_kpi_events` view for aggregate dashboards and AFPA reports.

## Deployment

Upload this folder to the GitHub repo connected to Vercel. Vercel will deploy the static `index.html`, `privacy.html`, and the `/api` serverless functions.

For Vercel Hobby compatibility, `/api` should contain only 7 endpoint files. The shared helper modules must remain in `lib/`.

`api/` should contain only:

```text
admin-output.js
draft.js
generate-dna.js
hermes-log.js
interview-ai.js
report-pack.js
send-email.js
```

`lib/` should contain:

```text
crypto.js
docx.js
privacy.js
supabase-rest.js
validate-output.js
```



## v1.72.17 Static Route Fallbacks

This release adds real static fallback files for /full, /AFPA, and /btai-console so the simple public URLs work even if Vercel rewrites are not applied on the custom domain. It keeps AFPA at 20 core questions with up to 5 adaptive clarification follow-ups and preserves privacy-safe abandonment/progress KPI logging.

