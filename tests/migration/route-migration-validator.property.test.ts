import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RouteMigrationValidator } from '../../packages/backend/src/migration/route-migration-validator.js';
import * as fc from 'fast-check';
import path from 'path';

describe('RouteMigrationValidator Property Tests', () => {
  let validator: RouteMigrationValidator;

  beforeEach(() => {
    validator = new RouteMigrationValidator();
  });

  describe('Property 8: Route file to controller mapping', () => {
    it('should correctly identify whether route files have corresponding NestJS controllers', async () => {
      // Feature: complete-nestjs-migration, Property 8: Route file to controller mapping
      const routeFiles = await validator.scanRouteFiles();
      
      // Known mapped routes (from earlier CLI run)
      const mappedRoutes = ['dashboard.js', 'metrics.js', 'security.js', 'team.js'];
      // Known unmapped routes
      const unmappedRoutes = ['config.js', 'health.js', 'prs.js', 'reviews.js', 'webhooks.js'];

      mappedRoutes.forEach(filename => {
        const route = routeFiles.find(r => r.filename === filename);
        expect(route).toBeDefined();
        expect(route?.hasControllerEquivalent).toBe(true);
        expect(route?.controllerEquivalent).toContain('.controller.ts');
      });

      unmappedRoutes.forEach(filename => {
        const route = routeFiles.find(r => r.filename === filename);
        expect(route).toBeDefined();
        expect(route?.hasControllerEquivalent).toBe(false);
      });
    });
  });

  describe('Property 9: Decorator verification', () => {
    it('should correctly verify decorators in existing controllers', async () => {
      // Feature: complete-nestjs-migration, Property 9: Decorator verification
      const routeFiles = await validator.scanRouteFiles();
      const mappedRoute = routeFiles.find(r => r.hasControllerEquivalent);
      
      if (mappedRoute && mappedRoute.controllerEquivalent) {
        const isValid = await validator.verifyDecorators(mappedRoute.controllerEquivalent);
        expect(isValid).toBe(true);
      }
    });
  });
});
