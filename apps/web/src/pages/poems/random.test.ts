import { afterEach, describe, expect, it, vi } from 'vitest';

process.env['INTERNAL_API_URL'] = 'http://api.test';
process.env['INTERNAL_API_KEY'] = 'internal-key';

import { fakeContext } from '@/test/context';
import { failedBody } from '@/test/fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  return await import('./random');
}

describe('GET /poems/random', () => {
  it('redirects to the poem and is uncacheable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('abcd', { status: 200 }))
    );
    const { GET } = await load();
    const response = await GET(fakeContext({ url: 'https://qafiyah.com/poems/random' }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/poems/abcd');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('renders the 500 page in place when the API keeps failing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x', { status: 500 }))
    );
    const { GET } = await load();
    const response = await GET(fakeContext({ url: 'https://qafiyah.com/poems/random' }));
    expect(response.headers.get('location')).toBeNull();
    expect(await response.json()).toBe('/500');
  });

  it('retries a failed response body and redirects to the poem', async () => {
    const fetch = fetchWithFailedBodies(1);
    vi.stubGlobal('fetch', fetch);
    const { GET } = await load();
    const response = await GET(fakeContext({ url: 'https://qafiyah.com/poems/random' }));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/poems/abcd');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('renders the 500 page in place after all response bodies fail', async () => {
    const fetch = fetchWithFailedBodies(3);
    vi.stubGlobal('fetch', fetch);
    const { GET } = await load();
    const response = await GET(fakeContext({ url: 'https://qafiyah.com/poems/random' }));
    expect(response.headers.get('location')).toBeNull();
    expect(await response.json()).toBe('/500');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

function fetchWithFailedBodies(failures: number) {
  let calls = 0;
  return vi.fn(async () => {
    calls++;
    if (calls > failures) return new Response('abcd');
    return failedBody(new TypeError('Connection closed'));
  });
}
