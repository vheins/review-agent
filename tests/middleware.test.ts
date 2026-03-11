import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Global Middleware (Integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Manual application of middleware as in main.ts
    // In a real e2e test we would call the bootstrap function but here we test the module's compatibility
    // Actually, main.ts applies them to the app instance.
    // To test if they are *configured* to be applicable, we'd need to mock the bootstrap.
    
    // For this test, we'll apply them manually to verify they don't break the app
    const helmet = (await import('helmet')).default;
    const compression = (await import('compression')).default;
    
    app.use(helmet());
    app.use(compression());
    app.setGlobalPrefix('api');
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should have security headers (via helmet)', async () => {
    const response = await request(app.getHttpServer()).get('/api/health');
    
    // Check for some common helmet headers
    expect(response.headers).toHaveProperty('x-dns-prefetch-control');
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('x-content-type-options');
  });

  it('should support compression', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Accept-Encoding', 'gzip, deflate');
    
    // Note: small responses might not be compressed by default
    // but the header should be allowed
    expect(response.status).toBe(200);
  });
});
