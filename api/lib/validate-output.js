export function validateDnaOutput(text, context = {}) {
  const output = String(text || '');
  const unresolvedPlaceholders = output.match(/\[(?:OWNER_NAME|BUSINESS_NAME|WEBSITE_URL|EMAIL_\d+|PHONE_\d+|URL_\d+|FINANCIAL_ACCOUNT_\d+)\]/g) || [];
  const evidenceLabels = output.match(/\b(Client-stated|Derived|Inferred|Needs confirmation)\b/g) || [];
  const warnings = [];
  const claims = [];
  let currentSection = '';

  output.split(/\r?\n/).forEach(line => {
    const sectionMatch = line.match(/^#{2,4}\s+(.+)/);
    if (sectionMatch) currentSection = sectionMatch[1].trim().slice(0, 160);
    const evidenceMatch = line.match(/\b(Client-stated|Derived|Inferred|Needs confirmation)\b/);
    if (evidenceMatch && line.trim().length > evidenceMatch[1].length) {
      claims.push({
        reportSection: currentSection || 'Unsectioned',
        evidenceType: evidenceMatch[1],
        claimText: line.trim().slice(0, 1200)
      });
    }
  });

  if (unresolvedPlaceholders.length) {
    warnings.push('Output contains unresolved Hermes privacy placeholders.');
  }
  if (evidenceLabels.length < 5) {
    warnings.push('Output has limited evidence labels; report claims may need stronger traceability.');
  }
  if (context.soloOrNoStaff && /\b(staff|employees|team members|departments)\b/i.test(output)) {
    warnings.push('Output references staff/team language even though intake context suggests solo/no-staff.');
  }

  return {
    passed: unresolvedPlaceholders.length === 0,
    unresolvedPlaceholders: Array.from(new Set(unresolvedPlaceholders)),
    evidenceLabelCount: evidenceLabels.length,
    claims: claims.slice(0, 200),
    warnings
  };
}
