import { isValidSpanishPhone, normalizeSpanishPhone } from './utils.js';

export function scoreLead(lead) {
  let score = 0;
  const reasons = [];
  const text = `${lead.aboutSnippet || ''} ${lead.listingTitle || ''}`.toLowerCase();

  if (lead.email) {
    score += 20;
    reasons.push('Tiene email público');
  }

  if (lead.phoneRaw) {
    const normalized = normalizeSpanishPhone(lead.phoneRaw);
    if (normalized && isValidSpanishPhone(normalized)) {
      lead.phoneNormalized = normalized;
      lead.isSpanishPhoneValid = true;
      score += 25;
      reasons.push('Teléfono español válido');
    } else {
      lead.phoneNormalized = null;
      lead.isSpanishPhoneValid = false;
    }
  } else {
    lead.phoneNormalized = null;
    lead.isSpanishPhoneValid = false;
  }

  if (lead.ownerLikely) {
    score += 25;
    reasons.push('Parece particular');
  }

  if (lead.agencyLikely) {
    score -= 40;
    reasons.push('Parece agencia');
  }

  if (lead.propertyType === 'room') {
    score += 10;
    reasons.push('Es habitación');
  }

  if (lead.propertyType === 'flat') {
    score += 8;
    reasons.push('Es piso');
  }

  if (lead.city) {
    score += 8;
    reasons.push(`Zona objetivo: ${lead.city}`);
  }

  if (text.includes('madrid') || text.includes('barcelona')) {
    score += 6;
  }

  score = Math.max(0, Math.min(score, 100));

  return {
    confidenceScore: score,
    whyQualified: [...new Set(reasons)].slice(0, 6).join(' | '),
  };
}
