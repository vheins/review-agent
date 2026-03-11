import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { describe, it, expect } from 'vitest';

describe('AppModule Initialization', () => {
  it('should compile and initialize AppModule successfully', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    expect(app).toBeDefined();
    await app.close();
  }, 30000);
});
