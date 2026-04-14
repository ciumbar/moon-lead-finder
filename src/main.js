import { Actor } from 'apify';
import { CheerioCrawler, RequestQueue, log } from 'crawlee';
import { getDomain } from 'tldts';
import {
  absoluteUrl,
  detectAgency,
  detectOwnerLikely,
  detectPropertyType,
  extractEmails,
  extractPhones,
  normalizeWhitespace,
  shouldVisitLink,
} from './utils.js';
import { scoreLead } from './scoring.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  regions = ['Madrid', 'Barcelona', 'Comunidad de Madrid', 'Área Metropolitana de Barcelona'],
  propertyTypes = ['room', 'flat'],
  ownerOnly = true,
  requireEmailOrPhone = true,
  requireSpanishPhone = true,
  maxResultsPerQuery = 20,
  maxPagesPerSite = 3,
  allowedDomains = [],
} = input;

const requestQueue = await RequestQueue.open();
const seenDomains = new Set();
const visitedPages = new Map();
const seenListings = new Set();
const normalizedAllowedDomains = new Set((allowedDomains || []).map((d) => d.replace(/^www\./, '').toLowerCase()));

function buildSearchUrls() {
  const baseKeywords = [
    'habitacion alquiler particular',
    'habitación alquiler particular',
    'piso alquiler propietario',
    'directo propietario piso',
    'sin agencia habitacion',
    'sin agencia piso',
  ];

  const urls = [];
  for (const region of regions) {
    for (const keyword of baseKeywords) {
      urls.push(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${keyword} ${region}`)}`);
    }
  }
  return urls;
}

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
  if (!normalizedAllowedDomains.size) return true;
  return normalizedAllowedDomains.has(root) || normalizedAllowedDomains.has(`www.${root}`);
}

for (const url of buildSearchUrls()) {
  await requestQueue.addRequest({ url, userData: { label: 'SEARCH' } });
}

const crawler = new CheerioCrawler({
  requestQueue,
  maxConcurrency: 8,
  async requestHandler({ request, $ }) {
    const label = request.userData.label;

    if (label === 'SEARCH') {
      const links = [];
      $('a.result__a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) links.push(href);
      });

      for (const url of links.slice(0, maxResultsPerQuery)) {
        const rootDomain = getRootDomain(url);
        if (!rootDomain || seenDomains.has(rootDomain) || !domainAllowed(url)) continue;
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

    const emails = extractEmails(pageText);
    const phones = extractPhones(pageText);
    const propertyType = detectPropertyType(pageText);
    const ownerLikely = detectOwnerLikely(pageText);
    const agencyLikely = detectAgency(pageText);
    const city = regions.find((c) => pageText.toLowerCase().includes(c.toLowerCase())) || null;

    const lead = {
      listingTitle: title,
      listingUrl: request.loadedUrl || request.url,
      city,
      district: null,
      region: city,
      propertyType,
      price: null,
      contactName: null,
      email: emails[0] || null,
      phoneRaw: phones[0] || null,
      phoneNormalized: null,
      isSpanishPhoneValid: false,
      ownerLikely,
      agencyLikely,
      aboutSnippet: pageText.slice(0, 500),
      sourceUrl: request.url,
    };

    const scoring = scoreLead(lead);
    const listingKey = `${lead.listingUrl}|${lead.email || ''}|${lead.phoneRaw || ''}`;

    const propertyTypeOk = propertyTypes.includes(lead.propertyType);
    const hasContact = Boolean(lead.email || lead.phoneRaw);
    const spanishPhoneOk = !requireSpanishPhone || !lead.phoneRaw || lead.isSpanishPhoneValid;
    const ownerOk = !ownerOnly || (lead.ownerLikely && !lead.agencyLikely);

    if (!seenListings.has(listingKey) && propertyTypeOk && (!requireEmailOrPhone || hasContact) && spanishPhoneOk && ownerOk) {
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
      if (!abs || !domainAllowed(abs) || getRootDomain(abs) !== rootDomain) return;
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
