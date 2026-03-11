#!/usr/bin/env node

import http from 'http';

const port = process.env.API_PORT || 3000;
const host = '127.0.0.1';

function checkServer() {
    return new Promise((resolve) => {
        const req = http.get(`http://${host}:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });

        req.on('error', () => {
            resolve(false);
        });

        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function main() {
    const isRunning = await checkServer();

    if (isRunning) {
        console.log(`✓ Backend server is running on port ${port}`);
        process.exit(0);
    } else {
        console.error(`✗ Backend server is NOT running on port ${port}`);
        console.error(`  Start it with: yarn server`);
        process.exit(1);
    }
}

main();
