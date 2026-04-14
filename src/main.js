import { Actor } from 'apify';
import { CheerioCrawler, RequestQueue, log } from 'crawlee';
import { getDomain } from 'tldts';
import { absoluteUrl, detectAgency, detectOwnerLikely, detectPropertyType, extractEmails, extractPhones, normalizeWhitespace, shouldVisitLink } from './utils.js';
import { scoreLead } from './scoring.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  regions = ['Madrid', 'Barcelona', 'Comunidad de Madrid', 'Área Metropolitana de Barcelona'],
  propertyTypes = ['room', 'flat'],
  ownerOnly = false,
  requireEmailOrPhone = false,
  requireSpanishPhone = false,
  maxResultsPerQuery = 50,
  maxPagesPerSite = 5,
  allowedDomains = [],
  blockedDomains = ['idealista.com'],
} = input;

const requestQueue = await RequestQueue.open();
const seenDomains = new Set();
const visitedPages = new Map();
const seenListings = new Set();

const normalizedAllowedDomains = new Set((allowedDomains || []).map((d) => d.replace(/^www\./, '').toLowerCase()));
const normalizedBlockedDomains = new Set((blockedDomains || []).map((d) => d.replace(/^www\./, '').toLowerCase()));

function getRootDomain(url) {
  try {
    return getDomain(url) || new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function domainAllowed(url) {
  const root = getRootDomain(url);
  if (!root) return false;
  if (normalizedBlockedDomains.has(root) || normalizedBlockedDomains.has(`www.${root}`)) return false;
  if (!normalizedAllowedDomains.size) return true;
  return normalizedAllowedDomains.has(root) || normalizedAllowedDomains.has(`www.${root}`);
}

function buildSearchUrls() {
  const baseKeywords = [
    'habitacion alquiler particular',
    'habitación alquiler particular',
    'piso alquiler propietario',
    'directo propietario piso',
    'sin agencia habitacion',
    'sin agencia piso',
    'alquiler habitacion madrid particular',
    'alquiler piso barcelona particular',
    'room rent owner madrid',
    'flat rent owner barcelona',
  ];

  const urls = [];
  for (const region of regions) {
    for (const keyword of baseKeywords) {
      urls.push(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${keyword} ${region}`)}`);
    }
  }
  return urls;
}

for (const url of buildSearchUrls()) {
  await requestQueue.addRequest({ url, userData: { label: 'SEARCH' } });
}

const crawler = new CheerioCrawler({
  requestQueue,
  maxConcurrency: 8,
  additionalMimeTypes: ['text/plain'],
  async requestHandler({ request, $ }) {
    const label = request.userData.label;

    if (label === 'SEARCH') {
      const links = [];
      $('a.result__a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http') && domainAllowed(href)) links.push(href);
      });

      for (const url of links.slice(0, maxResultsPerQuery)) {
        const rootDomain = getRootDomain(url);
        if (!rootDomain || seenDomains.has(rootDomain)) continue;
        seenDomains.add(rootDomain);
        visitedPages.set(rootDomain, 0);
        await requestQueue.addRequest({ url, userData: { label: 'SITE', rootDomain } });
      }
      return;
    }

    const pageText = normalizeWhitespace($('body').text()).slice(0, 12000);
    const title = normalizeWhitespace($('title').text()) || 'Sin título';
    const rootDomain = request.userData.rootDomain || getRootDomain(request.url);
    visitedPages.set(rootDomain, (visitedPages.get(rootDomain) || 0) + 1);

    const lead = {
      listingTitle: title,
      listingUrl: request.loadedUrl || request.url,
      city: regions.find((c) => pageText.toLowerCase().includes(c.toLowerCase())) || null,
      district: null,
      region: null,
      propertyType: detectPropertyType(pageText),
      price: null,
      contactName: null,
      email: extractEmails(pageText)[0] || null,
      phoneRaw: extractPhones(pageText)[0] || null,
      phoneNormalized: null,
      isSpanishPhoneValid: false,
      ownerLikely: detectOwnerLikely(pageText),
      agencyLikely: detectAgency(pageText),
      hasContact: false,
      aboutSnippet: pageText.slice(0, 500),
      sourceUrl: request.url,
    };

    const scoring = scoreLead(lead);
    const listingKey = `${lead.listingUrl}|${lead.email || ''}|${lead.phoneRaw || ''}`;

    const propertyTypeOk = propertyTypes.includes(lead.propertyType) || lead.propertyType === 'other';
    const hasContactOk = !requireEmailOrPhone || lead.hasContact;
    const spanishPhoneOk = !requireSpanishPhone || !lead.phoneRaw || lead.isSpanishPhoneValid;
    const ownerOk = !ownerOnly || (lead.ownerLikely && !lead.agencyLikely);

    if (!seenListings.has(listingKey) && propertyTypeOk && hasContactOk && spanishPhoneOk && ownerOk) {
      seenListings.add(listingKey);
      await Actor.pushData({
        ...lead,
        ...scoring,
        crawledAt: new Date().toISOString(),
        pageType: label,
      });
    }

    if ((visitedPages.get(rootDomain) || 0) >= maxPagesPerSite) return;

    const candidateLinks = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const anchorText = normalizeWhitespace($(el).text());
      if (!href || !shouldVisitLink(anchorText, href)) return;
      const abs = absoluteUrl(request.loadedUrl || request.url, href);
      if (!abs || !domainAllowed(abs)) return;
      if (getRootDomain(abs) !== rootDomain) return;
      candidateLinks.push(abs);
    });

    for (const url of [...new Set(candidateLinks)].slice(0, maxPagesPerSite)) {
      await requestQueue.addRequest({ url, userData: { label: 'DETAIL', rootDomain } });
    }
  },
  failedRequestHandler({ request }) {
    log.warning(`Fallo en ${request.url}`);
  },
});

await crawler.run();
await Actor.exit();
