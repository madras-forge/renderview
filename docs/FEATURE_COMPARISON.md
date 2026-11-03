# Feature comparison — 2026-11-03

Compared repository documentation, not independently benchmarked upstream implementations:
- SEOdin: https://github.com/rb17080/seodin
- seo-audit-tool: https://github.com/matt-antone/seo-audit-tool

All new code is an independent implementation; no upstream source was copied.

| Capability | Upstream reference | renderview |
| --- | --- | --- |
| Raw vs rendered SEO signals | SEOdin server view; seo-audit-tool rendered verification | Existing |
| Findings with evidence and next steps | Both document issue reporting | Existing action plan with owners and acceptance criteria |
| Local report history | SEOdin local scan history | Added explicit browser-local saved baselines, 10-report cap |
| Portable reports | seo-audit-tool JSON output | Added validated single-report JSON import; existing export |
| Multiple URLs | SEOdin bulk audit; seo-audit-tool crawling | Added sequential rendered checks of 1–10 explicit URLs, stop and per-URL errors |
| Cross-page duplicate metadata | SEOdin site sample | Added repeated rendered title/description groups within batch |
| Findings across releases | seo-audit-tool compare mode | Added new/persistent/disappearing findings by rule ID; qualified comparison across destinations |
| Before/after handoff | seo-audit-tool comparison reports | Added comparison JSON with evidence, action, owner and acceptance criteria |
| Whole-site discovery / sitemap crawling | seo-audit-tool | Not implemented; explicit URL batches only |
| robots.txt matching / sitemap membership | SEOdin | Not implemented |
| Schema linting / social previews / image checks | SEOdin | Not implemented; current checks retain their narrower scope |
| PDF report | seo-audit-tool | Not implemented; JSON and existing Markdown handoff |
| Automatic production/staging path matching | seo-audit-tool | Not implemented; manually chosen report pairs |

## Interpretation

An absent finding means a rule stopped triggering, not that indexing or traffic improved.
Different URLs, capture windows, non-2xx status, warnings indicating incomplete captures, or
browser errors qualify disappeared findings as needing verification. For comparable captures,
the label is “No longer detected,” never an automatic claim of a verified fix. Persistent
findings retain the latest evidence. Batch duplicates warrant intent review, not blanket rewriting.

## Validation

Unit coverage includes URL validation/deduplication, batch size limits, import rejection,
duplicate grouping, and comparison confidence. Desktop/mobile browser coverage exercises
saving and reloading, importing and comparing, malformed imports, and batch failure isolation.
