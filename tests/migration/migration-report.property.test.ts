import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportGenerator } from '../../packages/backend/src/migration/report-generator.js';
import { MigrationReport } from '../../packages/backend/src/migration/interfaces/migration-report.interface.js';
import path from 'path';
import fs from 'fs-extra';

describe('ReportGenerator Property Tests', () => {
  let generator: ReportGenerator;
  const mockReport: MigrationReport = {
    legacyFiles: [],
    importReferences: [],
    testCoverage: [],
    routeFiles: [],
    rootSrcFiles: [],
    databaseLayer: { legacyDBFilesUsed: false, typeORMConfigComplete: true, schemaSync: true, legacyQueriesMigrated: true },
    config: { legacyConfigUsed: false, nestJSConfigModule: true, validationSchema: true, configServicesIntegrated: true, hardcodedConfigMigrated: true },
    websocket: { legacyWSUsed: false, gatewayImplementation: true, gatewayDecorators: true, clientConnections: true, authAndAuthz: true },
    aiExecutors: [],
    reviewEngine: { legacyEngineUsed: false, reviewEngineImplemented: true, reviewQueueImplemented: true, checklistImplemented: true, workflowComplete: true },
    githubIntegration: { legacyGitHubUsed: false, githubServiceImplemented: true, ghCLITegrated: true, ciIntegrationMigrated: true, autoMergeMigrated: true, autoFixMigrated: true },
    security: { legacySecurityUsed: false, securityScannerImplemented: true, dependencyScannerImplemented: true, complianceMigrated: true, licenseScannerImplemented: true, sensitiveDataHandlerMigrated: true },
    metrics: { legacyMetricsUsed: false, metricsServiceImplemented: true, healthScoreMigrated: true, qualityScoreMigrated: true, coverageTrackerMigrated: true, performanceAlertMigrated: true, dataExporterMigrated: true },
    teamManagement: { legacyAssignmentUsed: false, assignmentEngineImplemented: true, capacityPlannerMigrated: true, developerDashboardMigrated: true, gamificationMigrated: true, feedbackAnalyzerMigrated: true },
    utilityServices: [],
    orchestration: { legacyOrchestrationUsed: false, orchestrationMigrated: true, delegateMigrated: true, batchProcessorMigrated: true, taskLockManagerMigrated: true, stuckTaskDetectorMigrated: true },
    resourceManagement: { legacyResourceManagerUsed: false, cachingMigrated: true, retryStrategyMigrated: true, repositoryManagerMigrated: true, elapsedTimeTrackerMigrated: true },
    specializedServices: [],
    parser: { legacyParserUsed: false, parserImplemented: true, templateManagerMigrated: true, roundTripValid: true },
    overallStatus: 'complete',
    unmigratedFiles: [],
    recommendations: ['Great job!']
  };

  beforeEach(() => {
    generator = new ReportGenerator('reports/test-migration');
  });

  describe('Property 27: Migration report generation', () => {
    it('should generate JSON and Markdown reports', async () => {
      // Feature: complete-nestjs-migration, Property 27: Migration report generation
      const jsonPath = await generator.generateJsonReport(mockReport);
      expect(await fs.pathExists(jsonPath)).toBe(true);
      
      const mdPath = await generator.generateMarkdownReport(mockReport);
      expect(await fs.pathExists(mdPath)).toBe(true);
      
      // Cleanup
      await fs.remove(path.dirname(jsonPath));
    });
  });

  describe('Property 28: Removal checklist generation', () => {
    it('should generate removal checklist', async () => {
      // Feature: complete-nestjs-migration, Property 28: Removal checklist generation
      const checklistPath = await generator.generateRemovalChecklist(mockReport);
      expect(await fs.pathExists(checklistPath)).toBe(true);
      
      // Cleanup
      await fs.remove(path.dirname(checklistPath));
    });
  });
});
