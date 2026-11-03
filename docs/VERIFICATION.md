# Verification

Verified locally on 2 November 2026, using Node 24.18.0 on macOS ARM64. CI targets Node 22 on Ubuntu.

| Check                                                            | Result                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| TypeScript and Vite production build                             | Passed                                                         |
| Extraction, security, proxy, API, and Chromium integration suite | 63 tests passed                                                |
| Desktop and mobile Chromium UI suite                             | 14 tests passed                                                 |
| Deployment script shell syntax                                   | Passed                                                         |
| Dependency audit at installation                                 | 0 known vulnerabilities reported                               |
| Live HTTPS analysis through production server and egress proxy   | `https://example.com/` returned HTTP 200 and a complete report |
| Desktop and mobile screenshots                                   | Reviewed; blue/green/amber/red palette, responsive layout      |

UI tests verify the sample label, element inspector, HTML diff toggle, timeline, script initiators, JSON download, no horizontal page overflow, successful analysis responses, and API error recovery. UI analysis responses are mocked; the separate integration test runs real Chromium against controlled delayed JavaScript content.

Screenshots are in `docs/screenshots/`. The example.com live check does not establish behavior on every site; pages can block cloud browsers or exceed observation/resource limits.

The Codex browser automation connection was unavailable during visual review. Automated Playwright tests generated the screenshots, which were inspected directly.

Not verified: Docker image build, Cloud Build, Google Cloud IAM setup, and a deployed Cloud Run revision. No cloud account/project was connected and Docker/Google Cloud CLI were unavailable on the local host. Follow `GOOGLE_CLOUD_SETUP.md` to complete and verify deployment.

## Action-plan release

Added 12 rule tests covering conservative priorities, intentional noindex, scoped headers, canonical equivalence/conflicts, missing titles, malformed JSON, runtime errors, optional metadata, and handoff content. Added desktop/mobile scenarios for priority filters, evidence inspection, copying a developer issue, downloading an action plan, and displaying capture limitations.

The current suite passes 77 tests. Production build passes. Desktop and mobile screenshots were reviewed after the action-plan changes. This is functional scenario testing and visual review, not a study with recruited SEO users.

## Capture confidence correction

Reproduced the NoBroker page with unchanged SEO groups and pending script requests. The report now generates a capture-verification action and a no-links intent review rather than an empty plan. Verified the static Quotes to Scrape page had unchanged text (279 words), while its JavaScript variant grew from 14 to 227 words with unchanged SEO groups. Body-text changes now generate a review finding.

Added regression tests for incomplete captures, missing links, body-text growth, same-word-count replacement, and the 10-second rerun interaction. The heading now describes comparison rather than claiming JavaScript causality.

## Longer-capture workflow

Added eight comparison-rule tests and desktop/mobile scenarios for content arriving on a second visit, pending URLs becoming completed, and failed reruns preserving the baseline. The real Chromium integration fixture now verifies retained pending and failed script details and full body-text fingerprints. JSON and Markdown exports retain the comparison evidence. The comparison screenshot uses an explicitly mocked test scenario, not a live audit of example.com.

Live two-capture smoke test also passed against `https://quotes.toscrape.com/js-delayed/`: a 1-second capture contained 14 body-text words; a fresh 10-second capture contained 227. The source response did not vary, body fingerprints differed, and the comparison returned “Content differs in the longer capture.” Run the optional `node scripts/smoke-comparison.mjs` with the production server running to repeat this check; the public fixture may change.
