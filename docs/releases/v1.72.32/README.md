# BTAI Intake v1.72.32 — identity-boundary corrective candidate

## Release boundary

Private Preview candidate only. Production remains v1.72.23 on `main`. This
candidate does not alter report delivery, email gates, credentials, AI
enablement, access controls, or wider tester access.

## Corrective scope

This candidate responds to the independent v1.72.31 review:

- A detected third-party name is tokenized in its full-name, first-name,
  surname, and all-caps forms.
- A bare owner first name is marked ambiguous rather than being restored as the
  owner. Declared people with an initial, such as `Darren M.`, keep a separate
  token.
- Multi-word known names match case-insensitively; a lower-case ordinary word
  does not become a name match.
- An explicitly empty participant-text value disables heuristic detection, so
  generated prompt headings cannot be mistaken for participant names.
- The report-map test now asserts draft-ID and output-type query scoping.

## Release gate

Do not widen testers until Claude independently reviews the complete v1.72.32
packet. This is a heuristic privacy layer, not a claim of perfect identity
detection or a legal privacy conclusion.
