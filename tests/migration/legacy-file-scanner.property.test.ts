import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LegacyFileScanner } from '../../packages/backend/src/migration/legacy-file-scanner.js';
import * as fc from 'fast-check';
import path from 'path';

describe('LegacyFileScanner Property Tests', () => {
  let scanner: LegacyFileScanner;

  beforeEach(() => {
    scanner = new LegacyFileScanner();
  });

  describe('Property 1: Legacy file count verification', () => {
    it('should identify exactly 64 legacy files in packages/backend/legacy', async () => {
      // Feature: complete-nestjs-migration, Property 1: Legacy file count verification
      const files = await scanner.scanLegacyFiles();
      expect(files.length).toBe(64);
    });
  });

  describe('Property 2: Legacy file to NestJS module mapping', () => {
    it('should correctly map legacy files to NestJS modules when equivalents exist', async () => {
      // Feature: complete-nestjs-migration, Property 2: Legacy file to NestJS module mapping
      const files = await scanner.scanLegacyFiles();
      
      // Known migrated files (from earlier CLI run)
      const migratedFiles = [
        'ai-fix-generator.js',
        'assignment-engine.js',
        'audit-logger.js',
        'batch-processor.js',
        'capacity-planner.js',
        'comment-parser.js',
        'compliance-reporter.js',
        'coverage-tracker.js',
        'data-exporter.js',
        'dependency-scanner.js',
        'developer-dashboard.js',
        'github.js',
        'logger.js',
        'review-engine.js',
        'review-queue.js',
        'security-scanner.js',
      ];

      migratedFiles.forEach(filename => {
        const file = files.find(f => f.filename === filename);
        expect(file).toBeDefined();
        expect(file?.hasNestJSEquivalent).toBe(true);
        expect(file?.nestJSEquivalent).toContain('packages/backend/src');
      });
    });
  });

  describe('Property 3: Unmigrated file detection', () => {
    it('should correctly identify unmigrated legacy files', async () => {
      // Feature: complete-nestjs-migration, Property 3: Unmigrated file detection
      const files = await scanner.scanLegacyFiles();
      
      // Known unmigrated files (from earlier CLI run)
      const unmigratedFiles = [
        'ai-executors.js',
        'api-server.js',
        'auto-fix-service.js',
        'auto-merge-service.js',
        'config.js',
        'database.js',
      ];

      unmigratedFiles.forEach(filename => {
        const file = files.find(f => f.filename === filename);
        expect(file).toBeDefined();
        expect(file?.hasNestJSEquivalent).toBe(false);
      });
    });
  });
});
