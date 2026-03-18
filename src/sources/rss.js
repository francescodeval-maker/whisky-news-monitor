const { XMLParser } = require('fast-xml-parser');

const RSS_SOURCES = [
  { name: 'WhiskyIntelligence', url: 'https://www.whiskyintelligence.com/feed',                              filter: true  },
  { name: 'TheWhiskeyWash',     url: 'https://thewhiskeywash.com/feed',                                      filter: true  },
  { name: 'WhiskyForEveryone',  url: 'https://whiskyforeveryone.blogspot.com/feeds/posts/default',           filter: true  },
  { name: 'TheSpiritsBusiness', url: 'https://www.thespiritsbusiness.com/feed',                              filter: true  },
  { name: 'Kilchomania',        url: 'https://www.kilchomania.com/en/feed',                                   filter: false },
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

async function fetchRssSource(source) {
  const res = await fetch(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; whisky-news-monitor/1.0)' },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const xml = await res.text();
  const data = parser.parse(xml);

  const items =
    data?.rss?.channel?.item ||
    data?.feed?.entry ||
    [];

  const normalized = (Array.isArray(items) ? items : [items]).map((item) => ({
    source:      source.name,
    filter:      source.filter,
    title:       (item.title?.['#text'] || item.title || '').trim(),
    url:         item.link?.['@_href'] || item.link || item.guid?.['#text'] || item.guid || '',
    publishedAt: item.pubDate || item.published || item.updated || '',
  }));

  return normalized.filter((i) => i.title && i.url);
}

async function fetchAllRss() {
  const results = await Promise.allSettled(RSS_SOURCES.map(fetchRssSource));
  const items = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  [RSS] ${RSS_SOURCES[i].name}: ${r.value.length} items`);
      items.push(...r.value);
    } else {
      console.error(`  [RSS] ${RSS_SOURCES[i].name} FAILED: ${r.reason.message}`);
    }
  });

  return items;
}

module.exports = { fetchAllRss };
