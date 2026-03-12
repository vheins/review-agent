import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import 'reflect-metadata';

/**
 * Bootstrap the NestJS application
 * 
 * This is the entry point for the NestJS backend server.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Apply WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  // Apply security headers
  app.use(helmet());

  // Apply compression
  app.use(compression());

  // Enable CORS for Electron renderer process
  app.enableCors({
    origin: '*', // For local Electron app, '*' is usually acceptable or file://
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Apply LoggingInterceptor globally
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Apply GlobalExceptionFilter globally
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Get port from environment or use default
  const port = process.env.API_PORT || 3000;

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Start listening
  await app.listen(port);

  console.log(`[NestJS] Backend server is running on http://localhost:${port}`);
  console.log(`[NestJS] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[NestJS] Health check: http://localhost:${port}/api/health`);
}

bootstrap().catch((error) => {
  console.error('[NestJS] Failed to start backend server:', error);
  process.exit(1);
});
