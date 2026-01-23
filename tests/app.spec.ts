import { test, expect } from '@playwright/test';

test.describe('Solar Calculator App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the main heading and CTA', async ({ page }) => {
    await test.step('Verify header is visible', async () => {
      await expect(page.getByRole('heading', { name: /Solar \+ Battery Calculator/i })).toBeVisible();
    });

    await test.step('Verify connect CTA is displayed', async () => {
      await expect(page.getByRole('button', { name: /Connect to Octopus Energy/i })).toBeVisible();
    });

    await test.step('Verify "See Your Personalised Savings" prompt', async () => {
      await expect(page.getByText(/See Your Personalised Savings/i)).toBeVisible();
    });
  });

  test('has working How it Works dialog', async ({ page }) => {
    await test.step('Open How it Works dialog', async () => {
      await page.getByRole('button', { name: /How it works/i }).click();
    });

    await test.step('Verify dialog content', async () => {
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/How This Calculator Works/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your Actual Usage' })).toBeVisible();
    });

    await test.step('Verify tabs exist in dialog', async () => {
      await expect(page.getByRole('tab', { name: /Overview/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Formulas/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Data Sources/i })).toBeVisible();
    });

    await test.step('Close dialog', async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test('theme toggle works', async ({ page }) => {
    await test.step('Click theme toggle', async () => {
      const themeButton = page.getByRole('button', { name: /Toggle theme/i });
      await expect(themeButton).toBeVisible();
      await themeButton.click();
    });

    await test.step('Verify dark mode is applied', async () => {
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    });

    await test.step('Toggle back to light mode', async () => {
      await page.getByRole('button', { name: /Toggle theme/i }).click();
      const html = page.locator('html');
      await expect(html).not.toHaveClass(/dark/);
    });
  });

  test('footer has GitHub link and legal info', async ({ page }) => {
    await test.step('Verify footer content', async () => {
      await expect(page.getByText(/Estimates only/i)).toBeVisible();
      await expect(page.locator('footer').getByRole('link')).toHaveAttribute('href', /github\.com/);
      await expect(page.getByText(/v1\.0\.0/)).toBeVisible();
    });

    await test.step('Open legal dialog', async () => {
      await page.locator('footer').getByRole('button', { name: /More info/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
