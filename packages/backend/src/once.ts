import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ReviewEngineService } from './modules/review/review-engine.service.js';
import 'reflect-metadata';

/**
 * CLI utility for single-run PR review (replaces yarn once functionality)
 * 
 * This bootstraps the NestJS application context, executes a single-run
 * review scan across all open PRs, and then shuts down.
 */
async function bootstrap() {
  console.log('[NestJS] Initializing application for single-run review...');
  
  // Create application context instead of a full web server
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  try {
    const reviewEngine = app.get(ReviewEngineService);
    
    // Execute the single-run review process
    await reviewEngine.runOnce();
    
    console.log('[NestJS] Review run completed successfully.');
    
    // Explicitly exit to stop any background handles (like ScheduleModule)
    process.exit(0);
  } catch (error) {
    console.error('[NestJS] Error during single-run review:', error);
    process.exit(1);
  } finally {
    // Ensure the application context is closed
    await app.close();
  }
}

// Global error handler for the bootstrap process
bootstrap().catch((error) => {
  console.error('[NestJS] Failed to bootstrap application context:', error);
  process.exit(1);
});
