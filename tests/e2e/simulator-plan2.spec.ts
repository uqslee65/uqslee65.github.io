import { test, expect } from '@playwright/test';
import { TEST_CONFIGS } from './helpers/deepseek-config';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';

test.describe('Plan II — DeepSeek (deepseek-chat)', () => {
  test.skip(!DEEPSEEK_KEY, 'DEEPSEEK_API_KEY not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/simulator');
    // Open experiment setup modal
    const setupBtn = page.getByRole('button', { name: /new experiment|configure|setup/i });
    await setupBtn.click();

    // Select Plan II
    const planII = page.getByRole('radio', { name: /plan.?ii|plan 2/i });
    if (await planII.isVisible()) await planII.click();

    // Fill LLM config
    const baseUrlInput = page.getByLabel(/base.?url/i);
    if (await baseUrlInput.isVisible()) await baseUrlInput.fill('https://api.deepseek.com');

    const modelInput = page.getByLabel(/model/i).first();
    if (await modelInput.isVisible()) await modelInput.fill('deepseek-chat');

    const apiKeyInput = page.getByLabel(/api.?key/i);
    if (await apiKeyInput.isVisible()) await apiKeyInput.fill(DEEPSEEK_KEY);

    // Confirm / close modal if there's a confirm button
    const confirmBtn = page.getByRole('button', { name: /confirm|start|ok|apply/i });
    if (await confirmBtn.isVisible()) await confirmBtn.click();
  });

  for (const [name, cfg] of Object.entries(TEST_CONFIGS).filter(([k]) => k.startsWith('plan2'))) {
    test(`${name}: runs to completion`, async ({ page }) => {
      // Set agent count if control is visible
      const agentInput = page.getByLabel(/agents/i);
      if (await agentInput.isVisible()) {
        await agentInput.fill(String(cfg.nAgents));
      }

      // Start simulation
      await page.getByRole('button', { name: /^run$|^start$/i }).click();

      // Wait for metrics — NAD appears when simulation completes
      await expect(page.getByText(/NAD/i).first()).toBeVisible({ timeout: 240_000 });

      // No error toast
      const errorEl = page.getByRole('alert');
      if (await errorEl.isVisible()) {
        const txt = await errorEl.textContent();
        throw new Error(`Simulation error: ${txt}`);
      }
    });
  }
});
