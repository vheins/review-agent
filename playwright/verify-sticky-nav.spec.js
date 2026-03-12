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

test.describe('Sticky Top Navigation', () => {
    test('verifies top navigation has sticky positioning', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: 'Agentic Bunshin' })).toBeVisible();

            // Take initial screenshot
            await page.screenshot({
                path: testInfo.outputPath('initial-view.png'),
                fullPage: false
            });

            // Verify top navigation elements are visible
            const newButton = page.getByRole('button', { name: 'New' });
            await expect(newButton).toBeVisible();

            // Get navigation element and verify it has sticky positioning
            const navInfo = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const styles = window.getComputedStyle(nav);
                const classList = Array.from(nav.classList);
                const rect = nav.getBoundingClientRect();
                return {
                    position: styles.position,
                    top: styles.top,
                    zIndex: styles.zIndex,
                    hasSticky: classList.includes('sticky'),
                    hasTop0: classList.includes('top-0'),
                    classList: classList,
                    boundingTop: rect.top,
                    boundingHeight: rect.height
                };
            });

            console.log('Navigation info:', navInfo);

            // Verify navigation has correct sticky classes and styles
            expect(navInfo.hasSticky).toBe(true);
            expect(navInfo.hasTop0).toBe(true);
            expect(navInfo.position).toBe('sticky');
            expect(navInfo.top).toBe('0px');
            expect(navInfo.boundingTop).toBe(0); // Should be at top of viewport

            // Click different tabs to verify navigation stays visible
            const tabs = ['Metrics', 'Team', 'Security', 'Configuration'];

            for (const tabName of tabs) {
                await page.getByRole('button', { name: tabName, exact: true }).click();
                await page.waitForTimeout(300);

                // Verify New button still visible
                await expect(newButton).toBeVisible();

                // Take screenshot
                await page.screenshot({
                    path: testInfo.outputPath(`tab-${tabName.toLowerCase()}.png`),
                    fullPage: false
                });
            }

            // Take full page screenshot
            await page.screenshot({
                path: testInfo.outputPath('full-page.png'),
                fullPage: true
            });

            console.log('✓ Sticky navigation verified successfully');

        } finally {
            await electronApp.close();
        }
    });

    test('verifies New button dropdown works', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: 'Agentic Bunshin' })).toBeVisible();

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

            // Click Create Task
            await page.getByText('Create Task').click();
            await page.waitForTimeout(200);

            // Verify dropdown menu is closed (check the dropdown container, not the log text)
            const dropdownVisible = await page.evaluate(() => {
                const dropdown = document.querySelector('.absolute.right-0.top-full');
                return dropdown !== null;
            });

            expect(dropdownVisible).toBe(false);

            console.log('✓ New button dropdown verified successfully');

        } finally {
            await electronApp.close();
        }
    });
});
