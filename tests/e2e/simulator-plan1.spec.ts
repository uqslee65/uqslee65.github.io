import { test, expect } from '@playwright/test';

test.describe('Plan I — Algorithmic (no API key required)', () => {
  test('runs to completion and populates timeline + metrics', async ({ page }) => {
    await page.goto('/simulator');

    // ── Step 1: open setup wizard ──────────────────────────────────────────
    await page.getByRole('button', { name: /^setup$/i }).click();

    // Select Plan I (the card button whose text includes "Plan I")
    await page.getByRole('button', { name: /plan.?i\b/i }).first().click();
    await page.getByRole('button', { name: /next/i }).click();

    // ── Step 2: asset config — advance without changes ─────────────────────
    await page.getByRole('button', { name: /next/i }).click();

    // Plan I skips step 3 (LLM config) and goes straight to step 4 (review).
    // Verify we are on the review step by checking for "Run Experiment".
    await expect(page.getByRole('button', { name: /run experiment/i })).toBeVisible();

    // ── Step 4: run ────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /run experiment/i }).click();

    // Modal should close after launching
    await expect(page.getByRole('button', { name: /run experiment/i })).not.toBeVisible();

    // Plan I is synchronous — the Play button becomes enabled immediately
    await expect(page.getByRole('button', { name: /play/i })).toBeEnabled({ timeout: 15_000 });

    // ── Timeline populated ─────────────────────────────────────────────────
    // RoundStrip renders clickable <button> cells (one per period) once data is ready.
    // The title attribute follows the pattern "R<n> P<n>".
    const firstPeriodCell = page.locator('button[title^="R1 P"]').first();
    await expect(firstPeriodCell).toBeVisible({ timeout: 10_000 });

    // ── Metrics panel shows numeric values (not "—") ───────────────────────
    // MetricsPanel renders four rows; the "Ours" column uses .toFixed(3),
    // so each cell will contain a decimal number rather than the dash placeholder.
    // We look for at least one table cell containing a digit followed by a period
    // and three digits (e.g. "1.234").
    const metricsCell = page.locator('table td').filter({ hasText: /\d+\.\d{3}/ }).first();
    await expect(metricsCell).toBeVisible({ timeout: 10_000 });

    // ── No error alert ────────────────────────────────────────────────────
    const errorEl = page.getByRole('alert');
    if (await errorEl.isVisible()) {
      const txt = await errorEl.textContent();
      throw new Error(`Simulation error: ${txt}`);
    }
  });
});
