import { fields, labels, type Report, type CaptureComparison } from './types.js';

/** Two fresh visits are observational evidence, not a controlled causality experiment. */
export function compareCaptures(before: Report, after: Report): CaptureComparison {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const rows: CaptureComparison['rows'] = fields.map((field) => ({
    label: labels[field],
    before: before.rendered[field],
    after: after.rendered[field],
    changed: !same(before.rendered[field], after.rendered[field]),
  }));
  rows.push({
    label: 'X-Robots-Tag header',
    before: before.headers['x-robots-tag'] ? [before.headers['x-robots-tag']] : [],
    after: after.headers['x-robots-tag'] ? [after.headers['x-robots-tag']] : [],
    changed: before.headers['x-robots-tag'] !== after.headers['x-robots-tag'],
  });
  const sameTextVersion = before.content?.textVersion === after.content?.textVersion;
  const bodyChanged = !sameTextVersion
    ? null
    : before.content?.renderedHash && after.content?.renderedHash
      ? before.content.renderedHash !== after.content.renderedHash
      : before.metrics.renderedWords !== after.metrics.renderedWords
        ? true
        : before.content?.renderedPreview &&
            after.content?.renderedPreview &&
            before.content.renderedPreview !== after.content.renderedPreview
          ? true
          : null;
  rows.unshift({
    label: 'Body text',
    before: [
      `${before.metrics.renderedWords} words`,
      before.content?.renderedPreview ?? 'Text fingerprint unavailable',
    ],
    after: [
      `${after.metrics.renderedWords} words`,
      after.content?.renderedPreview ?? 'Text fingerprint unavailable',
    ],
    changed: bodyChanged,
  });
  const comparable =
    before.url === after.url &&
    before.finalUrl === after.finalUrl &&
    before.status === after.status &&
    !before.sample &&
    !after.sample;
  const sourceVaried = before.rawHtml !== after.rawHtml;
  const short = (report: Report) => ({
    id: report.id,
    createdAt: report.createdAt,
    windowMs: report.observationMs,
    finalUrl: report.finalUrl,
    status: report.status,
  });
  const urls = new Set([
    ...(before.incompleteScripts ?? []).map((s) => s.url),
    ...(after.incompleteScripts ?? []).map((s) => s.url),
  ]);
  function scriptState(report: Report, url: string) {
    const outstanding = (report.incompleteScripts ?? []).filter((s) => s.url === url);
    if (outstanding.length)
      return outstanding
        .map(
          (s) =>
            `${s.state}${s.status ? ` · HTTP ${s.status}` : ''}${s.error ? ` · ${s.error}` : ''}`,
        )
        .join('; ');
    const completed = report.scripts.filter((s) => s.url === url);
    return completed.length
      ? completed.map((s) => `completed · HTTP ${s.status || 'unknown'}`).join('; ')
      : 'not observed';
  }
  const scriptRows = Array.from(urls).map((url) => ({
    url,
    before: scriptState(before, url),
    after: scriptState(after, url),
  }));
  const changed = rows.some((r) => r.changed === true),
    limited = rows.some((r) => r.changed === null);
  const unresolved =
    (after.incompleteScripts?.length ?? 0) > 0 ||
    after.warnings.some((w) => /pending|failed|limit|blocked|navigated|incomplete/i.test(w));
  let verdict: string, nextStep: string;
  if (!comparable) {
    verdict = 'These captures are not directly comparable';
    nextStep =
      'The requested URL, final destination, response status, or sample/live state differs. Resolve that difference before attributing content changes to observation time.';
  } else if (sourceVaried) {
    verdict = changed
      ? 'The page varied between visits'
      : limited
        ? 'Source responses differed; text comparison is limited'
        : 'Source responses differed; captured content stayed stable';
    nextStep =
      'The initial HTML also changed between visits. Inspect personalization, dynamic responses, and page updates; extra wait time alone cannot explain the result. Review the differences below.';
  } else if (changed) {
    verdict = 'Content differs in the longer capture';
    nextStep =
      'Inspect the changed content below. If it is essential content missing from the shorter capture, investigate delayed rendering and consider initial-HTML delivery. Two visits do not prove which script caused it.';
  } else if (limited) {
    verdict = 'Body-text comparison is limited';
    nextStep =
      'A capture lacks a compatible full-text fingerprint. Matching word counts and excerpts cannot prove equal content. Run a new short capture and compare again.';
  } else if (unresolved) {
    verdict = 'Content stayed stable; capture limits remain';
    nextStep =
      'No change was measured in body text, the seven SEO groups, or the captured robots response header. Inspect the unfinished requests below and verify essential content against the intended page. We have not established that these scripts are unrelated analytics.';
  } else {
    verdict = 'Captured content stayed stable';
    nextStep =
      'No wait-related content change was measured in these checks. Review source-versus-DOM findings below and compare against the intended page; this is not an indexing or completeness guarantee.';
  }
  return {
    before: short(before),
    after: short(after),
    comparable,
    sourceVaried,
    verdict,
    nextStep,
    rows,
    beforeWarnings: before.warnings,
    afterWarnings: after.warnings,
    scriptRows,
  };
}

export function comparisonMarkdown(report: Report): string {
  const c = report.comparison;
  if (!c) return '';
  return [
    `\n## Longer-capture comparison`,
    `${c.before.windowMs / 1000}s (${c.before.createdAt}) → ${c.after.windowMs / 1000}s (${c.after.createdAt})`,
    c.verdict,
    c.nextStep,
    `Source response varied: ${c.sourceVaried ? 'yes' : 'no'}`,
    ...c.rows.map(
      (row) =>
        `\n### ${row.label}: ${row.changed === null ? 'unknown' : row.changed ? 'changed' : 'unchanged'}\nBefore: ${row.before.join(' · ') || 'Absent'}\nAfter: ${row.after.join(' · ') || 'Absent'}`,
    ),
    `\n### Script URL observations\n${c.scriptRows.map((s) => `${s.url}\nBefore: ${s.before}\nAfter: ${s.after}`).join('\n') || 'No unfinished script URLs recorded.'}`,
    `\nFirst-capture notes:\n${c.beforeWarnings.join('\n') || 'None'}`,
    `\nLonger-capture notes:\n${c.afterWarnings.join('\n') || 'None'}`,
  ].join('\n');
}
