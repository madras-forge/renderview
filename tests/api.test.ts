import { describe, it, expect, afterEach, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from '../server/app.js';
import { demo } from '../src/demo.js';
import type { analyze } from '../server/analyze.js';
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});
async function start(runner: typeof analyze) {
  const server = createApp(runner).listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((r, reject) => {
    server.once('listening', r);
    server.once('error', reject);
  });
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
const post = (base: string, body: unknown) =>
  fetch(base + '/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
describe('API', () => {
  it('validates URL and window before launching Chromium', async () => {
    const runner = vi.fn();
    const base = await start(runner);
    expect((await post(base, { url: 'http://localhost' })).status).toBe(400);
    expect((await post(base, { url: 'https://example.com', observationMs: 999999 })).status).toBe(
      400,
    );
    expect(runner).not.toHaveBeenCalled();
  });
  it('returns a report and prevents response caching', async () => {
    const base = await start(async () => demo);
    const res = await post(base, { url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).id).toBe(demo.id);
  });
  it('fails cleanly and releases the concurrency slot', async () => {
    const runner = vi.fn().mockRejectedValueOnce(new Error('No HTML')).mockResolvedValue(demo);
    const base = await start(runner);
    expect((await post(base, { url: 'https://example.com' })).status).toBe(502);
    expect((await post(base, { url: 'https://example.com' })).status).toBe(200);
  });
  it('rejects overlapping jobs with Retry-After', async () => {
    let finish!: (value: typeof demo) => void;
    let entered!: () => void;
    const running = new Promise<void>((r) => (entered = r));
    const base = await start(() => {
      entered();
      return new Promise((r) => (finish = r));
    });
    const first = post(base, { url: 'https://example.com' });
    await running;
    const second = await post(base, { url: 'https://example.com' });
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBe('10');
    finish(demo);
    expect((await first).status).toBe(200);
  });
  it('handles malformed JSON and unknown API paths', async () => {
    const base = await start(async () => demo);
    expect((await fetch(base + '/api/nope')).status).toBe(404);
    const malformed = await fetch(base + '/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toHaveProperty('error');
  });
});
