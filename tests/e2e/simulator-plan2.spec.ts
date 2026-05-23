import { test, expect } from '@playwright/test';
import { TEST_CONFIGS, setupLLMPlan } from './helpers/deepseek-config';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? '';

test.describe('Plan II — DeepSeek (deepseek-chat)', () => {
  test.skip(!DEEPSEEK_KEY, 'DEEPSEEK_API_KEY not set');

  for (const [name] of Object.entries(TEST_CONFIGS).filter(([k]) => k.startsWith('plan2'))) {
    test(`${name}: runs to completion`, async ({ page }) => {
      await setupLLMPlan(page, 'II', DEEPSEEK_KEY);

      // Play button enables when simulation data is ready
      await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 240_000 });

      // No error alert
      const errorEl = page.getByRole('alert');
      if (await errorEl.isVisible()) {
        const txt = await errorEl.textContent();
        throw new Error(`Simulation error: ${txt}`);
      }
    });
  }
});
