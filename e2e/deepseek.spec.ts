import { test, expect } from '@playwright/test';

const BACKEND = 'http://localhost:3001';

test.beforeEach(async ({ request }) => {
  await request.delete(`${BACKEND}/api/results`);
});

test('Plan II DeepSeek smoke', async ({ page }) => {
  test.skip(!process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY not set');
  test.setTimeout(5 * 60 * 1000);

  await page.addInitScript((url) => {
    localStorage.setItem('sim-backend-url', url);
  }, `${BACKEND}/api/results`);

  await page.goto('/simulator');
  await page.waitForLoadState('networkidle');

  // Select Plan II → auto-opens setup modal
  await page.getByRole('button', { name: 'Plan II LLM + Utility' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('setup-modal')).toBeVisible();

  // Step 1 → Next
  await page.getByRole('button', { name: 'Next →' }).click();
  // Step 2 (assets) → Next
  await page.getByRole('button', { name: 'Next →' }).click();
  // Step 3 (agents) → Next
  await page.getByRole('button', { name: 'Next →' }).click();

  // Step 4: Select DeepSeek provider
  const providerSelect = page.getByTestId('setup-modal').locator('select').first();
  await providerSelect.selectOption('deepseek');

  // Fill API key
  await page.locator('input[type="password"]').fill(process.env.DEEPSEEK_API_KEY!);

  // Test connection
  await page.getByRole('button', { name: 'Test Connection' }).click();
  await expect(page.getByText('Connected')).toBeVisible({ timeout: 30_000 });

  // Next → Summary
  await page.getByRole('button', { name: 'Next →' }).click();

  // Override config for speed: 4 agents, 1 round, 2 periods, 4 ticks
  await page.evaluate((cfg) => {
    (window as any).__SIM_SET_CONFIG__(cfg);
  }, { nRounds: 1, nPeriods: 2, ticksPerPeriod: 4, nAgents: 4 });
  await page.waitForTimeout(1000);

  // Run
  await page.getByTestId('run-experiment').click();

  // Wait for LLM run to complete
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Stop' })).not.toBeVisible({ timeout: 5 * 60 * 1000 });

  // Verify chart rendered
  await expect(page.getByTestId('price-chart')).toBeVisible();

  // Verify backend received results
  await page.waitForTimeout(3000);
  const res = await page.request.get(`${BACKEND}/api/results`);
  const sessions = await res.json();
  expect(sessions.length).toBeGreaterThanOrEqual(1);
  expect(sessions[0].plan).toBe('plan-ii');
});
