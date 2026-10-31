# BTAI Intake v1.72.33 — missing privacy-source guard

## Release boundary

Private Preview candidate only. Production remains v1.72.23 on `main`. This
candidate does not change delivery, email, credentials, AI enablement, access
settings, or wider tester access.

## Corrective scope

The v1.72.32 review found that a direct or older DNA request missing
`privacyScanText` would not heuristically detect third-party names. v1.72.33
fails closed instead:

- DNA generation returns a privacy-review response before an AI request when
  its participant privacy source is missing or empty.
- Admin recovery records the missing-source privacy proof and stops before an
  AI request when no recovered answer source exists.
- A bare owner first name sets the ambiguity marker only when it actually
  occurs in participant text.
- A detected name part that is also an allow-listed month is not replaced in
  ordinary month usage.

## Release gate

Do not widen testers until the standalone v1.72.33 Claude packet confirms the
I-A path is closed. Detection remains heuristic and is not a claim of perfect
identity detection or a legal privacy conclusion.
