import { chromium, type Browser } from 'playwright';
import { randomUUID, createHash } from 'node:crypto';
import { createEgressProxy } from './proxy.js';
import { validateUrl, resolvePublic } from './security.js';
import { extract, compare, words, bodyText } from './extract.js';
import type { Arrival, Report, Script, IncompleteScript } from '../shared/types.js';
export async function analyze(input: string, observationMs = 3000): Promise<Report> {
  const url = validateUrl(input);
  await resolvePublic(url.hostname);
  const proxy = await createEgressProxy();
  let browser: Browser | undefined;
  const deadline = setTimeout(() => {
    proxy.close();
    void browser?.close();
  }, 40000);
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: { server: proxy.url, bypass: '<-loopback>' },
      args: [
        '--disable-dev-shm-usage',
        '--disable-quic',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    await context.route('**/*', async (route) => {
      try {
        validateUrl(route.request().url());
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    const errors: string[] = [];
    const warnings: string[] = [];
    const scripts: Script[] = [];
    page.on('pageerror', (e) => {
      if (errors.length < 30) errors.push(e.message.slice(0, 500));
    });
    context.on('page', (p) => {
      if (p !== page) void p.close();
    });
    await page.addInitScript(() => {
      const selectors: Record<string, [string, string | null]> = {
        title: ['title', null],
        description: ['meta[name="description" i]', 'content'],
        canonical: ['link[rel~="canonical" i]', 'href'],
        robots: ['meta[name="robots" i]', 'content'],
        h1: ['h1', null],
        links: ['a[href]', 'href'],
        structuredData: ['script[type="application/ld+json" i]', null],
      };
      const events: { field: string; at: number; value: string[] }[] = [];
      const previous: Record<string, string> = {};
      const sample = () => {
        for (const [field, [selector, attr]] of Object.entries(selectors)) {
          const value = Array.from(document.querySelectorAll(selector))
            .map((e) => (attr ? e.getAttribute(attr) : e.textContent)?.trim() ?? '')
            .filter(
              (v) =>
                v && (field !== 'links' || !/^\s*(?:#|(?!https?:)[a-z][a-z0-9+.-]*:)/i.test(v)),
            );
          const key = JSON.stringify(value);
          if (key !== previous[field] && (previous[field] !== undefined || value.length)) {
            if (events.length < 500)
              events.push({
                field,
                at: Math.round(performance.now()),
                value: value.slice(0, 500).map((s) => s.slice(0, 20000)),
              });
          }
          previous[field] = key;
        }
      };
      new MutationObserver(sample).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      sample();
      Object.defineProperty(window, '__renderview', { value: events });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    const pending = new Map<string, Script>();
    const failed: IncompleteScript[] = [];
    let origin = 0;
    cdp.on('Network.requestWillBeSent', (e) => {
      if (e.type === 'Document' && !origin) origin = e.timestamp;
      if (e.type === 'Script' && pending.size < 300)
        pending.set(e.requestId, {
          url: e.request.url,
          bytes: 0,
          duration: 0,
          start: Math.max(0, Math.round((e.timestamp - origin) * 1000)),
          thirdParty: new URL(e.request.url).hostname !== url.hostname,
          initiator: e.initiator.stack?.callFrames?.[0]?.url || e.initiator.url || e.initiator.type,
          status: 0,
        });
    });
    cdp.on('Network.responseReceived', (e) => {
      const s = pending.get(e.requestId);
      if (s) s.status = e.response.status;
    });
    cdp.on('Network.loadingFinished', (e) => {
      const s = pending.get(e.requestId);
      if (s) {
        s.bytes = e.encodedDataLength;
        s.duration = Math.max(0, Math.round((e.timestamp - origin) * 1000) - s.start);
        scripts.push(s);
        pending.delete(e.requestId);
      }
    });
    cdp.on('Network.loadingFailed', (e) => {
      const s = pending.get(e.requestId);
      if (s) {
        failed.push({
          ...s,
          state: 'failed',
          error: e.errorText,
          duration: Math.max(0, Math.round((e.timestamp - origin) * 1000) - s.start),
        });
        warnings.push(`Script failed: ${s.url.slice(0, 250)} (${e.errorText})`);
        pending.delete(e.requestId);
      }
    });
    const started = Date.now();
    const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!response) throw new Error('The page did not return an HTML response.');
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers()['content-type'] ?? ''))
      throw new Error('This URL does not serve an HTML document.');
    const body = await response.body();
    if (body.length > 3 * 1024 * 1024) throw new Error('HTML exceeds the 3 MB report limit.');
    const rawHtml = body.toString('utf8');
    await page.waitForTimeout(observationMs);
    if (page.url() !== response.url())
      warnings.push(
        'The page navigated after its initial response; the DOM and timeline may describe a subsequent document.',
      );
    const renderedHtml = await page.content();
    if (Buffer.byteLength(renderedHtml) > 3 * 1024 * 1024)
      throw new Error('Rendered HTML exceeds the 3 MB report limit.');
    const timeline = await page.evaluate(
      () => (window as unknown as { __renderview: Arrival[] }).__renderview ?? [],
    );
    if (timeline.length >= 500) warnings.push('Timeline reached its 500-event cap.');
    if (pending.size)
      warnings.push(`${pending.size} script request(s) were still pending at capture.`);
    if (response.status() >= 400)
      warnings.push(`The main document returned HTTP ${response.status()}.`);
    warnings.push(...(proxy.warnings ?? []));
    const raw = extract(rawHtml),
      rendered = extract(renderedHtml),
      changes = compare(raw, rendered);
    const captureAt = await page.evaluate(() => performance.now());
    const incompleteScripts: IncompleteScript[] = [
      ...failed,
      ...Array.from(pending.values()).map((s) => ({
        ...s,
        state: 'pending' as const,
        duration: Math.max(0, Math.round(captureAt) - s.start),
      })),
    ];
    const rawText = bodyText(rawHtml),
      renderedText = bodyText(renderedHtml);
    return {
      content: {
        changed: rawText !== renderedText,
        textVersion: 'block-boundaries-v2',
        rawHash: createHash('sha256').update(rawText).digest('hex'),
        renderedHash: createHash('sha256').update(renderedText).digest('hex'),
        rawPreview: rawText.slice(0, 500),
        renderedPreview: renderedText.slice(0, 500),
      },
      id: randomUUID(),
      url: url.href,
      finalUrl: page.url(),
      createdAt: new Date().toISOString(),
      status: response.status(),
      duration: Date.now() - started,
      observationMs,
      rawHtml,
      renderedHtml,
      raw,
      rendered,
      changes,
      timeline,
      incompleteScripts,
      scripts: scripts.sort((a, b) => a.start - b.start),
      errors,
      warnings,
      headers: Object.fromEntries(
        Object.entries(response.headers()).filter(([k]) =>
          ['content-type', 'x-robots-tag', 'cache-control', 'location'].includes(k),
        ),
      ),
      metrics: {
        dependent: changes.filter((c) => c.status === 'added').length,
        changed: changes.filter((c) => c.status !== 'unchanged').length,
        scriptBytes: scripts.reduce((n, s) => n + s.bytes, 0),
        rawWords: words(rawHtml),
        renderedWords: words(renderedHtml),
      },
    };
  } finally {
    clearTimeout(deadline);
    try {
      await browser?.close();
    } finally {
      proxy.close();
    }
  }
}
