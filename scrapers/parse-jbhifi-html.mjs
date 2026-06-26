import { decodeHtml, parsePrice, stripHtml } from './utils.mjs';

const BASE = 'https://www.jbhifi.com.au';

function normalizeUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function parseJbhifiHtml(html) {
  const products = [];
  const seen = new Set();

  const cardPattern =
    /<a[^>]+href="(\/products\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]{0,1200}?(?:\$|AUD\s?)([\d,]+(?:\.\d{2})?)/gi;

  let match;
  while ((match = cardPattern.exec(html)) && products.length < 10) {
    const url = normalizeUrl(match[1]);
    if (!url || seen.has(url)) continue;

    const title = stripHtml(decodeHtml(match[2])).replace(/\s+/g, ' ').trim();
    const price = parsePrice(match[3]);
    if (!title || price == null) continue;

    seen.add(url);
    products.push({
      store: 'JB Hi-Fi',
      title,
      price,
      originalPrice: null,
      url,
      image: null,
      sku: url.split('/products/')[1]?.split('?')[0] || null,
      brand: null,
      available: true,
    });
  }

  if (products.length) return products;

  const linkPattern = /href="(\/products\/[^"#?]+)"/g;
  while ((match = linkPattern.exec(html)) && products.length < 10) {
    const url = normalizeUrl(match[1]);
    if (!url || seen.has(url)) continue;
    const handle = url.split('/products/')[1]?.split('?')[0];
    if (!handle) continue;

    seen.add(url);
    products.push({
      store: 'JB Hi-Fi',
      title: handle.replace(/-/g, ' '),
      price: null,
      originalPrice: null,
      url,
      image: null,
      sku: handle,
      brand: null,
      available: true,
    });
  }

  return products.filter((p) => p.price != null).slice(0, 10);
}
