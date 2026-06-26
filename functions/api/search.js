import { runSearch } from '../../lib/search-service.mjs';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const query = (url.searchParams.get('q') || '').trim();

  if (!query) {
    return Response.json(
      { error: '请输入搜索关键词，例如：Bose QuietComfort 或 Samsung Galaxy S26' },
      { status: 400 }
    );
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const data = await runSearch(query);
    const response = Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'CDN-Cache-Control': 'max-age=300',
      },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return Response.json({ error: error.message || '搜索失败' }, { status: 500 });
  }
}
