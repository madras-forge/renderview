import { test, expect } from '@playwright/test';
import { demo } from '../../src/demo';
const live = { ...demo, id: 'saved-baseline', sample: false, warnings: [], errors: [], url: 'https://example.com/', finalUrl: 'https://example.com/' };
test('save, reload, import, and compare a baseline', async ({ page }) => {
  await page.route('**/api/analyze', route => route.fulfill({ json: live }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Page URL' }).fill(live.url);
  await page.getByRole('button', { name: 'Analyze page', exact: true }).click();
  await page.getByRole('button', { name: 'Save current report' }).click();
  await expect(page.getByText('Report saved in this browser.')).toBeVisible();
  await page.reload();
  await page.getByText('Saved reports & release comparison').click();
  await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(1);
  await page.getByLabel('Import report JSON').setInputFiles({ name: 'after.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...live, id: 'after', rendered: { ...live.rendered, title: [] } })) });
  await page.getByLabel('Compare current report with saved baseline').selectOption('saved-baseline');
  await expect(page.getByRole('heading', { name: 'Finding changes since baseline' })).toBeVisible();
  await expect(page.locator('.release-comparison').getByText('New', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Import report JSON').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.getByText('This file is not a valid renderview report. Import an exported JSON report.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('batch continues after failures and identifies repeated metadata', async ({ page }) => {
  await page.route('**/api/analyze', route => {
    const { url } = route.request().postDataJSON();
    return url.endsWith('/fail') ? route.fulfill({ status: 502, json: { error: 'Target unavailable' } }) : route.fulfill({ json: { ...live, id: url, url, finalUrl: url } });
  });
  await page.goto('/');
  await page.getByText('Check multiple pages', { exact: false }).click();
  await page.getByLabel('URLs to audit').fill('https://example.com/a\nhttps://example.com/fail\nhttps://example.com/b');
  await page.getByRole('button', { name: 'Run page checks' }).click();
  await expect(page.getByText('Finished: 3 of 3 URLs attempted.')).toBeVisible();
  await expect(page.getByText('Target unavailable')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Repeated metadata across checked pages' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View findings' })).toHaveCount(2);
});
