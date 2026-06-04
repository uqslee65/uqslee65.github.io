import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = 'http://localhost:3001';
const RESULTS_DIR = path.resolve(__dirname, '../server/results');

test.beforeEach(async ({ request }) => {
  await request.delete(`${BACKEND}/api/results`);
});

async function openSetupAndRun(page: import('@playwright/test').Page, opts?: {
  selectPlanII?: boolean;
  configureGemini?: boolean;
  overrideConfig?: Record<string, unknown>;
  setupBackendUrl?: boolean;
}) {
  if (opts?.setupBackendUrl) {
    await page.addInitScript((url) => {
      localStorage.setItem('sim-backend-url', url);
    }, `${BACKEND}/api/results`);
  }

  await page.goto('/simulator');
  await page.waitForLoadState('networkidle');

  if (opts?.selectPlanII) {
    await page.getByRole('button', { name: 'Plan II LLM + Utility' }).click();
    await page.waitForTimeout(500);
  } else {
    await page.getByRole('button', { name: 'Setup' }).click();
  }

  await expect(page.getByTestId('setup-modal')).toBeVisible();

  // Step 1: Plan selection — click Next
  await page.getByRole('button', { name: 'Next →' }).click();

  // Step 2: Single asset (default Linear Declining) — optional R4 swap is set via overrideConfig
  await page.getByRole('button', { name: 'Next →' }).click();

  // Step 3: Agents + risk
  await page.getByRole('button', { name: 'Next →' }).click();

  // Step 4: LLM config (only for Plan II/III)
  if (opts?.configureGemini) {
    // Gemini is now default — just fill API key
    await page.locator('input[type="password"]').fill(process.env.GEMINI_API_KEY!);
    await expect(page.locator('select').filter({ hasText: 'gemini-2.0-flash' })).toBeVisible();

    // Test connection
    await page.getByRole('button', { name: 'Test Connection' }).click();
    await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Next →' }).click();
  }

  // Override config if needed (before Run) — wait for React re-render
  if (opts?.overrideConfig) {
    await page.evaluate((cfg) => {
      (window as any).__SIM_SET_CONFIG__(cfg);
    }, opts.overrideConfig);
    await page.waitForTimeout(1000);
  }

  // Step 5 (summary): Click Run Experiment
  await page.getByTestId('run-experiment').click();
}

// --- Test 1: Plan I single-asset smoke ---
test('Plan I single-asset smoke', async ({ page }) => {
  test.setTimeout(60_000);
  await openSetupAndRun(page);

  // Wait for price chart to render with data
  const chart = page.getByTestId('price-chart');
  await expect(chart).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('fv-path')).toBeVisible();

  // Download JSON and verify structure
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-json').click(),
  ]);

  const tmpPath = await download.path();
  expect(tmpPath).toBeTruthy();
  const data = JSON.parse(fs.readFileSync(tmpPath!, 'utf-8'));

  expect(data.config.plan).toBe('plan-i');
  expect(data.periods).toHaveLength(80); // 4 rounds × 20 periods

  // Verify FV is declining in round 1
  const round1 = data.periods.filter((p: any) => p.round === 1);
  for (let i = 1; i < round1.length; i++) {
    expect(round1[i].fv).toBeLessThanOrEqual(round1[i - 1].fv);
  }
});

// --- Test 2: Plan I round-4 asset-swap smoke (single asset, swaps at the replacement round) ---
test('Plan I R4 asset-swap smoke', async ({ page }) => {
  test.setTimeout(60_000);
  await openSetupAndRun(page, { overrideConfig: { postAssetClass: 'cyclical' } });

  // Single price chart (no multi-asset tabs — portfolios are not supported).
  await expect(page.getByTestId('price-chart')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('fv-path')).toBeVisible();
  await expect(page.getByTestId('asset-tabs')).toHaveCount(0);

  // Download JSON and verify the swap is recorded and the session is single-asset.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-json').click(),
  ]);
  const data = JSON.parse(fs.readFileSync((await download.path())!, 'utf-8'));
  expect(data.config.plan).toBe('plan-i');
  expect(data.config.postAssetClass).toBe('cyclical');
  expect(data.config.assets).toBeUndefined();
  expect(data.periods).toHaveLength(80);
});

// --- Test 3: Plan II Gemini smoke ---
test('Plan II Gemini smoke', async ({ page }) => {
  test.skip(!process.env.GEMINI_API_KEY, 'GEMINI_API_KEY not set');
  test.setTimeout(5 * 60 * 1000);

  await openSetupAndRun(page, {
    selectPlanII: true,
    configureGemini: true,
    setupBackendUrl: true,
    overrideConfig: { nRounds: 1, nPeriods: 2, ticksPerPeriod: 4, nAgents: 4 },
  });

  // Wait for LLM simulation to complete (Stop button disappears)
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Stop' })).not.toBeVisible({ timeout: 5 * 60 * 1000 });

  // Verify chart rendered
  await expect(page.getByTestId('price-chart')).toBeVisible();

  // Verify mock backend received the upload
  await page.waitForTimeout(3000); // allow async upload to complete
  const res = await page.request.get(`${BACKEND}/api/results`);
  const sessions = await res.json();
  expect(sessions.length).toBeGreaterThanOrEqual(1);
  expect(sessions[0].plan).toBe('plan-ii');

  // Verify JSON file on disk
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  expect(files.length).toBeGreaterThanOrEqual(1);
  expect(files.some(f => f.startsWith('plan-ii'))).toBe(true);
});

// --- Test 4: Results upload verification ---
test('Results upload verification', async ({ page, request }) => {
  test.setTimeout(60_000);

  await openSetupAndRun(page, { setupBackendUrl: true });

  // Wait for simulation + async upload
  await expect(page.getByTestId('price-chart')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Verify session received by backend
  const listRes = await request.get(`${BACKEND}/api/results`);
  const sessions = await listRes.json();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].plan).toBe('plan-i');
  expect(sessions[0].n_agents).toBe(10);

  // Verify full session detail
  const detailRes = await request.get(`${BACKEND}/api/results/${sessions[0].id}`);
  const detail = await detailRes.json();
  expect(detail.config.plan).toBe('plan-i');
  expect(detail.periods).toHaveLength(80);

  // Verify JSON file on disk
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  expect(files).toHaveLength(1);
  const fileContent = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, files[0]), 'utf-8'));
  expect(fileContent.config.plan).toBe('plan-i');
  expect(fileContent.periods).toHaveLength(80);
});
