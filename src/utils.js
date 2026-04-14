export function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractEmails(text = '') {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches)].slice(0, 10);
}

export function extractPhones(text = '') {
  const matches = text.match(/(?:(?:\+34|0034)\s?)?[6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g) || [];
  return [...new Set(matches.map((m) => m.trim()))].slice(0, 10);
}

export function normalizeSpanishPhone(phone = '') {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('0034') && digits.length === 13) {
    return `+${digits.slice(2)}`;
  }

  if (digits.startsWith('34') && digits.length === 11) {
    return `+${digits}`;
  }

  if (/^[6789]\d{8}$/.test(digits)) {
    return `+34${digits}`;
  }

  return null;
}

export function isValidSpanishPhone(phone = '') {
  const normalized = normalizeSpanishPhone(phone);
  return /^\+34[6789]\d{8}$/.test(normalized || '');
}

export function detectPropertyType(text = '') {
  const t = text.toLowerCase();
  if (t.includes('habitación') || t.includes('habitacion') || t.includes('room')) return 'room';
  if (t.includes('piso') || t.includes('apartamento') || t.includes('flat') || t.includes('vivienda')) return 'flat';
  return 'other';
}

export function detectAgency(text = '') {
  const t = text.toLowerCase();
  const agencyTerms = [
    'inmobiliaria',
    'agencia',
    'real estate',
    'asesores inmobiliarios',
    'gestión inmobiliaria',
    'gestion inmobiliaria',
    'broker',
    'api',
    'property manager',
    'property management'
  ];
  return agencyTerms.some((term) => t.includes(term));
}

export function detectOwnerLikely(text = '') {
  const t = text.toLowerCase();
  const ownerTerms = [
    'particular',
    'propietario',
    'sin agencia',
    'directo propietario',
    'trato directo',
    'particular alquila'
  ];
  return ownerTerms.some((term) => t.includes(term));
}

export function absoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function shouldVisitLink(anchorText = '', href = '') {
  const t = `${anchorText} ${href}`.toLowerCase();
  return [
    'contact', 'contacto', 'about', 'sobre', 'nosotros', 'team', 'habitacion',
    'habitación', 'room', 'piso', 'flat', 'alquiler', 'particular', 'propietario'
  ].some((term) => t.includes(term));
}
