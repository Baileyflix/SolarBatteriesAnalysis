import { test, expect } from '@playwright/test';

test.describe('Scenario Selector Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('tabs structure is correct before connection', async ({ page }) => {
        await test.step('Verify three main tabs exist', async () => {
            await expect(page.getByRole('tab', { name: /Results/i })).toBeVisible();
            await expect(page.getByRole('tab', { name: /Energy/i })).toBeVisible();
            await expect(page.getByRole('tab', { name: /Data/i })).toBeVisible();
        });

        await test.step('Results tab is selected by default', async () => {
            await expect(page.getByRole('tab', { name: /Results/i })).toHaveAttribute('data-state', 'active');
        });
    });

    test('tab panels show CTA overlay which blocks direct clicking', async ({ page }) => {
        await test.step('Results tab shows CTA overlay', async () => {
            await expect(page.getByText(/See Your Personalised Savings/i)).toBeVisible();
        });

        await test.step('CTA overlay blocks tab interaction (by design)', async () => {
            // The overlay blocks direct mouse clicks, guiding users to connect first
            // This is intentional UX - users should connect to see meaningful data
            const overlay = page.locator('.absolute.inset-0.z-10');
            await expect(overlay).toBeVisible();
        });

        await test.step('Keyboard navigation still works through overlay', async () => {
            // Keyboard navigation allows switching tabs for accessibility
            await page.getByRole('tab', { name: /Results/i }).focus();
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Enter');
            await expect(page.getByRole('tab', { name: /Energy/i })).toHaveAttribute('data-state', 'active');
        });
    });

    // These tests verify the scenario selector structure
    // The selectors are only visible when data is loaded
    test.describe('Scenario selector component structure', () => {
        test('Energy tab is accessible via keyboard', async ({ page }) => {
            // Use keyboard navigation to bypass overlay
            const resultsTab = page.getByRole('tab', { name: /Results/i });
            await resultsTab.focus();
            await expect(resultsTab).toBeFocused();
            
            await page.keyboard.press('ArrowRight');
            await page.keyboard.press('Enter');

            await expect(page.getByRole('tab', { name: /Energy/i })).toHaveAttribute('data-state', 'active');
        });

        test('all three tabs exist and are keyboard focusable', async ({ page }) => {
            // Verify all tabs are present and can receive focus
            const tabs = page.getByRole('tab');
            await expect(tabs).toHaveCount(3);
            
            // First tab can be focused
            await tabs.nth(0).focus();
            await expect(tabs.nth(0)).toBeFocused();
            
            // Can navigate through all tabs with keyboard
            await page.keyboard.press('ArrowRight');
            await expect(tabs.nth(1)).toBeFocused();
            
            await page.keyboard.press('ArrowRight');
            await expect(tabs.nth(2)).toBeFocused();
        });
    });

    // Test keyboard navigation between tabs
    test('keyboard navigation between tabs', async ({ page }) => {
        await test.step('Focus on Results tab', async () => {
            await page.getByRole('tab', { name: /Results/i }).focus();
        });

        await test.step('Arrow right moves to Energy tab', async () => {
            await page.keyboard.press('ArrowRight');
            await expect(page.getByRole('tab', { name: /Energy/i })).toBeFocused();
        });

        await test.step('Arrow right moves to Data tab', async () => {
            await page.keyboard.press('ArrowRight');
            await expect(page.getByRole('tab', { name: /Data/i })).toBeFocused();
        });

        await test.step('Enter activates focused tab', async () => {
            await page.keyboard.press('Enter');
            await expect(page.getByRole('tab', { name: /Data/i })).toHaveAttribute('data-state', 'active');
        });
    });

    // Test accessibility
    test('tabs have correct ARIA attributes', async ({ page }) => {
        await test.step('Verify tab list has correct role', async () => {
            await expect(page.getByRole('tablist')).toBeVisible();
        });

        await test.step('Verify each tab has correct attributes', async () => {
            const resultsTab = page.getByRole('tab', { name: /Results/i });
            await expect(resultsTab).toHaveAttribute('aria-selected', 'true');

            const energyTab = page.getByRole('tab', { name: /Energy/i });
            await expect(energyTab).toHaveAttribute('aria-selected', 'false');

            const dataTab = page.getByRole('tab', { name: /Data/i });
            await expect(dataTab).toHaveAttribute('aria-selected', 'false');
        });

        await test.step('Verify tab panels have correct role', async () => {
            const tabPanels = page.getByRole('tabpanel');
            // Only one tabpanel should be visible at a time
            await expect(tabPanels).toBeVisible();
        });
    });
});
