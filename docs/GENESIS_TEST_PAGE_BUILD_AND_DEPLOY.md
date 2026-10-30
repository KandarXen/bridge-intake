# Bridge To AI — Test Page Build and Deployment Brief

## Your role

You are building a small, private test webpage for Bridge To AI. Your job is to make it clear, trustworthy, mobile-friendly, and easy for a few invited people to test.

This is a **test asset**, not a public launch and not a replacement for the existing BTAI Intake product.

## Goal

Build one self-contained test webpage that:

1. Explains in plain language what the tester is being asked to try.
2. Gives the tester one clear action to start the test.
3. Makes clear that this is a private early test and that testers should use non-sensitive example information.
4. Works well on desktop and phone.
5. Can be deployed as a Vercel **Preview** URL for invited testers.

## Product context

- Product: Bridge To AI Intake.
- Current public production baseline: v1.72.23.
- Current private development work: v1.72.24 Secure Pilot Foundation.
- The existing public site must not be changed or replaced.
- The project is bootstrapped and must stay on free/Hobby plans wherever possible.

## Design direction

- Use Bridge To AI visual cues: deep teal, warm gold accent, off-white background, readable dark text.
- Keep the tone calm, practical, and owner-friendly. Avoid AI hype and technical jargon.
- Make the page feel private and professional, not like a generic software demo.
- Use short sections and clear headings. Do not use dense walls of text.
- Accessibility matters: semantic headings, visible focus styles, adequate colour contrast, descriptive buttons, and a usable mobile layout.

## Required page content

### 1. Private-test notice

At the top, state plainly:

> Private early test — please use sample or non-sensitive business information only.

Do not claim legal, security, compliance, or performance guarantees that the product has not earned.

### 2. Clear value statement

Explain that the test helps a business owner identify a practical first AI opportunity from real workflow friction.

Suggested direction:

> Find one practical place where AI could remove repeated work—before you spend money on a big implementation.

### 3. What the tester will do

Show three simple steps:

1. Answer a short set of business questions.
2. Review the AI Opportunity Snapshot.
3. Tell us what was useful, confusing, or missing.

### 4. Main call to action

Use one primary button only, such as **Start the private test**.

The button may link to the existing private BTAI Intake Preview when a valid preview URL is supplied. Do not hard-code a production URL unless specifically instructed.

### 5. Feedback section

Include a concise feedback prompt that asks testers to share:

- What made sense right away.
- What felt unclear or unhelpful.
- Whether the result felt relevant to their business.

For the initial version, feedback may use a mailto link or a clearly marked placeholder. Do not connect a new form provider, analytics service, database, or email automation without approval.

## Safety and privacy rules

- Do not collect credit-card details, passwords, private financials, recipes, customer lists, supplier contracts, payroll, invoices, or confidential operating data.
- Do not add tracking pixels, analytics, chat widgets, advertising tags, cookies, or third-party scripts.
- Do not include API keys, Supabase keys, Resend keys, or any secrets in code or documentation.
- Do not activate AI calls, database writes, report emails, or any other paid/external automation from this test page.
- Do not place draft IDs, access tokens, or other private capabilities in page URLs.

## Deployment rules

1. Work on a new clearly named branch, for example `feature/private-test-page`.
2. Deploy to Vercel **Preview only**.
3. Do not merge to `main`.
4. Do not promote the deployment to Production.
5. Do not change production environment variables, domains, billing, or plan settings.
6. Use only the repository's existing tools and dependencies unless a new dependency is clearly justified and free.

## Minimum verification before handoff

Verify all of the following:

- The page loads from the Vercel Preview URL.
- The primary button works and does not point to production by accident.
- The page is readable on a narrow phone-sized viewport.
- No console errors occur on initial load.
- No forms or buttons send email, write data, or call external APIs.
- No secrets appear in source code, page text, build logs, or the Git history created by this work.

## Handoff format

Report back with only:

1. The branch name.
2. The Vercel Preview URL.
3. The files changed.
4. The tests completed and their results.
5. Any blocker that requires the owner's decision.

Do not make a production deployment. Stop and ask for approval before any action that sends email, stores tester data, turns on an external service, incurs cost, or changes the public site.
