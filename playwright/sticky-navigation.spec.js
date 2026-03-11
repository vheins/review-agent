import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const electronBinary = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron');
const appEntry = path.join(projectRoot, 'electron', 'main.cjs');

async function launchElectronApp() {
    const launchEnv = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        ELECTRON_USE_MOCK_API: '1',
        ELECTRON_DISABLE_SINGLE_INSTANCE_LOCK: '1'
    };

    delete launchEnv.ELECTRON_RUN_AS_NODE;

    return electron.launch({
        executablePath: electronBinary,
        args: [appEntry],
        env: launchEnv
    });
}

test.describe('Sticky Navigation', () => {
    test('top navigation stays visible when scrolling', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: '🥷 Agentic Bunshin 🥷' })).toBeVisible();

            // Take screenshot before scroll
            await page.screenshot({
                path: testInfo.outputPath('before-scroll.png'),
                fullPage: false
            });

            // Verify top navigation elements are visible
            const newButton = page.getByRole('button', { name: 'New' });
            await expect(newButton).toBeVisible();

            // Get initial position of top navigation
            const navBefore = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const rect = nav.getBoundingClientRect();
                return { top: rect.top, visible: rect.top >= 0 };
            });

            console.log('Navigation position before scroll:', navBefore);

            // Scroll down significantly - ensure we scroll the document body
            await page.evaluate(() => {
                // Force scroll on document
                document.documentElement.scrollTop = 500;
                document.body.scrollTop = 500;
            });

            // Wait a bit for scroll to complete
            await page.waitForTimeout(500);

            // Take screenshot after scroll
            await page.screenshot({
                path: testInfo.outputPath('after-scroll.png'),
                fullPage: false
            });

            // Verify top navigation is still visible and at top
            const navAfter = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const rect = nav.getBoundingClientRect();
                return {
                    top: rect.top,
                    visible: rect.top >= 0 && rect.top < 100,
                    position: window.getComputedStyle(nav).position
                };
            });

            console.log('Navigation position after scroll:', navAfter);

            // Verify navigation is sticky
            expect(navAfter.position).toBe('sticky');
            expect(navAfter.visible).toBe(true);
            expect(navAfter.top).toBeLessThanOrEqual(10); // Should be at or near top

            // Verify New button is still visible after scroll
            await expect(newButton).toBeVisible();

            // Take full page screenshot to show entire layout
            await page.screenshot({
                path: testInfo.outputPath('full-page-scrolled.png'),
                fullPage: true
            });

        } finally {
            await electronApp.close();
        }
    });

    test('theme switcher and New button work in top navigation', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: '🥷 Agentic Bunshin 🥷' })).toBeVisible();

            // Click New button to open dropdown
            const newButton = page.getByRole('button', { name: 'New' });
            await newButton.click();

            // Wait for dropdown to appear
            await page.waitForTimeout(200);

            // Verify dropdown menu items
            await expect(page.getByText('Create Task')).toBeVisible();
            await expect(page.getByText('New Chat')).toBeVisible();

            await page.screenshot({
                path: testInfo.outputPath('new-dropdown-open.png'),
                fullPage: false
            });

            // Close dropdown by clicking outside
            await page.click('body', { position: { x: 100, y: 100 } });
            await page.waitForTimeout(200);

            // Verify dropdown is closed
            await expect(page.getByText('Create Task')).not.toBeVisible();

            // Test theme switcher
            const themeSwitcher = page.locator('button').filter({ hasText: /System|Dark|Light/ }).first();
            await expect(themeSwitcher).toBeVisible();

            await page.screenshot({
                path: testInfo.outputPath('theme-switcher.png'),
                fullPage: false
            });

        } finally {
            await electronApp.close();
        }
    });
});
