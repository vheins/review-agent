import { apiServer } from './api-server.js';
import { dbManager } from './database.js';
import { logger } from './logger.js';

async function main() {
    try {
        // Initialize database first
        logger.info('Initializing database...');
        await dbManager.initialize();

        if (!dbManager.isAvailable()) {
            logger.error(`Database initialization failed: ${dbManager.getError()}`);
            process.exit(1);
        }

        logger.info('Database initialized successfully');

        // Start API server
        logger.info('Starting API server...');
        apiServer.start();

        logger.info('Server is ready');
    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    apiServer.stop();
    dbManager.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully...');
    apiServer.stop();
    dbManager.close();
    process.exit(0);
});

main();
