/**
 * Proxies Google News RSS for the web build, where browsers block the
 * cross-origin request. The native apps fetch the feed directly.
 */
export async function GET(request: Request) {
  const topic = new URL(request.url).searchParams.get('q')?.trim();
  if (!topic || topic.length > 80) {
    return new Response('Missing or invalid topic', { status: 400 });
  }
  const query = encodeURIComponent(`${topic} when:3d`);
  const upstream = await fetch(`https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`);
  if (!upstream.ok) {
    return new Response('News source unavailable', { status: 502 });
  }
  return new Response(await upstream.text(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
