import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

async function capture(page: import('@playwright/test').Page, name: string) {
  if (!process.env.SCREENSHOT_DIR) return;
  await expect(page.locator('.skeleton')).toHaveCount(0);
  if (await page.locator('.map-canvas').count()) {
    await expect(page.locator('.map-marker.selected')).toBeVisible();
  }
  await fs.mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name), fullPage: true, animations: 'disabled' });
}

test('real overview connects to a persisted 72-hour model forecast', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const response = await request.get('/api/forecast/72h?city_id=cairo');
  expect(response.ok()).toBeTruthy();
  const forecast = await response.json();
  expect(forecast.values).toHaveLength(72);
  const issue = Date.parse(forecast.issued_at);
  forecast.values.forEach((row: { timestamp: string; horizon_hours: number }, index: number) => {
    expect(row.horizon_hours).toBe(index + 1);
    expect(Date.parse(row.timestamp)).toBeGreaterThan(issue);
    if (index) expect(Date.parse(row.timestamp) - Date.parse(forecast.values[index - 1].timestamp)).toBe(3_600_000);
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/Atmosphere AI/i);
  await expect(page.getByRole('heading', { name: 'A clearer view of the air.' })).toBeVisible();
  await expect(page.locator('.big-number')).not.toHaveText('—');
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await expect.poll(async () => (await page.locator('.map-canvas').boundingBox())?.height || 0).toBeGreaterThan(300);
  await expect(page.locator('.map-marker.selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByText(forecast.model_version).first()).toBeVisible();
  await capture(page, 'overview-dark.png');
  await page.getByRole('link', { name: 'Forecast studio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'See what comes next.' })).toBeVisible();
  const generatedResponse = page.waitForResponse(response => response.url().endsWith('/api/forecast/generate') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Refresh forecast', exact: true }).click();
  const generated = await generatedResponse;
  expect(generated.ok()).toBeTruthy();
  const generatedForecast = await generated.json();
  expect(generatedForecast.city.id).toBe('cairo');
  expect(generatedForecast.values).toHaveLength(72);
  expect(Date.parse(generatedForecast.issued_at)).toBeGreaterThanOrEqual(issue);
  await expect(page.getByRole('button', { name: 'Refresh forecast', exact: true })).toBeEnabled();
  await expect(page.getByText('1–24 of 72 records', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('25–48 of 72 records', { exact: true })).toBeVisible();
  await page.getByLabel('Forecast horizon', { exact: true }).selectOption('24');
  await expect(page.getByText('1–24 of 24 records', { exact: true })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('no calibrated uncertainty estimate', { exact: false })).toBeVisible();
  await capture(page, 'forecast-studio.png');
  expect(errors).toEqual([]);
});

test('worldwide search selects London and persists the city across routes', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Search worldwide cities' });
  await search.fill('London');
  const result = page.getByRole('listbox', { name: 'City results' }).getByRole('option').filter({ hasText: 'United Kingdom' }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.getByRole('heading', { name: 'London', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'City intelligence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'London, in detail.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'London, in detail.' })).toBeVisible();
});

test('all analysis screens render real model and dataset metadata', async ({ page }) => {
  await page.goto('/models');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'LightGBM', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'XGBoost', exact: true })).toBeVisible();
  for (const route of ['/city', '/explorer', '/data', '/status']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error:');
  }
  await expect(page.getByText('connected', { exact: true }).first()).toBeVisible();
  await page.goto('/comparison');
  await expect(page.getByText('Add a second city', { exact: false })).toBeVisible();
  const search = page.getByRole('combobox', { name: 'Search worldwide cities' }).last();
  await search.fill('London');
  await page.getByRole('listbox', { name: 'City results' }).getByRole('option').filter({ hasText: 'United Kingdom' }).first().click();
  await expect(page.getByRole('cell', { name: 'London', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Cairo', exact: true })).toBeVisible();
});

test('theme persistence and mobile navigation remain usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await capture(page, 'overview-light.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'City intelligence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cairo, in detail.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
  await capture(page, 'city-mobile.png');
});

test('source failure is actionable and recovers on retry', async ({ page }) => {
  const pattern = '**/api/air-quality/current?*';
  await page.route(pattern, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'QA: source temporarily unavailable' }) }));
  await page.goto('/');
  await expect(page.getByText('QA: source temporarily unavailable', { exact: false }).first()).toBeVisible();
  await page.unroute(pattern);
  await page.getByRole('button', { name: 'Try again', exact: true }).first().click();
  await expect(page.locator('.big-number')).not.toHaveText('—');
  await expect(page.getByRole('heading', { name: 'A clearer view of the air.' })).toBeVisible();
});

test('map zoom and location selection expose honest unsupported-model coverage', async ({ page }) => {
  await page.goto('/');
  const london = page.getByRole('button', { name: /^Select London/ }).first();
  await expect(london).toBeVisible();
  const before = await london.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect.poll(() => london.getAttribute('style')).not.toBe(before);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByRole('button', { name: /^Select Nairobi/ }).click();
  await expect(page.getByRole('heading', { name: 'Nairobi', exact: true })).toBeVisible();
  await expect(page.locator('.big-number')).not.toHaveText('—');
  await expect(page.getByText('Forecast coverage is limited to evaluated training cities.', { exact: false })).toBeVisible();
});

test('historical map controls retrieve actual records before the requested cutoff', async ({ page }) => {
  await page.goto('/explorer');
  const snapshotResponse = page.waitForResponse(response => response.url().includes('/api/analytics/map-snapshot?') && response.url().includes('hours_ago=24'));
  await page.getByLabel('Map time', { exact: true }).selectOption('24');
  const response = await snapshotResponse;
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const cutoff = Date.parse(data.target_timestamp);
  expect(data.cities.length).toBeGreaterThan(0);
  const cairo = data.cities.find((row: { city: { id: string } }) => row.city.id === 'cairo');
  expect(cairo.observation.pm25).not.toBeNull();
  for (const row of data.cities) {
    if (row.observation) expect(Date.parse(row.observation.timestamp)).toBeLessThanOrEqual(cutoff);
  }
  await expect(page.getByText('24 hours ago · stored estimates', { exact: true })).toBeVisible();
  await expect(page.getByText('Historical cutoff:', { exact: false })).toBeVisible();
});
