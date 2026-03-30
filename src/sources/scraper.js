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

async function extractTitle(el) {
  return el.evaluate((node) => {
    // 1. Cerca heading dentro il link (Shopify card che wrappa titolo + metadati)
    const heading = node.querySelector('h1, h2, h3, h4, h5');
    if (heading) {
      const t = heading.textContent.trim();
      if (t.length > 5) return t;
    }
    // 2. "Learn More" / "Read More" → risale all'article padre per trovare il titolo
    const raw = node.textContent.trim();
    if (/^(learn|read) more$/i.test(raw)) {
      const parent = node.closest('article') ||
                     node.closest('[class*="card"]') ||
                     node.closest('[class*="item"]') ||
                     node.closest('li');
      if (parent) {
        const h = parent.querySelector('h1, h2, h3, h4, h5, [class*="title"]');
        if (h) return h.textContent.trim();
      }
    }
    // 3. Prima riga significativa (esclude metadati come "7 mins", "Read More", categorie corte)
    const lines = raw.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 10 && !/^(\d+\s*(min|sec|mins|secs)|read more|learn more)$/i.test(l));
    return lines[0] || '';
  });
}

async function extractArticles(page) {
  for (const selector of SELECTORS) {
    const elements = await page.$$(selector);
    if (elements.length === 0) continue;

    const items = await Promise.all(
      elements.map(async (el) => {
        const title = await extractTitle(el);
        const href  = await el.getAttribute('href') || '';
        return { title, href };
      })
    );

    const seen = new Set();
    const hrefPattern = selector.includes('[href*=')
      ? selector.match(/\[href\*="([^"]+)"\]/)?.[1]
      : null;

    const valid = items.filter((i) => {
      if (i.title.length <= 5 || !i.href) return false;
      if (i.href.includes('/products/')) return false;
      if (hrefPattern && i.href.replace(/\/$/, '') === hrefPattern) return false;
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
      source:  source.name,
      filter:  false,
      title:   i.title,
      url:     resolveUrl(i.href, source.url),
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
