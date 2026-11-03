import { it, expect } from 'vitest';
import { compareCaptures, comparisonMarkdown } from '../shared/capture-comparison';
import { demo } from '../src/demo';
import type { Report } from '../shared/types';
function pair(): [Report, Report] {
  const a = structuredClone(demo);
  a.sample = false;
  a.warnings = [];
  a.incompleteScripts = [];
  a.content = {
    changed: true,
    rawPreview: 'Initial',
    renderedPreview: 'Final',
    rawHash: 'raw',
    renderedHash: 'same',
  };
  const b = structuredClone(a);
  b.id = 'longer';
  b.observationMs = 10000;
  return [a, b];
}
it('detects equal-word-count body changes with fingerprints', () => {
  const [a, b] = pair();
  b.content!.renderedHash = 'different';
  const c = compareCaptures(a, b);
  expect(c.rows[0].changed).toBe(true);
  expect(c.verdict).toBe('Content differs in the longer capture');
});
it('provides evidence for newly arrived heading values', () => {
  const [a, b] = pair();
  a.rendered.h1 = [];
  const c = compareCaptures(a, b);
  expect(c.rows.find((r) => r.label === 'H1 headings')).toMatchObject({
    before: [],
    after: b.rendered.h1,
    changed: true,
  });
});
it('does not call a pending script unrelated analytics', () => {
  const [a, b] = pair();
  b.incompleteScripts = [{ ...b.scripts[0], state: 'pending' }];
  const c = compareCaptures(a, b);
  expect(c.verdict).toBe('Content stayed stable; capture limits remain');
  expect(c.nextStep).toContain('not established');
});
it('distinguishes completed URLs from URLs not observed on another visit', () => {
  const [a, b] = pair();
  a.incompleteScripts = [
    { ...a.scripts[0], state: 'pending' },
    {
      ...a.scripts[0],
      url: 'https://missing.example/script.js',
      state: 'failed',
      error: 'net::ERR_FAILED',
    },
  ];
  const c = compareCaptures(a, b);
  expect(c.scriptRows[0].after).toBe('completed · HTTP 200');
  expect(c.scriptRows[1].after).toBe('not observed');
  expect(c.scriptRows[1].before).toContain('ERR_FAILED');
});
it('discloses initial response variation rather than blaming wait time', () => {
  const [a, b] = pair();
  b.rawHtml += '<!-- personalized -->';
  b.rendered.title = ['Other'];
  const c = compareCaptures(a, b);
  expect(c.sourceVaried).toBe(true);
  expect(c.verdict).toBe('The page varied between visits');
});
it('rejects causal comparison when destinations or response statuses differ', () => {
  const [a, b] = pair();
  b.finalUrl = 'https://example.com/login';
  expect(compareCaptures(a, b).comparable).toBe(false);
  b.finalUrl = a.finalUrl;
  b.status = 403;
  expect(compareCaptures(a, b).comparable).toBe(false);
});
it('does not infer equal text from older equal-count captures', () => {
  const [a, b] = pair();
  delete a.content;
  expect(compareCaptures(a, b).rows[0].changed).toBe(null);
  expect(compareCaptures(a, b).verdict).toBe('Body-text comparison is limited');
});
it('exports comparison evidence and script states in developer handoff text', () => {
  const [a, b] = pair();
  b.comparison = compareCaptures(a, b);
  const text = comparisonMarkdown(b);
  expect(text).toContain('3s');
  expect(text).toContain('10s');
  expect(text).toContain('Captured content stayed stable');
  expect(text).toContain('Body text');
});
it('detects an indexing response-header change even when HTML is identical', () => {
  const [a, b] = pair();
  b.headers['x-robots-tag'] = 'noindex';
  const c = compareCaptures(a, b);
  expect(c.rows.find((r) => r.label === 'X-Robots-Tag header')).toMatchObject({
    changed: true,
    before: [],
    after: ['noindex'],
  });
  expect(c.verdict).not.toBe('Captured content stayed stable');
});
it('does not compare text fingerprints from different extraction versions', () => {
  const [a, b] = pair();
  b.content!.textVersion = 'block-boundaries-v2';
  b.content!.renderedHash = 'different';
  expect(compareCaptures(a, b).rows[0].changed).toBe(null);
  expect(compareCaptures(a, b).verdict).toBe('Body-text comparison is limited');
});
it('does not imply stable body text when source varies and text is unverified', () => {
  const [a, b] = pair();
  b.rawHtml += '<!-- change -->';
  delete a.content;
  expect(compareCaptures(a, b).verdict).toContain('text comparison is limited');
});
it('retains a failed HTTP status on a completed network transfer', () => {
  const [a, b] = pair();
  a.incompleteScripts = [{ ...a.scripts[0], state: 'pending' }];
  b.scripts[0].status = 404;
  expect(compareCaptures(a, b).scriptRows[0].after).toBe('completed · HTTP 404');
});
