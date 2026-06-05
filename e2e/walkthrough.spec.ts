import { test, expect, type Page } from '@playwright/test';

// The DeepSeek key is supplied via env at test time — never committed. The live portion
// skips when it is absent (e.g. CI without a key).
const KEY = process.env.DEEPSEEK_API_KEY;

async function startTour(page: Page) {
  // Bound the LLM run so the live gate test is fast (real API call, tiny config).
  await page.addInitScript(() => { (window as unknown as { __WT_LLM_SMALL__: boolean }).__WT_LLM_SMALL__ = true; });
  await page.goto('/app/');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('wt-launch').click();
  await expect(page.getByTestId('walkthrough-card')).toBeVisible();
}

/** Click Next (when enabled) until `predicate` holds or we run out of steps. */
async function advanceUntil(page: Page, predicate: () => Promise<boolean>, max = 16) {
  for (let i = 0; i < max; i++) {
    if (await predicate()) return;
    const next = page.getByTestId('wt-next');
    if (await next.isEnabled().catch(() => false)) await next.click();
    await page.waitForTimeout(500);
  }
}

test('Plan I — proof renders the 3-column reconciliation with all claims satisfied', async ({ page }) => {
  test.setTimeout(60_000);
  await startTour(page);

  await advanceUntil(page, () => page.getByTestId('comparison-panel').isVisible().catch(() => false));
  const panel = page.getByTestId('comparison-panel');
  await expect(panel).toBeVisible();

  // three source columns
  await expect(panel).toContainText('DLM');
  await expect(panel).toContainText('m0nius');
  await expect(panel).toContainText('Ours');

  // the faithfulness claims all hold for our seeded, 10-session-averaged Plan I run
  const claims = page.getByTestId('claim-list');
  await expect(claims).toContainText('Point 1');
  await expect(claims).toContainText('Point 2');
  await expect(claims).not.toContainText('✗');
});

test('Plan II — the walkthrough cannot pass without a real API key', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  await startTour(page);

  // advance until the Plan II key field appears
  await advanceUntil(page, () => page.getByTestId('wt-api-key').isVisible().catch(() => false));
  await expect(page.getByTestId('wt-api-key')).toBeVisible();

  // GATE: with no key, neither Run nor Next is allowed — the tour is un-completable.
  await expect(page.getByTestId('wt-run-llm')).toBeDisabled();
  await expect(page.getByTestId('wt-next')).toBeDisabled();

  test.skip(!KEY, 'DEEPSEEK_API_KEY not set — skipping live gate-open assertion');

  // With a real key, a live (bounded) DeepSeek run must complete before Next unlocks.
  await page.getByTestId('wt-api-key').fill(KEY!);
  await expect(page.getByTestId('wt-run-llm')).toBeEnabled();
  await page.getByTestId('wt-run-llm').click();
  await expect(page.getByTestId('wt-next')).toBeEnabled({ timeout: 5 * 60 * 1000 });
});
