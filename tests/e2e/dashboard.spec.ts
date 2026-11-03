import { test, expect } from '@playwright/test';
import { demo } from '../../src/demo';
test('sample report, inspector, tabs and export work', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Compare source HTML with the rendered page.' }),
  ).toBeVisible();
  await expect(page.getByText('SAMPLE REPORT', { exact: true })).toBeVisible();
  await page.screenshot({
    path: `docs/screenshots/${test.info().project.name === 'desktop' ? 'dashboard' : 'mobile'}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Inspect Meta description', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Not present in this capture');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.getByRole('tab', { name: 'HTML comparison' }).click();
  await expect(page.locator('.diff-add')).toContainText(['Make room']);
  await page.getByLabel('Changes only').check();
  await expect(page.locator('.diff-same')).toHaveCount(0);
  await page.getByRole('tab', { name: 'SEO timeline' }).click();
  await expect(page.locator('.timeline-event')).toHaveCount(8);
  await page.getByRole('tab', { name: 'JavaScript', exact: true }).click();
  await page.locator('summary').filter({ hasText: 'app.js' }).click();
  await expect(
    page.locator('details[open]').getByText('Initiated by:', { exact: true }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export report' }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/renderview-.*\.json/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('runs analyses and shows errors without losing the prior report', async ({ page }) => {
  await page.route('**/api/analyze', (route) =>
    route.fulfill({
      json: {
        ...demo,
        id: 'live-test',
        sample: false,
        url: 'https://example.com/',
        finalUrl: 'https://example.com/',
      },
    }),
  );
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com');
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await expect(page.getByText('LIVE REPORT')).toBeVisible();
  await page.route('**/api/analyze', (route) =>
    route.fulfill({ status: 502, json: { error: 'Target page timed out.' } }),
  );
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Target page timed out.');
  await expect(page.getByText('LIVE REPORT')).toBeVisible();
});

test('action plan explains value, filters priorities and exports developer steps', async ({
  page,
}) => {
  await page.goto('/');
  const plan = page.getByRole('region', { name: 'Prioritized action plan' });
  await expect(
    plan.getByRole('heading', { name: 'Review captured differences and delivery' }),
  ).toBeVisible();
  await expect(
    plan.getByText('No urgent findings in these checks.', { exact: false }),
  ).toBeVisible();
  await expect(plan.getByRole('heading', { name: 'What to do', exact: true })).toBeVisible();
  await expect(plan.getByRole('heading', { name: 'How to verify the fix' })).toBeVisible();
  await plan.getByRole('button', { name: 'Fix first 0', exact: true }).click();
  await expect(
    plan.getByText('No urgent findings from these checks.', { exact: false }),
  ).toBeVisible();
  await plan.getByRole('button', { name: 'Review 5', exact: true }).click();
  await plan.getByRole('button', { name: /Review how the main heading is delivered/ }).click();
  await plan.getByRole('button', { name: 'Inspect complete values' }).click();
  await expect(page.getByRole('dialog')).toContainText('H1 headings');
  await page.getByRole('button', { name: 'Close inspector' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    });
  });
  await plan.getByRole('button', { name: 'Copy developer issue' }).click();
  await expect(plan.getByRole('status')).toContainText('Copied:');
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toContain(
    'Acceptance criteria',
  );
  const download = page.waitForEvent('download');
  await plan.getByRole('button', { name: 'Download action plan' }).click();
  expect((await download).suggestedFilename()).toMatch(/renderview-actions-.*\.md/);
});

test('urgent findings state intent and capture limitations', async ({ page }) => {
  const report = structuredClone(demo);
  report.sample = false;
  report.id = 'noindex-report';
  report.raw.robots = ['noindex'];
  report.rendered.robots = ['index, follow'];
  report.warnings = ['Network transfer limit reached; the capture may be incomplete.'];
  await page.route('**/api/analyze', (route) => route.fulfill({ json: report }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com');
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  const plan = page.getByRole('region', { name: 'Prioritized action plan' });
  await expect(plan.getByRole('heading', { name: '1 item needs attention first' })).toBeVisible();
  await expect(
    plan.getByText('Do not rely on JavaScript to remove noindex', { exact: true }),
  ).toBeVisible();
  await expect(plan.getByText('Interpret this capture with care')).toBeVisible();
  await expect(
    plan.getByText(
      'Ask the SEO owner whether this page is intended for search before editing any directive.',
    ),
  ).toBeVisible();
});

test('incomplete unchanged capture offers a real longer rerun', async ({ page }) => {
  const report = structuredClone(demo);
  report.sample = false;
  report.id = 'partial';
  report.raw = structuredClone(report.rendered);
  report.metrics.rawWords = report.metrics.renderedWords;
  report.warnings = ['2 script request(s) were still pending at capture.'];
  const requests: { url: string; observationMs: number }[] = [];
  await page.route('**/api/analyze', (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    return route.fulfill({
      json: { ...report, id: `partial-${requests.length}`, observationMs: body.observationMs },
    });
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com/');
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Verify this capture with a longer comparison' }),
  ).toBeVisible();
  await expect(page.getByText('No actionable findings in these checks')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run longer capture and compare' }).click();
  await expect(page.getByText('Already captured for 10 seconds.', { exact: false })).toBeVisible();
  expect(requests[1]).toEqual({ url: report.url, observationMs: 10000 });
});

test('longer capture retains evidence and shows content arrival with script resolution', async ({
  page,
}) => {
  const before = structuredClone(demo);
  before.sample = false;
  before.id = 'short';
  before.url = 'https://example.com/';
  before.finalUrl = before.url;
  before.rendered.h1 = [];
  before.metrics.renderedWords = 14;
  before.content = {
    changed: false,
    rawPreview: 'Initial',
    renderedPreview: 'Initial',
    rawHash: 'raw',
    renderedHash: 'short',
  };
  before.incompleteScripts = [{ ...before.scripts[0], state: 'pending' }];
  before.warnings = ['1 script request(s) were still pending at capture.'];
  const after = structuredClone(before);
  after.id = 'long';
  after.observationMs = 10000;
  after.rendered.h1 = ['Service information'];
  after.metrics.renderedWords = 227;
  after.content!.renderedHash = 'long';
  after.content!.renderedPreview = 'Service information';
  after.incompleteScripts = [];
  after.warnings = [];
  let n = 0;
  await page.route('**/api/analyze', (route) => route.fulfill({ json: n++ ? after : before }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill(before.url);
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Unfinished script requests' })).toContainText(
    'runtime.js',
  );
  await page.getByRole('button', { name: 'Run longer capture and compare' }).click();
  const panel = page.getByRole('region', { name: 'Longer capture comparison' });
  await expect(
    panel.getByRole('heading', { name: 'Content differs in the longer capture' }),
  ).toBeVisible();
  await expect(panel).toContainText('14 words');
  await expect(panel).toContainText('227 words');
  await expect(panel).toContainText('Service information');
  await panel.getByText('Track unfinished script URLs across visits (1)').click();
  await expect(panel).toContainText('completed');
  await expect(panel).toContainText('pending');
  await page.screenshot({
    path: `docs/screenshots/comparison-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test('failed longer capture preserves the baseline and offers retry', async ({ page }) => {
  const r = structuredClone(demo);
  r.sample = false;
  r.id = 'baseline';
  r.warnings = ['1 script request(s) were still pending at capture.'];
  let n = 0;
  await page.route('**/api/analyze', (route) =>
    n++
      ? route.fulfill({ status: 502, json: { error: 'Longer capture timed out' } })
      : route.fulfill({ json: r }),
  );
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com/');
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await page.getByRole('button', { name: 'Run longer capture and compare' }).click();
  await expect(page.getByRole('alert')).toContainText('Longer capture timed out');
  await expect(page.getByText('LIVE REPORT')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run longer capture and compare' })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Longer capture comparison' })).toHaveCount(0);
});

test('absent metadata is not labeled as present in source', async ({ page }) => {
  const report = structuredClone(demo);
  report.sample = false;
  report.id = 'absent-test';
  report.raw.robots = [];
  report.rendered.robots = [];
  report.changes = report.changes.map((c) =>
    c.field === 'robots' ? { ...c, raw: [], rendered: [], status: 'unchanged' } : c,
  );
  await page.route('**/api/analyze', (route) => route.fulfill({ json: report }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill('https://example.com');
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  const row = page.locator('#seo-table tr').filter({ hasText: 'Robots directive' });
  await expect(row).toContainText('Absent in both');
  await expect(row).not.toContainText('In source');
});
