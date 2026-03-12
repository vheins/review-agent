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

async function waitForDashboardReady(page) {
    await expect(page.getByRole('heading', { name: 'Agentic Bunshin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review Queue' })).toBeVisible();
}

test.describe('Electron dashboard UI', () => {
    test('renders the Tailwind dashboard shell and main tabs', async ({}, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1600, height: 1200 });
            await waitForDashboardReady(page);

            const tabs = [
                { trigger: 'Overview', assert: () => expect(page.getByRole('heading', { name: 'Review Queue' })).toBeVisible(), fileName: 'overview.png' },
                {
                    trigger: 'PRs',
                    assert: async () => {
                        await expect(page.getByRole('button', { name: 'View', exact: true })).toBeVisible();
                        await expect(page.getByRole('button', { name: 'Auto-fix', exact: true })).toBeVisible();
                    },
                    fileName: 'prs.png'
                },
                { trigger: 'Metrics', assert: () => expect(page.getByRole('heading', { name: 'Review Time Trend', exact: true })).toBeVisible(), fileName: 'metrics.png' },
                { trigger: 'Team', assert: () => expect(page.getByRole('heading', { name: 'Developer Workload', exact: true })).toBeVisible(), fileName: 'team.png' },
                { trigger: 'Security', assert: () => expect(page.getByRole('heading', { name: 'Recent Security Alerts', exact: true })).toBeVisible(), fileName: 'security.png' },
                { trigger: 'Configuration', assert: () => expect(page.getByRole('heading', { name: 'Configuration Editor', exact: true })).toBeVisible(), fileName: 'config.png' },
                { trigger: 'Logs', assert: () => expect(page.getByRole('heading', { name: 'Live Process Logs', exact: true })).toBeVisible(), fileName: 'logs.png' }
            ];

            for (const tab of tabs) {
                await page.getByRole('button', { name: tab.trigger, exact: true }).click();
                await tab.assert();
                await page.screenshot({
                    path: testInfo.outputPath(tab.fileName),
                    fullPage: true
                });
            }
        } finally {
            await electronApp.close();
        }
    });

    test('supports responsive resize and theme switching', async ({}, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await waitForDashboardReady(page);

            const windowCapabilities = await electronApp.evaluate(async ({ BrowserWindow }) => {
                const win = BrowserWindow.getAllWindows()[0];

                return {
                    minimizable: win.isMinimizable(),
                    resizable: win.isResizable(),
                    minimumSize: win.getMinimumSize()
                };
            });

            expect(windowCapabilities.minimizable).toBe(true);
            expect(windowCapabilities.resizable).toBe(true);
            expect(windowCapabilities.minimumSize).toEqual([375, 640]);

            await page.setViewportSize({ width: 430, height: 932 });
            await page.getByRole('button', { name: 'Overview', exact: true }).click();

            const hasViewportOverflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 1;
            });

            expect(hasViewportOverflow).toBe(false);

            await page.screenshot({
                path: testInfo.outputPath('overview-mobile-dark.png'),
                fullPage: true
            });

            await page.locator('#themeMode').selectOption('light');
            await expect(page.locator('body')).toHaveAttribute('data-theme', 'light');

            await page.getByRole('button', { name: 'PRs', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Execution Timeline', exact: true })).toBeVisible();
            const hasPrViewportOverflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 1;
            });
            expect(hasPrViewportOverflow).toBe(false);

            await page.getByRole('button', { name: 'Configuration', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Configuration Editor', exact: true })).toBeVisible();
            await expect(page.getByText('Automation Controls', { exact: true })).toBeVisible();
            const hasConfigViewportOverflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 1;
            });
            expect(hasConfigViewportOverflow).toBe(false);

            await page.screenshot({
                path: testInfo.outputPath('overview-mobile-light.png'),
                fullPage: true
            });
        } finally {
            await electronApp.close();
        }
    });
});
