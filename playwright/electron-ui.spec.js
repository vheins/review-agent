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
    await expect(page.getByRole('heading', { name: '🥷 Agentic Bunshin 🥷' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText('Review Queue')).toBeVisible();
}

test.describe('Electron dashboard UI', () => {
    test('renders the Tailwind dashboard shell and main tabs', async ({}, testInfo) => {
        const electronApp = await launchElectronApp();
        const page = await electronApp.firstWindow();

        try {
            await page.setViewportSize({ width: 1600, height: 1200 });
            await waitForDashboardReady(page);

            const tabs = [
                { trigger: 'Overview', heading: 'Review Queue', fileName: 'overview.png' },
                { trigger: 'PRs', heading: 'Current Queue', fileName: 'prs.png' },
                { trigger: 'Metrics', heading: 'Review Time Trend', fileName: 'metrics.png' },
                { trigger: 'Team', heading: 'Developer Workload', fileName: 'team.png' },
                { trigger: 'Security', heading: 'Recent Security Alerts', fileName: 'security.png' },
                { trigger: 'Configuration', heading: 'Configuration Editor', fileName: 'config.png' },
                { trigger: 'Logs', heading: 'Live Process Logs', fileName: 'logs.png' }
            ];

            for (const tab of tabs) {
                await page.getByRole('button', { name: tab.trigger, exact: true }).click();
                await expect(page.getByText(tab.heading, { exact: true })).toBeVisible();
                await page.screenshot({
                    path: testInfo.outputPath(tab.fileName),
                    fullPage: true
                });
            }
        } finally {
            await electronApp.close();
        }
    });
});
