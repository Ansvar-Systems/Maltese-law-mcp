/**
 * Rate-limited HTTP fetch helpers for legislation.mt.
 *
 * Government portal policy for this project:
 * - 1-2s between requests
 * - explicit user agent
 * - retry on 429/5xx
 */

const USER_AGENT = 'Maltese-Law-MCP/1.0 (https://github.com/Ansvar-Systems/Maltese-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 1200;

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchTextResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

export interface FetchBufferResult {
  status: number;
  body: Buffer;
  contentType: string;
  url: string;
}

async function fetchWithRetry(url: string, accept: string, maxRetries = 3): Promise<Response> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': accept,
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}; retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
    }

    return response;
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

export async function fetchTextWithRateLimit(url: string, maxRetries = 3): Promise<FetchTextResult> {
  const response = await fetchWithRetry(url, 'text/html, text/plain, application/xhtml+xml, */*', maxRetries);
  const body = await response.text();
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type') ?? '',
    url: response.url,
  };
}

export async function fetchBufferWithRateLimit(url: string, maxRetries = 3): Promise<FetchBufferResult> {
  const response = await fetchWithRetry(url, 'application/pdf, application/octet-stream, */*', maxRetries);
  const body = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    body,
    contentType: response.headers.get('content-type') ?? '',
    url: response.url,
  };
}
