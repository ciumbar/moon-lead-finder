export function normalizeWhitespace(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

export function extractEmails(text = '') {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches)].slice(0, 10);
}

export function extractPhones(text = '') {
  const matches = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  return [...new Set(matches.map((m) => m.trim()))].slice(0, 10);
}

export function detectLeadType(text = '') {
  const t = text.toLowerCase();
  if (t.includes('coliving')) return 'coliving';
  if (t.includes('student housing') || t.includes('residencia estudiantes') || t.includes('student residence')) return 'student_housing';
  if (t.includes('relocation')) return 'relocation';
  if (t.includes('property management') || t.includes('property manager') || t.includes('gestión') || t.includes('gestion')) return 'property_manager';
  if (t.includes('habitaciones') || t.includes('rooms for rent') || t.includes('room rental') || t.includes('alquiler habitaciones')) return 'room_rental';
  return 'other';
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
    'contact',
    'contacto',
    'about',
    'nosotros',
    'team',
    'empresa',
    'services',
    'locations',
    'rooms',
    'habitaciones',
    'coliving',
  ].some((term) => t.includes(term));
}
