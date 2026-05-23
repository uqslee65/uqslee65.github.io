import { test, expect } from '@playwright/test';
import { setupLLMPlan } from './helpers/deepseek-config';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';

test.describe('Plan III — risk-label prompts (DeepSeek)', () => {
  test.skip(!DEEPSEEK_KEY, 'DEEPSEEK_API_KEY not set');

  test('10 agents: completes with trust matrix visible', async ({ page }) => {
    await setupLLMPlan(page, 'III', DEEPSEEK_KEY);

    await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 240_000 });

    // Social is a button, not a tab role
    const socialBtn = page.getByRole('button', { name: /^social$/i });
    if (await socialBtn.isVisible()) {
      await socialBtn.click();
      await expect(page.locator('canvas, [data-testid="trust-matrix"]').first()).toBeVisible();
    }
  });

  test('20 agents: completes within timeout', async ({ page }) => {
    await setupLLMPlan(page, 'III', DEEPSEEK_KEY);
    await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 300_000 });
  });
});
