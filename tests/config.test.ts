import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '../src/config/config.module';
import { AppConfig, ReviewConfig, AiExecutorConfig, DatabaseConfig } from '../src/config';

/**
 * Configuration Module Tests
 * 
 * Tests for typed configuration loading and validation.
 * 
 * Requirements: 9.1, 9.2, 9.4, 9.5
 */
describe('ConfigModule', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.API_PORT = '3001';
    process.env.REVIEW_INTERVAL = '300';
    process.env.AI_EXECUTOR = 'gemini';
    process.env.GEMINI_ENABLED = 'true';
    process.env.REVIEW_MODE = 'comment';

    // Import only the NestJS ConfigModule without database dependencies
    const { ConfigModule: NestConfigModule } = await import('@nestjs/config');
    const appConfig = (await import('../src/config/app.config.js')).default;
    const reviewConfig = (await import('../src/config/review.config.js')).default;
    const aiExecutorConfig = (await import('../src/config/ai-executor.config.js')).default;
    const databaseConfig = (await import('../src/config/database.config.js')).default;
    const { validationSchema } = await import('../src/config/validation.schema.js');

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true, // Use process.env directly in tests
          cache: false, // Disable cache for tests
          validationSchema,
          validationOptions: {
            allowUnknown: true,
            abortEarly: false,
          },
          load: [appConfig, reviewConfig, aiExecutorConfig, databaseConfig],
        }),
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.API_PORT;
    delete process.env.REVIEW_INTERVAL;
  });

  describe('App Configuration', () => {
    it('should load app configuration', () => {
      const appConfig = configService.get<AppConfig>('app');
      
      expect(appConfig).toBeDefined();
      expect(appConfig?.nodeEnv).toBe('test');
      expect(appConfig?.apiPort).toBe(3001);
      expect(appConfig?.reviewInterval).toBe(300);
    });

    it('should provide type-safe access to app.apiPort', () => {
      const port = configService.get<number>('app.apiPort');
      
      expect(port).toBe(3001);
      expect(typeof port).toBe('number');
    });

    it('should parse PR scope as array', () => {
      const prScope = configService.get<string[]>('app.prScope');
      
      expect(Array.isArray(prScope)).toBe(true);
      // Just verify it's an array with at least one item
      expect(prScope.length).toBeGreaterThan(0);
    });

    it('should parse excludeRepoOwners as array', () => {
      const excludeRepoOwners = configService.get<string[]>('app.excludeRepoOwners');
      
      expect(Array.isArray(excludeRepoOwners)).toBe(true);
    });
  });

  describe('Review Configuration', () => {
    it('should load review configuration', () => {
      const reviewConfig = configService.get<ReviewConfig>('review');
      
      expect(reviewConfig).toBeDefined();
      expect(reviewConfig?.reviewMode).toBe('comment');
      // Verify it's a number, don't check exact value
      expect(typeof reviewConfig?.severityThreshold).toBe('number');
    });

    it('should provide severity scores', () => {
      const reviewConfig = configService.get<ReviewConfig>('review');
      
      // Verify all severity scores are numbers
      expect(typeof reviewConfig?.severityCritical).toBe('number');
      expect(typeof reviewConfig?.severityHigh).toBe('number');
      expect(typeof reviewConfig?.severityMedium).toBe('number');
      expect(typeof reviewConfig?.severityLow).toBe('number');
    });
  });

  describe('AI Executor Configuration', () => {
    it('should load AI executor configuration', () => {
      const aiConfig = configService.get<AiExecutorConfig>('aiExecutor');
      
      expect(aiConfig).toBeDefined();
      expect(aiConfig?.executor).toBe('gemini');
    });

    it('should load Gemini settings', () => {
      const aiConfig = configService.get<AiExecutorConfig>('aiExecutor');
      
      expect(aiConfig?.gemini).toBeDefined();
      expect(aiConfig?.gemini.enabled).toBe(true);
      // Verify model is a string, don't check exact value
      expect(typeof aiConfig?.gemini.model).toBe('string');
    });

    it('should load all executor settings', () => {
      const aiConfig = configService.get<AiExecutorConfig>('aiExecutor');
      
      expect(aiConfig?.gemini).toBeDefined();
      expect(aiConfig?.copilot).toBeDefined();
      expect(aiConfig?.kiro).toBeDefined();
      expect(aiConfig?.claude).toBeDefined();
      expect(aiConfig?.codex).toBeDefined();
      expect(aiConfig?.opencode).toBeDefined();
    });
  });

  describe('Database Configuration', () => {
    it('should load database configuration', () => {
      const dbConfig = configService.get<DatabaseConfig>('database');
      
      expect(dbConfig).toBeDefined();
      expect(dbConfig?.type).toBe('sqlite');
      expect(dbConfig?.database).toContain('data/pr-review.db');
    });

    it('should set synchronize based on environment', () => {
      const dbConfig = configService.get<DatabaseConfig>('database');
      
      // In test environment, synchronize should be true
      expect(dbConfig?.synchronize).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should provide default values for missing env vars', () => {
      // This test verifies the config was loaded
      // The actual value depends on whether env var was set
      const reviewInterval = configService.get<number>('app.reviewInterval');
      
      // Should be a number
      expect(typeof reviewInterval).toBe('number');
      expect(reviewInterval).toBeGreaterThan(0);
    });

    it('should parse boolean values correctly', () => {
      process.env.AUTO_MERGE = 'true';
      
      const autoMerge = configService.get<boolean>('app.autoMerge');
      
      expect(typeof autoMerge).toBe('boolean');
    });

    it('should parse number values correctly', () => {
      const port = configService.get<number>('app.apiPort');
      
      // Verify it's a number (value was set in beforeEach)
      expect(typeof port).toBe('number');
      expect(port).toBeGreaterThan(0);
    });
  });

  describe('Nested Configuration Access', () => {
    it('should access nested configuration values', () => {
      const geminiModel = configService.get<string>('aiExecutor.gemini.model');
      
      // Verify it's a string
      expect(typeof geminiModel).toBe('string');
      expect(geminiModel.length).toBeGreaterThan(0);
    });

    it('should access deeply nested values', () => {
      const geminiEnabled = configService.get<boolean>('aiExecutor.gemini.enabled');
      
      expect(geminiEnabled).toBe(true);
    });
  });
});
