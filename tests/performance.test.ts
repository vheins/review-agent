import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Performance Validation', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('Property 30: Simple Operation Response Time', async () => {
    const start = Date.now();
    await request(app.getHttpServer()).get('/api/health').expect(200);
    const duration = Date.now() - start;
    
    // Requirement: < 200ms
    expect(duration).toBeLessThan(200);
  });

  it('Property 32: Memory Usage Limit', async () => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    
    // Express baseline was likely around 50-100MB
    // NestJS + TypeORM might use more, but should stay reasonable
    expect(heapUsedMB).toBeLessThan(250);
  });
});
