import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';
// Test-only synthetic proxy: browser executes real HTML/JS through a local
// fixture. No production escape hatch for private-network destinations exists.
vi.mock('../server/security.js', async () => {
  const actual =
    await vi.importActual<typeof import('../server/security.js')>('../server/security.js');
  return { ...actual, resolvePublic: async () => ({ address: '93.184.216.34', family: 4 }) };
});
vi.mock('../server/proxy.js', () => ({
  createEgressProxy: async () => {
    const server = http.createServer((req, res) => {
      if (req.url?.includes('/slow.js')) {
        return;
      }
      if (req.url?.includes('/fail.js')) {
        res.destroy();
        return;
      }
      if (req.url?.includes('/app.js')) {
        res.setHeader('content-type', 'application/javascript');
        res.end(
          `for(const name of ['slow','fail']){const script=document.createElement('script');script.src='http://fixture.example/'+name+'.js';script.async=true;document.head.append(script);}setTimeout(()=>{document.title='Rendered title';document.body.insertAdjacentHTML('beforeend','<h1>Late heading</h1><a href="/shop">Shop</a>');const meta=document.createElement('meta');meta.name='description';meta.content='Added by JavaScript';document.head.append(meta);},150);`,
        );
      } else {
        res.setHeader('content-type', 'text/html');
        res.end(
          '<!doctype html><html><head><title>Source title</title><link rel="canonical" href="https://fixture.example/"></head><body><p>Source body</p><script src="http://fixture.example/app.js"></script></body></html>',
        );
      }
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    return {
      url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
      close: () => {
        server.closeAllConnections();
        server.close();
      },
    };
  },
}));
import { analyze } from '../server/analyze.js';
describe('real Chromium capture', () => {
  it('preserves response HTML, observes late SEO mutations, and traces script transfer', async () => {
    const report = await analyze('http://fixture.example/', 1000);
    expect(report.raw.title).toEqual(['Source title']);
    expect(report.rendered.title).toEqual(['Rendered title']);
    expect(report.raw.h1).toEqual([]);
    expect(report.rendered.h1).toEqual(['Late heading']);
    expect(report.changes.find((c) => c.field === 'description')?.status).toBe('added');
    expect(
      report.timeline.some((t) => t.field === 'h1' && t.at >= 100 && t.value[0] === 'Late heading'),
    ).toBe(true);
    expect(
      report.scripts.some(
        (s) =>
          s.url.endsWith('/app.js') && s.bytes > 0 && s.initiator === 'http://fixture.example/',
      ),
    ).toBe(true);
    expect(report.incompleteScripts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'http://fixture.example/slow.js', state: 'pending' }),
        expect.objectContaining({ url: 'http://fixture.example/fail.js', state: 'failed' }),
      ]),
    );
    expect(report.content?.renderedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.content?.rawHash).not.toBe(report.content?.renderedHash);
    expect(report.rawHtml).not.toContain('<h1>Late heading</h1>');
    expect(report.renderedHtml).toContain('<h1>Late heading</h1>');
  }, 20000);
});
