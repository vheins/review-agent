import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { describe, it, expect, beforeEach } from 'vitest';

/**
 * AppModule Tests
 * 
 * These tests verify that the AppModule can be instantiated
 * and that the NestJS application can be created successfully.
 */
describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should compile successfully', () => {
    expect(module).toBeInstanceOf(TestingModule);
  });

  it('should have AppModule imported', () => {
    const appModule = module.get(AppModule);
    expect(appModule).toBeDefined();
  });
});
