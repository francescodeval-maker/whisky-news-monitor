const KEYWORDS = [
  // Islay distilleries
  'ardbeg', 'laphroaig', 'lagavulin', 'caol ila', 'bowmore',
  'bruichladdich', 'octomore', 'port charlotte',
  'kilchoman', 'bunnahabhain', 'ardnahoe', 'port ellen',
  // Other peated
  'longrow', 'highland park', 'talisker',
  // Generic peated terms
  'peated', 'heavily peated', 'islay',
];

// Distilleries that are NOT peated — block even if title matches a keyword
const BLOCKLIST = [
  'glenmorangie', 'glenfiddich', 'macallan', 'glenlivet',
  'dalmore', 'balvenie', 'glenfarclas', 'aberlour',
  'glenrothes', 'craigellachie', 'mortlach', 'benriach',
];

function matchesKeyword(title) {
  const lower = title.toLowerCase();
  if (BLOCKLIST.some((b) => lower.includes(b))) return false;
  return KEYWORDS.some((kw) => lower.includes(kw));
}

function applyFilter(items) {
  return items.filter((item) => {
    if (!item.filter) return true;
    return matchesKeyword(item.title);
  });
}

module.exports = { applyFilter };

