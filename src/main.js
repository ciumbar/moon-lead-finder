import { Actor } from 'apify';
import { CheerioCrawler, RequestQueue, log } from 'crawlee';
import { getDomain } from 'tldts';
import { absoluteUrl, detectLeadType, extractEmails, extractPhones, normalizeWhitespace, shouldVisitLink } from './utils.js';
import { scoreLead } from './scoring.js';

await Actor.init();

const input = (await Actor.getInput()) || {};
const {
  cities = ['Madrid', 'Barcelona', 'Valencia'],
  countries = ['Spain'],
  keywords = ['coliving', 'alquiler habitaciones'],
  maxResultsPerQuery = 10,
  allowedDomains = [],
  maxPagesPerSite = 3,
} = input;

const requestQueue = await RequestQueue.open();
const seenDomains = new Set();
const visitedPages = new Map();

const normalizedAllowedDomains = new Set((allowedDomains || []).map((d) => d.replace(/^www\./, '').toLowerCase()));

function buildSearchUrls() {
  const urls = [];
  for (const city of cities) {
    for (const country of countries) {
      for (const keyword of keywords) {
        const q = encodeURIComponent(`${keyword} ${city} ${country}`);
        urls.push(`https://html.duckduckgo.com/html/?q=${q}`);
      }
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
        await requestQueue.addRequest({ url, userData: { label: 'SITE', rootDomain, seedUrl: url } });
      }
      return;
    }

    const bodyText = normalizeWhitespace($('body').text()).slice(0, 12000);
    const title = normalizeWhitespace($('title').text()) || request.loadedUrl || request.url;
    const rootDomain = request.userData.rootDomain || getRootDomain(request.url);
    const currentCount = visitedPages.get(rootDomain) || 0;
    visitedPages.set(rootDomain, currentCount + 1);

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

    const emails = extractEmails(bodyText);
    const phones = extractPhones(bodyText);
    const linkedinUrl =
      $('a[href*="linkedin.com/company"]').attr('href') ||
      $('a[href*="linkedin.com/in/"]').attr('href') ||
      $('a[href*="linkedin.com"]').attr('href') ||
      null;

    const lead = {
      companyName: title,
      website: request.loadedUrl || request.url,
      city: cities.find((c) => bodyText.toLowerCase().includes(c.toLowerCase())) || null,
      country: countries.find((c) => bodyText.toLowerCase().includes(c.toLowerCase())) || null,
      leadType: detectLeadType(bodyText),
      emails,
      phones,
      linkedinUrl,
      contactPage: candidateLinks[0] || null,
      aboutSnippet: bodyText.slice(0, 600),
      sourceUrl: request.url,
    };

    await Actor.pushData({
      ...lead,
      ...scoreLead(lead),
      crawledAt: new Date().toISOString(),
      pageType: label,
    });

    if ((visitedPages.get(rootDomain) || 0) >= maxPagesPerSite) return;

    for (const url of [...new Set(candidateLinks)].slice(0, maxPagesPerSite)) {
      await requestQueue.addRequest({ url, userData: { label: 'DETAIL', rootDomain, seedUrl: request.userData.seedUrl || request.url } });
    }
  },
  failedRequestHandler({ request }) {
    log.warning(`Fallo en ${request.url}`);
  },
});

await crawler.run();
await Actor.exit();
