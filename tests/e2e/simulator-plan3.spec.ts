import { test, expect } from '@playwright/test';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';

test.describe('Plan III — risk-label prompts (DeepSeek)', () => {
  test.skip(!DEEPSEEK_KEY, 'DEEPSEEK_API_KEY not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/simulator');
    const setupBtn = page.getByRole('button', { name: /new experiment|configure|setup/i });
    await setupBtn.click();

    const planIII = page.getByRole('radio', { name: /plan.?iii|plan 3/i });
    if (await planIII.isVisible()) await planIII.click();

    const baseUrlInput = page.getByLabel(/base.?url/i);
    if (await baseUrlInput.isVisible()) await baseUrlInput.fill('https://api.deepseek.com');

    const modelInput = page.getByLabel(/model/i).first();
    if (await modelInput.isVisible()) await modelInput.fill('deepseek-chat');

    const apiKeyInput = page.getByLabel(/api.?key/i);
    if (await apiKeyInput.isVisible()) await apiKeyInput.fill(DEEPSEEK_KEY);

    const confirmBtn = page.getByRole('button', { name: /confirm|start|ok|apply/i });
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  });

  test('10 agents: completes with trust matrix visible', async ({ page }) => {
    await page.getByRole('button', { name: /^run$|^start$/i }).click();
    await expect(page.getByText(/NAD/i).first()).toBeVisible({ timeout: 240_000 });

    // Navigate to Social tab to check trust matrix rendered
    const socialTab = page.getByRole('tab', { name: /social/i });
    if (await socialTab.isVisible()) {
      await socialTab.click();
      await expect(page.locator('canvas, [data-testid="trust-matrix"]').first()).toBeVisible();
    }
  });

  test('20 agents: completes within timeout', async ({ page }) => {
    const agentInput = page.getByLabel(/agents/i);
    if (await agentInput.isVisible()) await agentInput.fill('20');

    await page.getByRole('button', { name: /^run$|^start$/i }).click();
    await expect(page.getByText(/NAD/i).first()).toBeVisible({ timeout: 300_000 });
  });
});
