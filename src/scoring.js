export function scoreLead(lead) {
  let score = 0;
  const reasons = [];
  const text = `${lead.aboutSnippet || ''} ${lead.leadType || ''}`.toLowerCase();

  const strongTerms = [
    'coliving',
    'student housing',
    'residencia estudiantes',
    'alquiler habitaciones',
    'shared living',
    'relocation',
    'young professionals',
    'students',
    'flexible stay',
  ];

  const supportTerms = [
    'community',
    'managed',
    'rooms',
    'habitaciones',
    'furnished',
    'professionals',
    'students',
    'medium-term',
  ];

  if (lead.emails?.length) {
    score += 15;
    reasons.push('Tiene email público');
  }
  if (lead.phones?.length) {
    score += 8;
    reasons.push('Tiene teléfono público');
  }
  if (lead.linkedinUrl) {
    score += 5;
    reasons.push('Tiene LinkedIn');
  }
  if (lead.contactPage) {
    score += 5;
    reasons.push('Tiene página de contacto');
  }
  if (lead.city) {
    score += 8;
    reasons.push(`Opera o menciona ${lead.city}`);
  }

  for (const term of strongTerms) {
    if (text.includes(term)) {
      score += 10;
      reasons.push(`Match fuerte: ${term}`);
    }
  }

  for (const term of supportTerms) {
    if (text.includes(term)) score += 3;
  }

  if (lead.leadType && lead.leadType !== 'other') {
    score += 10;
    reasons.push(`Tipo detectado: ${lead.leadType}`);
  }

  score = Math.min(score, 100);

  return {
    fitScore: score,
    whyFit: [...new Set(reasons)].slice(0, 6).join(' | '),
  };
}
