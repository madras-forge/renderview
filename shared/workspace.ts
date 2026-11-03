import { buildFindings, captureConcerns } from './findings.js';
import { fields, type Report } from './types.js';

export function parseUrls(input: string): string[] {
  const urls = input.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => {
    let url: URL;
    try { url = new URL(s); } catch { throw new Error(`Enter a complete https:// URL: ${s}`); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Use HTTP or HTTPS URLs without credentials.');
    url.hash = '';
    return url.href;
  });
  const unique = [...new Set(urls)];
  if (!unique.length || unique.length > 10) throw new Error('Enter between 1 and 10 unique URLs, one per line.');
  return unique;
}

export function compareFindings(before: Report, after: Report) {
  const previous = buildFindings(before), current = buildFindings(after);
  const reliable = !before.sample && !after.sample && before.status >= 200 && before.status < 300 &&
    after.status >= 200 && after.status < 300 && !captureConcerns(before).length &&
    !captureConcerns(after).length && !before.errors.length && !after.errors.length &&
    before.observationMs === after.observationMs && before.finalUrl === after.finalUrl;
  return {
    reliable,
    rows: [
      ...current.map(finding => ({ finding, status: previous.some(f => f.id === finding.id) ? 'Still present' : 'New' })),
      ...previous.filter(f => !current.some(c => c.id === f.id)).map(finding => ({ finding,
        status: reliable ? 'No longer detected' : 'Needs verification' })),
    ],
  };
}

export function duplicateMetadata(reports: Report[]) {
  return (['title', 'description'] as const).flatMap(field => {
    const groups = new Map<string, Set<string>>();
    for (const report of reports) {
      if (report.status < 200 || report.status >= 300) continue;
      const value = report.rendered[field].join(' ').trim().replace(/\s+/g, ' ').toLowerCase();
      if (!value) continue;
      const urls = groups.get(value) ?? new Set<string>();
      urls.add(report.finalUrl); groups.set(value, urls);
    }
    return [...groups].filter(([, urls]) => urls.size > 1).map(([value, urls]) => ({ field, value, urls: [...urls] }));
  });
}

// Reject malformed imports before any report is rendered. Ignore unrecognized properties.
export function readReport(value: unknown): Report {
  const r = value as Report;
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string');
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const snapshot = (v: Report['raw']) => v && fields.every(f => strings(v[f]));
  const script = (s: Report['scripts'][number]) => s && typeof s.url === 'string' && typeof s.initiator === 'string' &&
    typeof s.thirdParty === 'boolean' && ['bytes', 'duration', 'start', 'status'].every(k => number(s[k as keyof typeof s]));
  try {
    if (!r || typeof r.id !== 'string' || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt)) ||
      ![r.url, r.finalUrl].every(u => typeof u === 'string' && ['http:', 'https:'].includes(new URL(u).protocol)) ||
      typeof r.rawHtml !== 'string' || typeof r.renderedHtml !== 'string' || !snapshot(r.raw) || !snapshot(r.rendered) ||
      !number(r.status) || !number(r.duration) || !number(r.observationMs) || !strings(r.errors) || !strings(r.warnings) ||
      !r.headers || Object.values(r.headers).some(v => typeof v !== 'string') ||
      !r.metrics || !['dependent', 'changed', 'scriptBytes', 'rawWords', 'renderedWords'].every(k => number(r.metrics[k as keyof Report['metrics']])) ||
      !Array.isArray(r.scripts) || !r.scripts.every(script) ||
      !Array.isArray(r.timeline) || !r.timeline.every(t => t && fields.includes(t.field) && number(t.at) && strings(t.value)) ||
      (r.incompleteScripts && (!Array.isArray(r.incompleteScripts) || !r.incompleteScripts.every(s => script(s) && ['pending', 'failed'].includes(s.state) && (s.error === undefined || typeof s.error === 'string')))) ||
      (r.content && (typeof r.content.changed !== 'boolean' || typeof r.content.rawPreview !== 'string' || typeof r.content.renderedPreview !== 'string' ||
        ['rawHash', 'renderedHash', 'textVersion'].some(k => r.content![k as keyof NonNullable<Report['content']>] !== undefined && typeof r.content![k as keyof NonNullable<Report['content']>] !== 'string')))) throw new Error();
    return { ...r, sample: Boolean(r.sample), comparison: undefined,
      changes: fields.map(field => ({ field, raw: r.raw[field], rendered: r.rendered[field],
        status: JSON.stringify(r.raw[field]) === JSON.stringify(r.rendered[field]) ? 'unchanged' : !r.raw[field].length ? 'added' : !r.rendered[field].length ? 'removed' : 'changed' })) };
  } catch { throw new Error('This file is not a valid renderview report. Import an exported JSON report.'); }
}
