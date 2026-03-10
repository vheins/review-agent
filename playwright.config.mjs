import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './playwright',
    timeout: 60_000,
    reporter: 'list',
    use: {
        screenshot: 'only-on-failure'
    }
});
