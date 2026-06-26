import { BROWSER_HEADERS, fetchText, parsePrice } from './utils.mjs';
import { parseJbhifiHtml } from './parse-jbhifi-html.mjs';

const BASE = 'https://www.jbhifi.com.au';
const JSON_HEADERS = {
  ...BROWSER_HEADERS,
  Accept: 'application/json, text/plain, */*',
  Referer: `${BASE}/`,
};

function mapJsonItems(items) {
  return items.map((item) => ({
    store: 'JB Hi-Fi',
    title: item.title,
    price: parsePrice(item.price),
    originalPrice: parsePrice(item.compare_at_price_max || item.compare_at_price_min),
    url: item.url?.startsWith('http') ? item.url : `${BASE}${item.url}`,
    image: item.image || item.featured_image?.url || null,
    sku: item.handle,
    brand: item.vendor || null,
    available: item.available !== false,
  }));
}

async function fetchSuggestJson(query, limit) {
  const url = `${BASE}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=${Math.min(limit, 10)}`;
  return fetchText(url, JSON_HEADERS, 12000);
}

async function fetchSearchHtml(query) {
  const url = `${BASE}/search?q=${encodeURIComponent(query)}`;
  return fetchText(url, { ...BROWSER_HEADERS, Referer: `${BASE}/` }, 12000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function searchJbhifi(query, limit = 10) {
  let result = await fetchSuggestJson(query, limit);

  if (result.status === 429) {
    const delayMs = Math.min((result.retryAfter || 2) * 1000, 5000);
    await wait(delayMs);
    result = await fetchSuggestJson(query, limit);
  }

  if (result.ok) {
    try {
      const data = JSON.parse(result.text);
      const items = data?.resources?.results?.products || [];
      if (items.length) {
        return { store: 'JB Hi-Fi', products: mapJsonItems(items), error: null, blocked: false, via: 'json' };
      }
    } catch {
      // fall through to HTML
    }
  }

  if (result.status === 429 || !result.ok) {
    const htmlResult = await fetchSearchHtml(query);
    if (htmlResult.ok) {
      const products = parseJbhifiHtml(htmlResult.text);
      if (products.length) {
        return {
          store: 'JB Hi-Fi',
          products,
          error: null,
          blocked: false,
          via: 'html-fallback',
        };
      }
    }

    const cloudHint =
      process.env.CF_PAGES === '1' || process.env.VERCEL === '1'
        ? ' JB Hi-Fi 对云端 IP 限流较严，本地运行通常更稳定。'
        : '';

    return {
      store: 'JB Hi-Fi',
      products: [],
      error: `HTTP ${result.status || htmlResult?.status || 'error'}（请求过于频繁）${cloudHint}`,
      blocked: result.status === 429,
    };
  }

  return { store: 'JB Hi-Fi', products: [], error: 'Invalid JSON response', blocked: false };
}
