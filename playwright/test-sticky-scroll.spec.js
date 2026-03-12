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

test.describe('Sticky Navigation Scroll Test', () => {
    test('navigation stays at top when page is scrolled', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: 'Agentic Bunshin' })).toBeVisible();

            // Get initial navigation position
            const navBefore = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const rect = nav.getBoundingClientRect();
                return {
                    top: rect.top,
                    position: window.getComputedStyle(nav).position,
                    scrollY: window.scrollY
                };
            });

            console.log('Before scroll:', navBefore);

            // Take screenshot before scroll
            await page.screenshot({
                path: testInfo.outputPath('before-scroll.png'),
                fullPage: false
            });

            // Scroll down the page
            await page.evaluate(() => {
                window.scrollTo(0, 800);
            });

            // Wait for scroll to complete
            await page.waitForTimeout(500);

            // Get navigation position after scroll
            const navAfter = await page.evaluate(() => {
                const nav = document.querySelector('nav');
                const rect = nav.getBoundingClientRect();
                return {
                    top: rect.top,
                    position: window.getComputedStyle(nav).position,
                    scrollY: window.scrollY,
                    isVisible: rect.top >= 0 && rect.top < 100
                };
            });

            console.log('After scroll:', navAfter);

            // Take screenshot after scroll
            await page.screenshot({
                path: testInfo.outputPath('after-scroll.png'),
                fullPage: false
            });

            // Verify sticky behavior
            expect(navAfter.position).toBe('sticky');
            expect(navAfter.scrollY).toBeGreaterThan(0); // Page was scrolled
            expect(navAfter.top).toBe(0); // Navigation should stay at top (0px from viewport top)
            expect(navAfter.isVisible).toBe(true);

            // Verify New button is still visible
            await expect(page.getByRole('button', { name: 'New' })).toBeVisible();

            console.log('✓ Sticky navigation works correctly on scroll!');

        } finally {
            await electronApp.close();
        }
    });

    test('navigation stays visible when scrolling through long content', async ({ }, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1280, height: 900 });

            // Wait for app to load
            await expect(page.getByRole('heading', { name: 'Agentic Bunshin' })).toBeVisible();

            // Go to Metrics tab (has more content)
            await page.getByRole('button', { name: 'Metrics', exact: true }).click();
            await page.waitForTimeout(500);

            // Scroll multiple times and verify navigation stays visible
            const scrollPositions = [300, 600, 900, 1200];

            for (const scrollPos of scrollPositions) {
                await page.evaluate((pos) => {
                    window.scrollTo(0, pos);
                }, scrollPos);

                await page.waitForTimeout(300);

                const navInfo = await page.evaluate(() => {
                    const nav = document.querySelector('nav');
                    const rect = nav.getBoundingClientRect();
                    return {
                        top: rect.top,
                        scrollY: window.scrollY
                    };
                });

                console.log(`Scroll position ${scrollPos}:`, navInfo);

                // Navigation should always be at top
                expect(navInfo.top).toBe(0);

                // Verify New button is visible
                await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
            }

            // Take final screenshot
            await page.screenshot({
                path: testInfo.outputPath('scrolled-metrics.png'),
                fullPage: false
            });

            console.log('✓ Navigation stays sticky through multiple scroll positions!');

        } finally {
            await electronApp.close();
        }
    });
});
