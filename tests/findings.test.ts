import { describe, it, expect } from 'vitest';
import { buildFindings, developerHandoff } from '../shared/findings';
import { demo } from '../src/demo';
import type { Report } from '../shared/types';
function stable(): Report {
  const r = structuredClone(demo);
  r.sample = false;
  r.raw = structuredClone(r.rendered);
  r.warnings = [];
  r.metrics.rawWords = r.metrics.renderedWords;
  return r;
}
describe('actionable SEO guidance', () => {
  it('classifies the sample as five reviews, not five confirmed SEO failures', () => {
    const f = buildFindings(demo);
    expect(f).toHaveLength(5);
    expect(f.every((x) => x.priority === 'review')).toBe(true);
    expect(f.map((x) => x.field)).toEqual(
      expect.arrayContaining(['description', 'h1', 'links', 'structuredData']),
    );
  });
  it('does not flag size, latency, or missing optional metadata alone', () => {
    const r = stable();
    r.raw.description = [];
    r.rendered.description = [];
    r.raw.structuredData = [];
    r.rendered.structuredData = [];
    r.metrics.scriptBytes = 99999999;
    r.timeline = [{ field: 'h1', at: 20000, value: ['Heading'] }];
    expect(buildFindings(r)).toEqual([]);
  });
  it('prioritizes source noindex removed by JavaScript and preserves intent checks', () => {
    const r = stable();
    r.raw.robots = ['NOINDEX, follow'];
    r.rendered.robots = ['index, follow'];
    const f = buildFindings(r)[0];
    expect(f.id).toBe('indexing-directive');
    expect(f.priority).toBe('fix');
    expect(f.title).toContain('Do not rely');
    expect(f.action).toContain('intended for search');
    expect(f.acceptance.join(' ')).toContain('preserve noindex');
  });
  it('detects header noindex and warns about crawler scope', () => {
    const r = stable();
    r.headers['x-robots-tag'] = 'googlebot: noindex';
    const f = buildFindings(r)[0];
    expect(f.evidence).toContain('googlebot: noindex');
    expect(f.impact).toContain('scoped');
  });
  it('does not misread nofollow as noindex', () => {
    const r = stable();
    r.raw.robots = r.rendered.robots = ['nofollow'];
    expect(buildFindings(r)).toEqual([]);
  });
  it('flags conflicting canonicals but avoids relative/absolute false positives', () => {
    const r = stable();
    r.raw.canonical = ['/'];
    r.rendered.canonical = ['https://fieldnotes.example/'];
    expect(buildFindings(r)).toEqual([]);
    r.rendered.canonical.push('https://fieldnotes.example/other');
    expect(buildFindings(r)[0].id).toBe('canonical-conflict');
  });
  it('prioritizes a canonical removed by rendering', () => {
    const r = stable();
    r.rendered.canonical = [];
    expect(buildFindings(r)[0]).toMatchObject({
      id: 'canonical-change',
      priority: 'fix',
      kind: 'Check intent',
    });
  });
  it('treats a missing title as an observed problem', () => {
    const r = stable();
    r.raw.title = [];
    r.rendered.title = [];
    expect(buildFindings(r)[0]).toMatchObject({ id: 'missing-title', kind: 'Observed problem' });
  });
  it('detects malformed JSON without claiming schema validation', () => {
    const r = stable();
    r.rendered.structuredData = ['{"broken":}'];
    const f = buildFindings(r)[0];
    expect(f.id).toBe('invalid-jsonld');
    expect(f.impact).toContain('does not validate schema');
  });
  it('does not attribute exceptions to script size or a particular SEO mutation', () => {
    const r = stable();
    r.errors = ['TypeError: widget failed'];
    const f = buildFindings(r)[0];
    expect(f.priority).toBe('review');
    expect(f.impact).toContain('does not prove');
  });
  it('places HTTP errors before rendering improvements and retains valid missing-page responses', () => {
    const r = structuredClone(demo);
    r.status = 404;
    const f = buildFindings(r);
    expect(f[0].id).toBe('http-error');
    expect(f[0].steps.join(' ')).toContain('retain the appropriate error status');
  });
  it('creates an honest developer handoff with evidence, actions, criteria, and capture limits', () => {
    const r = structuredClone(demo);
    r.warnings.push('Network limit reached');
    const text = developerHandoff(r, buildFindings(r));
    expect(text).toContain('ILLUSTRATIVE SAMPLE');
    expect(text).toContain('Network limit reached');
    expect(text).toContain('### Evidence');
    expect(text).toContain('### Recommended action');
    expect(text).toContain('- [ ]');
    expect(text).toContain('fieldnotes.example');
  });
});

it('does not present pending scripts as a clean result', () => {
  const r = stable();
  r.warnings = ['2 script request(s) were still pending at capture.'];
  const f = buildFindings(r);
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ id: 'capture-incomplete', priority: 'review' });
  expect(f[0].action).toContain('10-second');
});
it('detects body-text growth when all seven SEO groups are unchanged', () => {
  const r = stable();
  r.metrics.rawWords = 14;
  r.metrics.renderedWords = 227;
  expect(buildFindings(r)[0].id).toBe('body-text-change');
});
it('detects changed text even when word counts are equal', () => {
  const r = stable();
  r.content = { changed: true, rawPreview: 'Old product', renderedPreview: 'New product' };
  expect(buildFindings(r)[0].id).toBe('body-text-change');
});
it('treats absent links as an intent check, not a confirmed defect', () => {
  const r = stable();
  r.raw.links = [];
  r.rendered.links = [];
  expect(buildFindings(r)[0]).toMatchObject({
    id: 'no-links',
    priority: 'review',
    kind: 'Check intent',
  });
});
