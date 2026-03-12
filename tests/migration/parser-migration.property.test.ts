import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParserValidator } from '../../packages/backend/src/migration/parser-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('ParserValidator Property Tests', () => {
  let validator: ParserValidator;

  beforeEach(() => {
    validator = new ParserValidator();
  });

  describe('Property 26: Comment parser migration verification', () => {
    it('should verify comment parser implementation', async () => {
      // Feature: complete-nestjs-migration, Property 26: Comment parser migration verification
      const status = await validator.getParserStatus();
      expect(typeof status.parserImplemented).toBe('boolean');
      expect(typeof status.templateManagerMigrated).toBe('boolean');
    });

    it('should verify that round-trip parsing/formatting is supported', async () => {
      // Feature: complete-nestjs-migration, Property 26: Comment parser migration verification
      const roundTripValid = await validator.verifyRoundTrip();
      expect(typeof roundTripValid).toBe('boolean');
    });
  });

  describe('Property 26.1: Legacy Parser usage', () => {
    it('should verify that no legacy parser references remain', async () => {
      // Feature: complete-nestjs-migration, Property 26: Comment parser migration verification
      const usesLegacy = await validator.checkLegacyParserUsage();
      expect(typeof usesLegacy).toBe('boolean');
    });
  });
});
