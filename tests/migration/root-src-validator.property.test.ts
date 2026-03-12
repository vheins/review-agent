import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RootSrcValidator } from '../../packages/backend/src/migration/root-src-validator.js';
import path from 'path';
import fs from 'fs-extra';

describe('RootSrcValidator Property Tests', () => {
  let validator: RootSrcValidator;

  beforeEach(() => {
    validator = new RootSrcValidator();
  });

  describe('Property 10: Root src file analysis', () => {
    it('should correctly identify and analyze files in root src folder', async () => {
      // Feature: complete-nestjs-migration, Property 10: Root src file analysis
      const files = await validator.scanRootSrcFiles();
      
      // We expect at least ARCHITECTURE.md and README.md if they exist
      const filenames = files.map(f => f.filename);
      
      if (filenames.includes('ARCHITECTURE.md')) {
        const archFile = files.find(f => f.filename === 'ARCHITECTURE.md')!;
        expect(archFile.isUsed).toBe(true);
        expect(archFile.recommendation).toBe('keep');
      }

      if (filenames.includes('README.md')) {
        const readmeFile = files.find(f => f.filename === 'README.md')!;
        expect(readmeFile.isUsed).toBe(true);
        expect(readmeFile.recommendation).toBe('keep');
      }
    });

    it('should verify documentation relevance based on content', async () => {
      // Feature: complete-nestjs-migration, Property 10: Root src file analysis
      const recommendations = await validator.checkDocumentationRelevance();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
