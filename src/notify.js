const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

async function sendDigest(items) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID — skipping notify');
    return;
  }

  if (items.length === 0) return;

  const lines = items.map((item) =>
    `📰 <b>${escapeHtml(item.source)}</b>\n${escapeHtml(item.title)}\n${item.url}`
  );

  const text = `🥃 <b>Whisky News — ${items.length} nuovi articoli</b>\n\n` + lines.join('\n\n');

  // Telegram max message length is 4096 chars — split if needed
  const chunks = splitMessage(text, 4096);

  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:                  CHAT_ID,
        text:                     chunk,
        parse_mode:               'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API ${res.status}: ${body}`);
    }
  }
}

function splitMessage(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    chunks.push(remaining.slice(0, maxLen));
    remaining = remaining.slice(maxLen);
  }
  return chunks;
}

function escapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')   // decode first to avoid double-encoding
    .replace(/&#[0-9]+;/g, (m) => { try { return new DOMParser ? m : decodeHtmlEntity(m); } catch { return decodeHtmlEntity(m); } })
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtmlEntity(entity) {
  const code = parseInt(entity.slice(2, -1), 10);
  return isNaN(code) ? entity : String.fromCharCode(code);
}

module.exports = { sendDigest };
