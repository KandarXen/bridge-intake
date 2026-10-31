# v1.72.30 identity-redaction claims inventory

This inventory records the client-facing privacy wording changed for the identity-redaction standard. It is an engineering record, not legal advice; Canadian privacy counsel must approve final policy wording before broader use.

| Location | Previous wording | v1.72.30 wording |
| --- | --- | --- |
| `privacy.html`, AI processing section | Identifying details may be tokenized where practical. | Identifiers the system can detect are replaced before AI analysis; detection is heuristic and may not catch every name. |
| Paid report privacy statement | Direct identifiers are removed or replaced where practical. | Detected identifiers, such as names, business names, emails, phone numbers and links, are replaced with placeholders before AI analysis and restored in the report. |
| Brief privacy certificate | Anonymized AI analysis step. | Identifiers replaced before AI analysis (where detected), with a separate report-stage row. |
| Detailed privacy certificate | Anonymized AI analysis. | Identifiers replaced before AI analysis (where detected); report-stage redaction is shown independently. |

The free-report partner aggregate note remains unchanged: raw interview records and individual answers are not shared with partners.
