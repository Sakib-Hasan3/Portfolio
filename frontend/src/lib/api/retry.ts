/**
 * Fetch that waits for a sleeping upstream.
 *
 * On Render's free plan the API goes to sleep when idle and answers 502/503 (or refuses the connection) for 30-60 s
 * while it wakes. Instead of failing the page straight away, retry with a growing delay for up to `budgetMs`.
 * Idempotent requests (GET/HEAD) are also retried after a network error; other methods are retried only after a
 * 502/503/504 response, which means the request was never processed.
 */
const WAKING = new Set([502, 503, 504]);

export async function fetchWithRetry(url: string, init: RequestInit = {}, budgetMs = 55_000): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const idempotent = method === "GET" || method === "HEAD";
  const started = Date.now();
  let delay = 1500;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (!WAKING.has(res.status)) return res;
      if (Date.now() - started + delay > budgetMs) return res;
    } catch (err) {
      if (!idempotent || Date.now() - started + delay > budgetMs) throw err;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.6, 8000);
  }
}
