import { test, expect } from '@playwright/test';

test.describe('Scenario Configuration Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays configuration panel sections (visible behind overlay)', async ({ page }) => {
    await test.step('Verify Solar PV System section exists', async () => {
      await expect(page.getByText('Solar PV System')).toBeVisible();
    });

    await test.step('Verify Battery Storage section exists', async () => {
      await expect(page.getByText('Battery Storage')).toBeVisible();
    });

    await test.step('Verify Energy Tariff section exists', async () => {
      await expect(page.getByText('Energy Tariff')).toBeVisible();
    });

    await test.step('Verify Financial Details section exists', async () => {
      await expect(page.getByText('Financial Details')).toBeVisible();
    });
  });

  test('displays CTA overlay when not connected', async ({ page }) => {
    await test.step('Verify overlay CTA is displayed', async () => {
      await expect(page.getByText('See Your Personalised Savings')).toBeVisible();
      await expect(page.getByRole('button', { name: /Connect to Octopus Energy/i })).toBeVisible();
    });

    await test.step('Verify panel is blurred', async () => {
      const gridContainer = page.locator('.blur-sm');
      await expect(gridContainer).toBeVisible();
    });
  });

  test('configuration panel card has correct header', async ({ page }) => {
    await test.step('Verify card title', async () => {
      await expect(page.getByText('Your Solar Setup')).toBeVisible();
      await expect(page.getByText('Adjust your system to see how it would affect your bills')).toBeVisible();
    });
  });

  test('tariff details are visible showing default Octopus Flux rates', async ({ page }) => {
    await test.step('Verify tariff description is shown', async () => {
      await expect(page.getByText(/Best for solar \+ battery/i)).toBeVisible();
    });

    await test.step('Verify import rate is displayed', async () => {
      await expect(page.getByText('Import', { exact: true })).toBeVisible();
    });

    await test.step('Verify export rate is displayed', async () => {
      await expect(page.getByText('Export', { exact: true })).toBeVisible();
    });
  });

  test('default values are displayed correctly', async ({ page }) => {
    await test.step('Verify default PV system size (medium = 5.0 kWp)', async () => {
      await expect(page.getByText('5.0 kWp')).toBeVisible();
    });

    await test.step('Verify default battery capacity (medium = 10 kWh)', async () => {
      await expect(page.getByText('10.0 kWh')).toBeVisible();
    });
  });

  test('slider labels show correct ranges', async ({ page }) => {
    await test.step('Verify PV slider range', async () => {
      await expect(page.getByText('1 kWp (~3 panels)')).toBeVisible();
      await expect(page.getByText('10 kWp (~25 panels)')).toBeVisible();
    });

    await test.step('Verify battery slider range', async () => {
      await expect(page.getByText('0 kWh (no battery)')).toBeVisible();
      await expect(page.getByText('30 kWh')).toBeVisible();
    });
  });

  test('info tooltips exist for key fields', async ({ page }) => {
    await test.step('Verify info buttons exist', async () => {
      const infoButtons = page.getByRole('button', { name: /More information/i });
      // Should have 4 info buttons: System Size, Battery Capacity, System Cost, Monthly DD
      await expect(infoButtons).toHaveCount(4);
    });
  });
});
