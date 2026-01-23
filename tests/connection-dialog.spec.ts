import { test, expect } from '@playwright/test';

test.describe('Octopus Connection Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens connection dialog when CTA is clicked', async ({ page }) => {
    await test.step('Click connect button', async () => {
      await page.getByRole('button', { name: /Connect to Octopus Energy/i }).click();
    });

    await test.step('Verify dialog opens', async () => {
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Connect to Octopus Energy' })).toBeVisible();
    });
  });

  test('dialog has API key input field', async ({ page }) => {
    await test.step('Open dialog', async () => {
      await page.getByRole('button', { name: /Connect to Octopus Energy/i }).click();
    });

    await test.step('Verify API key input exists', async () => {
      await expect(page.getByLabel(/Octopus API Key/i)).toBeVisible();
    });

    await test.step('Verify help link to Octopus dashboard', async () => {
      await expect(page.getByRole('link', { name: /Octopus account dashboard/i })).toBeVisible();
    });
  });

  test('dialog closes when pressing Escape', async ({ page }) => {
    await test.step('Open dialog', async () => {
      await page.getByRole('button', { name: /Connect to Octopus Energy/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    await test.step('Press Escape to close', async () => {
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test('connect button is disabled without API key', async ({ page }) => {
    await test.step('Open dialog', async () => {
      await page.getByRole('button', { name: /Connect to Octopus Energy/i }).click();
    });

    await test.step('Verify connect button is disabled when input is empty', async () => {
      const connectButton = page.getByRole('button', { name: /Connect Account/i });
      await expect(connectButton).toBeVisible();
      await expect(connectButton).toBeDisabled();
    });
  });
});
