import { describe, it, expect } from 'vitest';
import { demo } from '../src/demo';
import { compareFindings, duplicateMetadata, parseUrls, readReport } from '../shared/workspace';
import type { Report } from '../shared/types';
const clean = (): Report => ({ ...structuredClone(demo), sample: false, warnings: [], errors: [], status: 200 });
describe('audit workspace', () => {
  it('normalizes batches, removes fragments and duplicates, and rejects invalid inputs', () => {
    expect(parseUrls('https://example.com/#a\nhttps://example.com/#b')).toEqual(['https://example.com/']);
    for (const value of ['', 'javascript:alert(1)', 'https://user:secret@example.com', 'example.com', Array.from({length: 11}, (_,i) => `https://example.com/${i}`).join('\n')])
      expect(() => parseUrls(value)).toThrow();
  });
  it('does not call disappearing findings resolved when capture conditions differ', () => {
    const before = clean(); before.rendered.title = [];
    const after = clean(); after.rendered.title = ['Present'];
    const comparison = compareFindings(before, after);
    expect(comparison.rows.some(r => r.status === 'No longer detected')).toBe(true);
    after.warnings = ['2 script requests pending at capture'];
    expect(compareFindings(before, after).rows.some(r => r.status === 'No longer detected')).toBe(false);
    expect(compareFindings(before, after).rows.some(r => r.status === 'Needs verification')).toBe(true);
    after.warnings = []; after.finalUrl = 'https://other.example/';
    expect(compareFindings(before, after).reliable).toBe(false);
  });
  it('groups duplicate metadata only across distinct successful destinations', () => {
    const first = clean(), second = clean(); second.finalUrl += '/other';
    expect(duplicateMetadata([first, first])).toEqual([]);
    expect(duplicateMetadata([first, second]).some(d => d.field === 'title')).toBe(true);
    second.status = 500; expect(duplicateMetadata([first, second])).toEqual([]);
  });
  it('validates imports and recomputes changes instead of trusting imported claims', () => {
    const report = clean(); report.changes = [];
    expect(readReport(report).changes).toHaveLength(7);
    for (const value of [null, {}, {...report, finalUrl: 'javascript:alert(1)'}, {...report, metrics: {}}, {...report, scripts: [{}]}, {...report, raw: {}}, {...report, content: { changed: true }}])
      expect(() => readReport(value)).toThrow('valid renderview report');
  });
});
