const { fetchAllRss } = require('./sources/rss');
const { scrapeAll }   = require('./sources/scraper');
const { applyFilter } = require('./filter');
const { isNew, markSeen } = require('./dedup');
const { sendTelegram } = require('./notify');

// Playwright emits unhandled rejections on page/browser close — ignore them
process.on('unhandledRejection', (reason) => {
  console.warn('[unhandledRejection]', reason?.message || reason);
});

async function main() {
  console.log('=== Whisky News Monitor ===');

  // 1. Fetch all sources in parallel
  console.log('\n[1] Fetching sources...');
  const [rssResult, scraperResult] = await Promise.allSettled([
    fetchAllRss(),
    scrapeAll(),
  ]);

  const rssItems     = rssResult.status     === 'fulfilled' ? rssResult.value     : [];
  const scraperItems = scraperResult.status === 'fulfilled' ? scraperResult.value : [];

  if (rssResult.status     === 'rejected') console.error('[RSS overall error]', rssResult.reason);
  if (scraperResult.status === 'rejected') console.error('[Scraper overall error]', scraperResult.reason);

  const allItems = [...rssItems, ...scraperItems];
  console.log(`\n[2] Total items fetched: ${allItems.length} (RSS: ${rssItems.length}, Scraper: ${scraperItems.length})`);

  // 2. Apply keyword filter
  const filtered = applyFilter(allItems);
  console.log(`[3] After keyword filter: ${filtered.length} items`);

  // 3. Dedup + notify
  console.log('[4] Checking for new items...');
  let newCount = 0;

  for (const item of filtered) {
    if (!isNew(item)) continue;

    newCount++;
    console.log(`  NEW: [${item.source}] ${item.title}`);

    try {
      await sendTelegram(item);
    } catch (err) {
      console.error(`  Telegram error for "${item.title}": ${err.message}`);
    }

    markSeen(item);
  }

  console.log(`\n=== Done. New items: ${newCount} ===`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
