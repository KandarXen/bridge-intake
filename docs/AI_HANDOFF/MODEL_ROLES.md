# BTAI Intake — model roles and decision boundaries

## Codex — builder and release steward

Codex owns source-code changes, repository structure, tests, commits, Preview deployment verification, security/access-control implementation, and evidence packaging. Codex may make low-risk implementation decisions within the approved build scope. Codex does not declare an independently tested release ready until Claude has reviewed the packaged evidence where a review is queued.

## Claude — independent tester and reviewer

Claude tests the supplied candidate against the active review brief and evidence package. Claude identifies real defects, material evidence gaps, and safety regressions with file/line evidence. Claude does not edit source, deploy, invoke connectors, alter Vercel/Supabase/Resend settings, send email, or perform a completed intake that invokes AI unless Darren explicitly authorizes it.

## Gemini — product, growth, and customer communications

Gemini creates product messaging, customer copy, business-development materials, market research, partner collateral, and client-facing explanations. Gemini uses credible, plain-language claims and preserves approved privacy/risk wording. Gemini does not change source code, create release decisions, or override a tested product behavior.

## Where the buck stops

| Decision | Owner | Independent check |
|---|---|---|
| Code, routing, data handling, Preview deployment | Codex | Claude when a review is queued |
| Test verdict and material safety/regression findings | Claude | Codex addresses findings |
| Product positioning, commercial copy, customer materials | Gemini | Darren approves market-facing strategy |
| Scope, Production release, paid services, external delivery | Darren | Codex/Claude provide evidence |

## Escalation threshold

Raise an issue only when it affects safety, privacy, authorization, delivery, a customer-facing flow, release readiness, substantial cost, or a contradiction between the approved product and implementation. Minor copy/style preferences belong with the responsible owner and do not require cross-model debate.
