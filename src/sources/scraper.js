const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

chromium.use(stealth());

const SCRAPE_SOURCES = [
  { name: 'Dramface',      url: 'https://www.dramface.com/news' },
  { name: 'Bruichladdich', url: 'https://www.bruichladdich.com/blogs/news' },
  { name: 'Ardbeg',        url: 'https://www.ardbeg.com/en-gb/news' },
  { name: 'Laphroaig',     url: 'https://www.laphroaig.com/en/news' },
  { name: 'MaltsCom',      url: 'https://www.malts.com/en-gb/distillery-stories-articles' },
  { name: 'Bowmore',       url: 'https://www.bowmore.com/news' },
  { name: 'Kilchoman',     url: 'https://www.kilchomandistillery.com/distillery_news/' },
  { name: 'Bunnahabhain',  url: 'https://bunnahabhain.com/blogs/news' },
  { name: 'PortEllen',     url: 'https://www.portellenwhisky.com/news' },
];

const SELECTORS = [
  'article a',
  'h2 a',
  'h3 a',
  '.news-item a',
  '.blog-card a',
  '.post-title a',
  'a[href*="/blogs/news/"]',
  'a[href*="/distillery_news/"]',
  'a[href*="/articles/"]',
];

// Stessa finestra temporale usata da rss.js
const CUTOFF_MS = 24 * 60 * 60 * 1000;

// Estrae tutti gli articoli dal DOM in un'unica evaluate() call.
// Ritorna array di { title, href, publishedAt } — publishedAt è stringa ISO o ''.
async function extractArticles(page) {
  for (const selector of SELECTORS) {
    const count = await page.$$eval(selector, (els) => els.length);
    if (count === 0) continue;

    const hrefPattern = selector.includes('[href*=')
      ? (selector.match(/\[href\*="([^"]+)"\]/)?.[1] || null)
      : null;

    const raw = await page.$$eval(selector, (elements) =>
      elements.map((el) => {
        // --- Titolo ---
        let title = '';
        const heading = el.querySelector('h1, h2, h3, h4, h5');
        if (heading && heading.textContent.trim().length > 5) {
          title = heading.textContent.trim();
        } else {
          const text = el.textContent.trim();
          if (/^(learn|read) more$/i.test(text)) {
            // "Learn More" link → cerca titolo nell'article padre
            const parent = el.closest('article') ||
                           el.closest('[class*="card"]') ||
                           el.closest('[class*="item"]') ||
                           el.closest('li');
            const h = parent?.querySelector('h1, h2, h3, h4, h5, [class*="title"]');
            title = h?.textContent.trim() || '';
          } else {
            // Prima riga significativa (esclude "7 mins", "Read More", ecc.)
            const lines = text.split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 10 && !/^(\d+\s*(min|sec|mins|secs)|read more|learn more)$/i.test(l));
            title = lines[0] || '';
          }
        }

        // --- Data pubblicazione ---
        const container = el.closest('article') ||
                          el.closest('[class*="card"]') ||
                          el.closest('[class*="item"]') ||
                          el.closest('li') ||
                          el.parentElement;
        const timeEl = container?.querySelector('time[datetime]') ||
                       el.querySelector('time[datetime]');
        const publishedAt = timeEl?.getAttribute('datetime') || '';

        return { title, href: el.getAttribute('href') || '', publishedAt };
      })
    );

    const cutoff = Date.now() - CUTOFF_MS;
    const seen = new Set();
    const valid = raw.filter((i) => {
      if (!i.title || i.title.length <= 5 || !i.href) return false;
      if (i.href.includes('/products/')) return false;
      if (hrefPattern && i.href.replace(/\/$/, '') === hrefPattern) return false;
      // Filtro data: se disponibile e più vecchio di 24h, scarta
      if (i.publishedAt) {
        const d = new Date(i.publishedAt).getTime();
        if (!isNaN(d) && d < cutoff) return false;
      }
      if (seen.has(i.href)) return false;
      seen.add(i.href);
      return true;
    });

    if (valid.length > 0) return { selector, items: valid };
  }
  return { selector: null, items: [] };
}

function resolveUrl(href, baseUrl) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

async function scrapeSource(browser, source) {
  const page = await browser.newPage();
  try {
    await page.goto(source.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const { selector, items } = await extractArticles(page);
    if (!selector) {
      console.warn(`  [Scraper] ${source.name}: no selector matched`);
      return [];
    }

    return items.map((i) => ({
      source:      source.name,
      filter:      false,
      title:       i.title,
      url:         resolveUrl(i.href, source.url),
      publishedAt: i.publishedAt,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}

async function scrapeAll() {
  const browser = await chromium.launch({ headless: true });
  const items = [];

  try {
    const results = await Promise.allSettled(
      SCRAPE_SOURCES.map((s) => scrapeSource(browser, s))
    );

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`  [Scraper] ${SCRAPE_SOURCES[i].name}: ${r.value.length} items`);
        items.push(...r.value);
      } else {
        console.error(`  [Scraper] ${SCRAPE_SOURCES[i].name} FAILED: ${r.reason.message}`);
      }
    });
  } finally {
    await browser.close().catch(() => {});
  }

  return items;
}

module.exports = { scrapeAll };
