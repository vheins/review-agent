import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import 'reflect-metadata';

/**
 * Bootstrap the NestJS application
 * 
 * This is the entry point for the NestJS backend server.
 * It creates the application instance, configures middleware,
 * and starts listening on the configured port.
 * 
 * Environment Variables:
 * - API_PORT: Port to listen on (default: 3000)
 * - NODE_ENV: Environment mode (development/production)
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply LoggingInterceptor globally
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Get port from environment or use default
  const port = process.env.API_PORT || 3000;

  // Global prefix for all routes (optional, can be configured later)
  // app.setGlobalPrefix('api');

  // Enable CORS for Electron renderer process
  // Will be configured in Phase 6 with proper settings
  // app.enableCors();

  // Start listening
  await app.listen(port);

  console.log(`[NestJS] Backend server is running on http://localhost:${port}`);
  console.log(`[NestJS] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[NestJS] Health check: http://localhost:${port}/health`);
}

bootstrap().catch((error) => {
  console.error('[NestJS] Failed to start backend server:', error);
  process.exit(1);
});
