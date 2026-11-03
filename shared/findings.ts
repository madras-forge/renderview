import { comparisonMarkdown } from './capture-comparison.js';
import { labels, type Field, type Report } from './types.js';

export type Finding = {
  id: string;
  priority: 'fix' | 'review';
  kind: 'Observed problem' | 'Check intent' | 'Resilience improvement' | 'Investigate';
  title: string;
  field?: Field;
  evidence: string;
  impact: string;
  action: string;
  owner: string;
  steps: string[];
  acceptance: string[];
  source: string;
};
const jsDocs =
  'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics';
const linksDocs = 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable';
const canonicalDocs =
  'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls';
const noindex = (values: string[]) =>
  values.some((value) =>
    value.split(/[\s,;]+/).some((token) => ['noindex', 'none'].includes(token.toLowerCase())),
  );
const preview = (values: string[]) =>
  values.length
    ? values
        .map((v) => (v.length > 180 ? v.slice(0, 180) + '…' : v))
        .slice(0, 3)
        .join(' · ')
    : 'Not present';
function canonicalValues(values: string[], base: string) {
  return values.map((value) => {
    try {
      return new URL(value, base).href;
    } catch {
      return value;
    }
  });
}

export function captureConcerns(report: Report): string[] {
  return report.warnings.filter((w) =>
    /pending|failed|limit|blocked|navigated|incomplete|cap\./i.test(w),
  );
}

/** Deterministic, evidence-based guidance. No SEO score or script-causality claim. */
export function buildFindings(report: Report): Finding[] {
  const result: Finding[] = [];
  const covered = new Set<Field>();
  const add = (finding: Finding) => {
    result.push(finding);
    if (finding.field) covered.add(finding.field);
  };
  const evidence = (field: Field) =>
    `Source: ${preview(report.raw[field])}\nRendered: ${preview(report.rendered[field])}`;
  const verify = (field: Field) => [
    `Re-run this URL after deployment and inspect ${labels[field].toLowerCase()} in both captures.`,
    `Confirm the intended result in Google Search Console URL Inspection; this Chromium capture does not establish indexing.`,
  ];
  if (report.status >= 400)
    add({
      id: 'http-error',
      priority: 'fix',
      kind: 'Observed problem',
      title: `Resolve the HTTP ${report.status} response if this page should be available`,
      evidence: `Main document returned HTTP ${report.status}. Final URL: ${report.finalUrl}`,
      impact:
        'The requested page returned an error response. Check whether this is an intended missing page or an access/server failure.',
      action: 'Confirm whether this URL should exist before changing its response status.',
      owner: 'Backend / platform developer',
      steps: [
        'If this is an active page, investigate routing, server errors, or access restrictions and restore its intended successful response.',
        'If the page was intentionally removed, retain the appropriate error status and update internal links.',
      ],
      acceptance: [
        'An active page returns its intended successful status; a removed page retains the correct error response.',
        'Re-run the URL and verify the response and destination.',
      ],
      source: jsDocs,
    });
  const concerns = captureConcerns(report);
  if (concerns.length)
    add({
      id: 'capture-incomplete',
      priority: 'review',
      kind: 'Investigate',
      title: 'Verify the capture before drawing conclusions',
      evidence: concerns.join('\n'),
      impact:
        'The observation window ended with unresolved capture conditions. Unchanged values do not establish that the page finished rendering.',
      action:
        report.observationMs < 10000
          ? 'Re-run this URL with a 10-second observation window, then compare the result.'
          : 'Inspect pending or failed requests in browser developer tools; a longer wait alone may not resolve them.',
      owner: 'SEO analyst + frontend developer',
      steps: [
        'Inspect pending/failed requests and capture notes. They may be unrelated analytics or may affect content.',
        'Compare against the page in a normal browser. Account for consent, interaction, and cloud-browser restrictions.',
      ],
      acceptance: [
        'Capture limitations are resolved or their effect on essential content is documented.',
        'Essential content and metadata match the intended page; do not infer completion solely from a quiet network.',
      ],
      source: jsDocs,
    });
  if (report.content?.changed ?? report.metrics.rawWords !== report.metrics.renderedWords)
    add({
      id: 'body-text-change',
      priority: 'review',
      kind: 'Investigate',
      title: 'Inspect body text that changes during rendering',
      evidence:
        `Source body text: ${report.metrics.rawWords} words. Rendered body text: ${report.metrics.renderedWords} words.` +
        (report.content
          ? `\nSource excerpt: ${report.content.rawPreview}\nRendered excerpt: ${report.content.renderedPreview}`
          : ''),
      impact:
        'Body text differs even when metadata or heading groups stay unchanged. This may be essential content, transient UI, or hidden text; the comparison does not prove which script caused it.',
      action:
        'Inspect the HTML difference and identify whether essential page content is added, replaced, or removed.',
      owner: 'Content owner + frontend developer',
      steps: [
        'Open the HTML comparison and locate the changed text. Scripts, styles, noscript and template contents are excluded from the body-text measure.',
        'If essential content depends on rendering, consider initial-HTML delivery. If the change is intentional UI, document it without treating it as an SEO defect.',
      ],
      acceptance: [
        'The intended essential content is present and correct in the rendered capture.',
        'Any chosen initial-HTML delivery is verified in the source capture.',
        'Do not treat equal word counts as equal content; the new capture also compares normalized body text.',
      ],
      source: jsDocs,
    });
  if (!report.rendered.links.length)
    add({
      id: 'no-links',
      priority: 'review',
      kind: 'Check intent',
      field: 'links',
      title: 'Check whether the page should expose crawlable links',
      evidence: evidence('links'),
      impact:
        'No qualifying href links were found in the captured DOM. This may be intentional, an unfinished render, or navigation implemented without href attributes.',
      action:
        'Compare the intended page navigation with the captured HTML before deciding whether links need to be added.',
      owner: 'SEO owner + frontend developer',
      steps: [
        'If the page should link to other pages, inspect those navigation elements in a normal browser.',
        'Use real <a href="…"> links for intended navigation. Re-run after resolving incomplete capture conditions.',
      ],
      acceptance: [
        'Intended navigation destinations appear as crawlable anchors, or the absence of navigation is documented as intentional.',
      ],
      source: linksDocs,
    });
  const sourceNoindex = noindex(report.raw.robots),
    finalNoindex = noindex(report.rendered.robots);
  const header = report.headers['x-robots-tag'];
  if (sourceNoindex || finalNoindex || (header && noindex([header]))) {
    const removed = sourceNoindex && !finalNoindex;
    add({
      id: 'indexing-directive',
      priority: 'fix',
      kind: 'Check intent',
      field: 'robots',
      title: removed
        ? 'Do not rely on JavaScript to remove noindex'
        : 'Confirm whether this page should be excluded from search',
      evidence: evidence('robots') + (header ? `\nX-Robots-Tag: ${header}` : ''),
      impact: removed
        ? 'A noindex directive in the initial response can cause Google to skip rendering. Removing it later may not make the page indexable.'
        : 'A noindex/none directive was observed. It may be intentional; header directives can be scoped to a specific crawler.',
      action:
        'Ask the SEO owner whether this page is intended for search before editing any directive.',
      owner: 'SEO owner + backend developer',
      steps: [
        'Check page intent and any crawler scope in X-Robots-Tag.',
        'If indexing is intended, remove the applicable noindex directive from the server response and rendered metadata. Do not remove intentional exclusions.',
      ],
      acceptance: [
        'For a page intended for indexing, neither applicable response headers nor source/rendered robots metadata contains noindex.',
        'For an intentional exclusion, document the decision and preserve noindex.',
        ...verify('robots'),
      ],
      source: jsDocs,
    });
  }
  if (!report.rendered.title.length)
    add({
      id: 'missing-title',
      priority: 'fix',
      kind: 'Observed problem',
      field: 'title',
      title: 'Add a descriptive page title',
      evidence: evidence('title'),
      impact:
        'No non-empty title was found in the captured DOM. The page lacks an explicit title for users and search systems.',
      action:
        'Set a concise, page-specific title in the initial HTML and retain it after rendering.',
      owner: 'Content owner + frontend developer',
      steps: [
        'Write a title that describes this page, rather than a generic site label.',
        'Set one title in the page template and check that hydration does not erase it.',
      ],
      acceptance: [
        'One non-empty, page-specific title is present before and after rendering.',
        ...verify('title'),
      ],
      source: jsDocs,
    });
  const rawCanonical = canonicalValues(report.raw.canonical, report.finalUrl),
    finalCanonical = canonicalValues(report.rendered.canonical, report.finalUrl);
  if (new Set(rawCanonical).size > 1 || new Set(finalCanonical).size > 1)
    add({
      id: 'canonical-conflict',
      priority: 'fix',
      kind: 'Observed problem',
      field: 'canonical',
      title: 'Resolve conflicting canonical destinations',
      evidence: evidence('canonical'),
      impact:
        'Multiple distinct canonical targets were found in the same capture, giving inconsistent preferred-URL signals.',
      action:
        'Choose the intended canonical with the SEO owner and emit a single consistent canonical tag.',
      owner: 'SEO owner + frontend developer',
      steps: [
        'Check the preferred URL, including redirects and duplicate variants.',
        'Remove conflicting template, plugin, or JavaScript canonical declarations.',
      ],
      acceptance: [
        'Exactly one intended canonical target is present in each capture.',
        ...verify('canonical'),
      ],
      source: canonicalDocs,
    });
  else if (
    JSON.stringify(rawCanonical) !== JSON.stringify(finalCanonical) &&
    report.raw.canonical.length
  )
    add({
      id: 'canonical-change',
      priority: 'fix',
      kind: 'Check intent',
      field: 'canonical',
      title: 'Review the canonical change during rendering',
      evidence: evidence('canonical'),
      impact:
        'The preferred URL changes or disappears during rendering. The intended destination needs to be consistent.',
      action: 'Confirm the intended preferred URL and align server and client declarations.',
      owner: 'SEO owner + frontend developer',
      steps: [
        'Inspect the source and rendered destinations in the evidence.',
        'Correct the template or client metadata code if the change is unintended.',
      ],
      acceptance: [
        'The intended canonical stays consistent through rendering.',
        ...verify('canonical'),
      ],
      source: canonicalDocs,
    });
  const invalid = report.rendered.structuredData.filter((value) => {
    try {
      JSON.parse(value);
      return false;
    } catch {
      return true;
    }
  });
  if (invalid.length)
    add({
      id: 'invalid-jsonld',
      priority: 'fix',
      kind: 'Observed problem',
      field: 'structuredData',
      title: 'Repair invalid JSON in structured data',
      evidence: `${invalid.length} rendered JSON-LD block(s) could not be parsed as JSON.\n${preview(invalid)}`,
      impact:
        'Malformed JSON cannot be interpreted as valid JSON-LD. This check does not validate schema properties or rich-result eligibility.',
      action: 'Repair the JSON syntax, then validate the intended schema separately.',
      owner: 'Frontend developer',
      steps: [
        'Inspect the affected JSON-LD block for syntax errors or unescaped values.',
        'Use JSON serialization when generating the block; then run Google’s Rich Results Test if the schema is supported.',
      ],
      acceptance: [
        'Every rendered JSON-LD block parses as JSON.',
        'The intended supported schema passes its applicable validation.',
        ...verify('structuredData'),
      ],
      source: jsDocs,
    });
  const guidance: Record<
    Field,
    { title: string; action: string; impact: string; steps: string[] }
  > = {
    title: {
      title: 'Make the page title available without rendering',
      action: 'Deliver the intended page title in the initial HTML.',
      impact:
        'The title is added or changed during rendering. Confirm the final value and reduce dependence on client execution.',
      steps: [
        'Inspect the route’s title and hydration code.',
        'Keep a page-specific title consistent across the initial response and DOM.',
      ],
    },
    description: {
      title: 'Review the description delivered by JavaScript',
      action: 'Confirm the description is correct and consider serving it in the initial HTML.',
      impact:
        'The description differs between the response and rendered page. This is a metadata delivery dependency, not proof of an indexing failure.',
      steps: [
        'Have the content owner approve the final description.',
        'Include it in the server template or prerendered output if feasible; avoid competing client updates.',
      ],
    },
    canonical: {
      title: 'Review the canonical added during rendering',
      action: 'Confirm the preferred URL and consider including it in the initial HTML.',
      impact:
        'Google can process an injected canonical, but consistent initial delivery reduces dependence on rendering.',
      steps: [
        'Confirm the preferred URL with the SEO owner.',
        'Serve a single canonical that remains consistent after hydration.',
      ],
    },
    robots: {
      title: 'Review changes to robots instructions',
      action: 'Confirm that the effective directive matches the page’s intended search visibility.',
      impact:
        'Robots metadata changes during rendering. A change can be intentional, so review its meaning before editing it.',
      steps: [
        'Compare all directives and response headers.',
        'Keep the intended visibility directive consistent in the response and DOM.',
      ],
    },
    h1: {
      title: 'Review how the main heading is delivered',
      action:
        'Confirm the intended heading and consider delivering it with the essential content in the initial HTML.',
      impact:
        'The H1 group changes during rendering. If this represents essential page content, client failures could affect its availability. This is not an automatic SEO error.',
      steps: [
        'Check that the rendered heading accurately identifies the page.',
        'If the heading is essential, server-render or prerender it and the associated content where practical.',
      ],
    },
    links: {
      title: 'Review links added or removed by rendering',
      action:
        'Check the changed destinations and make important navigation resilient to JavaScript failures.',
      impact:
        'Rendering changes the link collection. Dynamically inserted anchors can be crawlable; count differences alone do not prove a discovery problem.',
      steps: [
        'Inspect the source and rendered href values; identify important navigation or content links.',
        'Keep intended links as real <a href="…"> elements. Consider initial-HTML delivery for essential links; repair unintended removals.',
      ],
    },
    structuredData: {
      title: 'Verify structured data delivered by JavaScript',
      action: 'Validate the rendered data and consider initial-HTML delivery when practical.',
      impact:
        'JSON-LD changes during rendering. Presence alone does not establish correctness or rich-result eligibility.',
      steps: [
        'Compare the schema with visible page content.',
        'Validate supported schema using Google’s Rich Results Test. Avoid duplicate or contradictory blocks.',
      ],
    },
  };
  const reviewOrder: Field[] = [
    'robots',
    'canonical',
    'title',
    'h1',
    'links',
    'description',
    'structuredData',
  ];
  for (const field of reviewOrder) {
    if (covered.has(field)) continue;
    if (JSON.stringify(report.raw[field]) === JSON.stringify(report.rendered[field])) continue;
    // Equivalent relative/absolute canonical representations are not actionable changes.
    if (field === 'canonical' && JSON.stringify(rawCanonical) === JSON.stringify(finalCanonical))
      continue;
    const g = guidance[field];
    const removed = report.raw[field].length && !report.rendered[field].length;
    add({
      id: `render-${field}`,
      priority: 'review',
      kind: removed ? 'Investigate' : 'Resilience improvement',
      field,
      title: removed ? `Check why ${labels[field].toLowerCase()} disappears` : g.title,
      evidence: evidence(field),
      impact: g.impact,
      action: g.action,
      owner:
        field === 'description'
          ? 'Content owner + frontend developer'
          : 'SEO owner + frontend developer',
      steps: g.steps,
      acceptance: [
        `The intended ${labels[field].toLowerCase()} values are present and correct at capture.`,
        `If initial-HTML delivery is chosen, the intended values are available in source without relying on JavaScript.`,
        ...verify(field),
      ],
      source: field === 'links' ? linksDocs : field === 'canonical' ? canonicalDocs : jsDocs,
    });
  }
  if (report.errors.length)
    add({
      id: 'runtime-errors',
      priority: 'review',
      kind: 'Investigate',
      title: 'Investigate captured JavaScript exceptions',
      evidence: report.errors.slice(0, 3).join('\n'),
      impact:
        'Exceptions were captured, but the report does not prove they affected SEO content or identify a responsible script.',
      action:
        'Reproduce the errors and determine whether they interrupt essential rendering before prioritizing a fix.',
      owner: 'Frontend developer',
      steps: [
        'Reproduce the URL in browser developer tools.',
        'Trace each exception and check whether essential content or metadata fails to render.',
      ],
      acceptance: [
        'Relevant exceptions are resolved or documented as unrelated to essential rendering.',
        'Re-run the capture and compare intended SEO values.',
      ],
      source: jsDocs,
    });
  return result.sort((a, b) => Number(a.priority === 'review') - Number(b.priority === 'review'));
}

export function developerHandoff(report: Report, findings: Finding[]): string {
  return [
    `# renderview — developer handoff`,
    report.sample ? '**ILLUSTRATIVE SAMPLE — not a live audit**' : 'Live capture',
    `URL: ${report.url}`,
    `Final URL: ${report.finalUrl}`,
    `Captured: ${report.createdAt}`,
    `Observation: ${report.observationMs} ms after DOMContentLoaded`,
    `\nScope: observational Chromium captures; priorities are investigation guidance, not an indexing or ranking verdict.`,
    `\n## Decision brief\n${report.comparison ? report.comparison.verdict : 'Single capture; no longer-visit comparison yet.'}\n\nProposed next actions:\n${[...findings.filter((f) => f.id !== 'capture-incomplete'), ...findings.filter((f) => f.id === 'capture-incomplete')].map((f, i) => `${i + 1}. ${f.title} — ${f.owner}. ${f.action}`).join('\n') || 'No rule-triggered action from this capture. This is not an SEO clearance.'}\n\nBusiness impact: not measured. Confirm affected URLs and search performance before assigning an implementation priority.`,
    comparisonMarkdown(report),
    ...(report.incompleteScripts?.length
      ? [
          `\nUnfinished scripts:\n${report.incompleteScripts.map((s) => `${s.state}: ${s.url} — ${s.error ?? s.status}`).join('\n')}`,
        ]
      : []),
    ...(report.warnings.length
      ? [`\nCapture notes:\n${report.warnings.map((w) => `- ${w}`).join('\n')}`]
      : []),
    ...findings.map(
      (f, i) =>
        `\n## ${i + 1}. ${f.title}\n\nPriority: ${f.priority === 'fix' ? 'Fix first / confirm intent' : 'Review'} · ${f.kind}\nOwner: ${f.owner}\n\n### Evidence\n${f.evidence}\n\n### Why it matters\n${f.impact}\n\n### Recommended action\n${f.action}\n${f.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n### Acceptance criteria\n${f.acceptance.map((s) => `- [ ] ${s}`).join('\n')}\n\nReference: ${f.source}`,
    ),
    ...(!findings.length
      ? [
          '\nNo actionable findings from these checks. This is not a complete SEO audit or a guarantee of indexing.',
        ]
      : []),
  ].join('\n');
}
