const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');

chromium.use(stealth());

const SCRAPE_SOURCES = [
  { name: 'Dramface',      url: 'https://www.dramface.com/news' },
  { name: 'Bruichladdich', url: 'https://www.bruichladdich.com/blogs/news' },
  { name: 'Ardbeg',        url: 'https://www.ardbeg.com/en-gb/news' },
  { name: 'Laphroaig',     url: 'https://www.laphroaig.com/en/news' },
  { name: 'Lagavulin',     url: 'https://www.malts.com/en-gb/distilleries/lagavulin/news' },
  { name: 'CaolIla',       url: 'https://www.malts.com/en-gb/distilleries/caol-ila/news' },
  { name: 'Bowmore',       url: 'https://www.bowmore.com/news' },
  { name: 'Kilchoman',     url: 'https://www.kilchomandistillery.com/news' },
  { name: 'Bunnahabhain',  url: 'https://bunnahabhain.com/blogs/news' },
  { name: 'Ardnahoe',      url: 'https://www.ardnahoedistillery.com/news' },
  { name: 'PortEllen',     url: 'https://www.portellenwhisky.com/news' },
];

const SELECTORS = [
  'article a',
  'h2 a',
  'h3 a',
  '.news-item a',
  '.blog-card a',
  '.post-title a',
];

async function extractArticles(page) {
  for (const selector of SELECTORS) {
    const elements = await page.$$(selector);
    if (elements.length === 0) continue;

    const items = await Promise.all(
      elements.map(async (el) => {
        const title = (await el.textContent() || '').trim();
        const href  = await el.getAttribute('href') || '';
        return { title, href };
      })
    );

    const valid = items.filter((i) =>
      i.title.length > 5 && i.href && !i.href.includes('/products/')
    );
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
