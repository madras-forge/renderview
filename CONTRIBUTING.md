# Contributing

Use Node 22.12+ and the committed lockfile. Run `npm ci`, `npm run browsers`, then `npm run dev`.

Before proposing a change, run `npm run build`, `npm test`, and `npm run test:e2e`. Linux browser setup requires `npx playwright install --with-deps chromium`.

Keep security checks active in production. Test fixtures may mock network boundaries in tests, but must not introduce a private-address bypass into server configuration. Add a regression test when fixing capture, validation, or comparison bugs. Update `shared/types.ts` and documentation when the report format changes.

Use factual labels for measurements: never imply that the sample is a real scan, a Chromium capture is Googlebot, or a script's loading order proves causal SEO effects.
