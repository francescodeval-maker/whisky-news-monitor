# whisky-news-monitor

Monitor automatico di notizie dal mondo whisky (focus Islay/peated).
Gira ogni 6 ore su GitHub Actions e invia notifiche Telegram per ogni articolo nuovo.

## Sorgenti monitorate

### RSS (con keyword filter)
- WhiskyIntelligence
- TheWhiskeyWash
- WhiskyForEveryone
- TheSpiritsBusiness

### RSS (pass-through)
- Kilchomania

### Scraping Playwright (pass-through — distillerie Islay)
- Dramface
- Bruichladdich, Ardbeg, Laphroaig, Lagavulin, Caol Ila
- Bowmore, Kilchoman, Bunnahabhain, Ardnahoe, Port Ellen

## Setup

```bash
git clone https://github.com/francescodeval-maker/whisky-news-monitor
cd whisky-news-monitor
npm install
npx playwright install chromium
```

### Secrets GitHub Actions necessari

Vai in **Settings → Secrets → Actions** e aggiungi:

| Nome                 | Valore                        |
|----------------------|-------------------------------|
| `TELEGRAM_BOT_TOKEN` | token del bot Telegram        |
| `TELEGRAM_CHAT_ID`   | chat ID dove ricevere i messaggi |

Gli stessi secrets già configurati in `ttb-islay-monitor`.

### Run locale

```bash
TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node src/index.js
```

## Come funziona

1. Fetch RSS + scraping Playwright in parallelo
2. Keyword filter sulle sorgenti con `filter: true`
3. Deduplicazione via SQLite (`data/seen.db`)
4. Notifica Telegram per ogni item nuovo
5. `seen.db` committato nel repo dopo ogni run → persiste tra le run su Actions
