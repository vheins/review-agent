#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { MigrationReport, TestCoverage } from './interfaces/migration-report.interface.js';
import { LegacyFileScanner } from './legacy-file-scanner.js';
import { ImportScanner } from './import-scanner.js';
import { TestCoverageAnalyzer } from './test-coverage-analyzer.js';
import { RouteMigrationValidator } from './route-migration-validator.js';
import { RootSrcValidator } from './root-src-validator.js';
import { DatabaseValidator } from './database-validator.js';
import { ConfigValidator } from './config-validator.js';
import { WebSocketValidator } from './websocket-validator.js';
import { AIExecutorValidator } from './ai-executor-validator.js';
import { ReviewEngineStatusValidator } from './review-engine-validator.js';
import { GitHubValidator } from './github-validator.js';
import { SecurityValidator } from './security-validator.js';
import { MetricsValidator } from './metrics-validator.js';
import { TeamValidator } from './team-validator.js';
import { UtilityValidator } from './utility-validator.js';
import { OrchestrationValidator } from './orchestration-validator.js';
import { ResourceManagementValidator } from './resource-management-validator.js';
import { SpecializedServicesValidator } from './specialized-services-validator.js';
import { ParserValidator } from './parser-validator.js';
import { ReportGenerator } from './report-generator.js';
import path from 'path';

const program = new Command();

program
  .name('migration-validator')
  .description('Validator for PR Review Agent NestJS migration')
  .version('1.0.0');

program
  .command('validate')
  .description('Run complete migration validation')
  .option('-v, --verbose', 'Display detailed validation results')
  .option('-f, --format <format>', 'Output format (json, text, markdown)', 'text')
  .option('-o, --output <dir>', 'Output directory for reports', 'reports/migration')
  .action(async (options) => {
    const spinner = ora('Running migration validation...').start();
    
    try {
      const report: MigrationReport = await runValidation(options);
      
      spinner.succeed('Validation complete!');
      
      const reportGenerator = new ReportGenerator(options.output);
      
      if (options.format === 'json') {
        const jsonPath = await reportGenerator.generateJsonReport(report);
        console.log(`JSON report generated: ${jsonPath}`);
        if (options.verbose) console.log(JSON.stringify(report, null, 2));
      } else if (options.format === 'markdown') {
        const mdPath = await reportGenerator.generateMarkdownReport(report);
        const checklistPath = await reportGenerator.generateRemovalChecklist(report);
        console.log(`Markdown report generated: ${mdPath}`);
        console.log(`Removal checklist generated: ${checklistPath}`);
      } else {
        printTextReport(report, options.verbose);
      }
      
      process.exit(report.overallStatus === 'complete' ? 0 : 1);
    } catch (error) {
      spinner.fail('Validation failed!');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(3);
    }
  });

async function runValidation(options: any): Promise<MigrationReport> {
  // 1. Core Scanners
  const legacyFileScanner = new LegacyFileScanner();
  const legacyFiles = await legacyFileScanner.scanLegacyFiles();
  
  const migratedFiles = legacyFiles.filter(f => f.hasNestJSEquivalent);
  const unmigratedFiles = legacyFiles
    .filter(f => !f.hasNestJSEquivalent)
    .map(f => f.filename);

  const importScanner = new ImportScanner();
  const importReferences = await importScanner.scanCodebaseForImports();
  const packageJsonClean = await importScanner.verifyPackageJsonScripts();

  const testCoverageAnalyzer = new TestCoverageAnalyzer();
  const nestModules = migratedFiles.map(f => f.nestJSEquivalent!).filter(Boolean);
  const testCoverage = await testCoverageAnalyzer.analyzeTestCoverage(nestModules);

  const routeMigrationValidator = new RouteMigrationValidator();
  const routeFiles = await routeMigrationValidator.scanRouteFiles();

  // 2. New Validators
  const rootSrcValidator = new RootSrcValidator();
  const rootSrcFiles = await rootSrcValidator.scanRootSrcFiles();
  const docRecommendations = await rootSrcValidator.checkDocumentationRelevance();

  const databaseValidator = new DatabaseValidator();
  const databaseLayer = await databaseValidator.getDatabaseLayerStatus();

  const configValidator = new ConfigValidator();
  const config = await configValidator.getConfigStatus();

  const websocketValidator = new WebSocketValidator();
  const websocket = await websocketValidator.getWebSocketStatus();

  const aiExecutorValidator = new AIExecutorValidator();
  const aiExecutors = await aiExecutorValidator.verifyExecutorImplementations();

  const reviewEngineValidator = new ReviewEngineStatusValidator();
  const reviewEngine = await reviewEngineValidator.getReviewEngineStatus();

  const githubValidator = new GitHubValidator();
  const githubIntegration = await githubValidator.getGitHubIntegrationStatus();

  const securityValidator = new SecurityValidator();
  const security = await securityValidator.getSecurityStatus();

  const metricsValidator = new MetricsValidator();
  const metrics = await metricsValidator.getMetricsStatus();

  const teamValidator = new TeamValidator();
  const teamManagement = await teamValidator.getTeamManagementStatus();

  const utilityValidator = new UtilityValidator();
  const utilityServices = await utilityValidator.getUtilityServicesStatus();

  const orchestrationValidator = new OrchestrationValidator();
  const orchestration = await orchestrationValidator.getOrchestrationStatus();

  const resourceManagementValidator = new ResourceManagementValidator();
  const resourceManagement = await resourceManagementValidator.getResourceManagementStatus();

  const specializedServicesValidator = new SpecializedServicesValidator();
  const specializedServices = await specializedServicesValidator.getSpecializedServicesStatus();

  const parserValidator = new ParserValidator();
  const parser = await parserValidator.getParserStatus();

  // 3. Overall Status & Recommendations
  const untestedModules = testCoverage.filter(t => !t.hasTests).map(t => t.modulePath);

  const isComplete = 
    unmigratedFiles.length === 0 && 
    importReferences.length === 0 && 
    packageJsonClean && 
    untestedModules.length === 0 && 
    routeFiles.length === 0 &&
    databaseLayer.typeORMConfigComplete &&
    !databaseLayer.legacyDBFilesUsed &&
    config.nestJSConfigModule &&
    !config.legacyConfigUsed &&
    reviewEngine.workflowComplete &&
    githubIntegration.githubServiceImplemented &&
    security.securityScannerImplemented &&
    metrics.metricsServiceImplemented &&
    orchestration.orchestrationMigrated &&
    parser.parserImplemented;

  const status = isComplete ? 'complete' : 'incomplete';
    
  const recommendations: string[] = [...docRecommendations];
  if (unmigratedFiles.length > 0) {
    recommendations.push(`Migrate the following files: ${unmigratedFiles.join(', ')}`);
  }
  if (importReferences.length > 0) {
    recommendations.push(`Remove legacy imports from: ${Array.from(new Set(importReferences.map(r => r.filePath))).join(', ')}`);
  }
  if (!packageJsonClean) {
    recommendations.push('Remove legacy references from package.json scripts');
  }
  if (untestedModules.length > 0) {
    recommendations.push(`Add tests for migrated modules: ${untestedModules.map(m => path.basename(m)).join(', ')}`);
  }
  if (routeFiles.length > 0) {
    recommendations.push(`Migrate route files to controllers: ${routeFiles.map(f => f.filename).join(', ')}`);
  }
  if (!databaseLayer.typeORMConfigComplete) {
    recommendations.push('Complete TypeORM configuration and entities');
  }
  if (databaseLayer.legacyDBFilesUsed) {
    recommendations.push('Remove usage of legacy/database.js');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Migration looks complete and verified!');
  }

  return {
    legacyFiles,
    importReferences,
    testCoverage,
    routeFiles,
    rootSrcFiles,
    databaseLayer,
    config,
    websocket,
    aiExecutors,
    reviewEngine,
    githubIntegration,
    security,
    metrics,
    teamManagement,
    utilityServices,
    orchestration,
    resourceManagement,
    specializedServices,
    parser,
    overallStatus: status,
    unmigratedFiles,
    recommendations
  };
}

function printTextReport(report: MigrationReport, verbose: boolean) {
  console.log('\n' + chalk.bold('Migration Validator Report'));
  console.log('==========================\n');
  
  console.log(`Overall Status: ${report.overallStatus === 'complete' ? chalk.green('COMPLETE') : chalk.yellow('INCOMPLETE')}`);
  
  console.log(`\nLegacy Files: ${report.legacyFiles.length - report.unmigratedFiles.length}/${report.legacyFiles.length} migrated`);
  console.log(`Import References: ${report.importReferences.length === 0 ? chalk.green('0 found') : chalk.red(`${report.importReferences.length} found`)}`);
  
  const testedCount = report.testCoverage.filter(t => t.hasTests).length;
  console.log(`Test Coverage: ${testedCount}/${report.testCoverage.length} migrated modules have tests`);

  console.log(`Route Files: ${report.routeFiles.length === 0 ? chalk.green('0 left') : chalk.red(`${report.routeFiles.length} need migration`)}`);

  console.log(`Database Layer: ${report.databaseLayer.typeORMConfigComplete ? chalk.green('Migrated') : chalk.red('Incomplete')}`);
  console.log(`Configuration: ${report.config.nestJSConfigModule ? chalk.green('Migrated') : chalk.red('Incomplete')}`);
  console.log(`Security: ${report.security.securityScannerImplemented ? chalk.green('Migrated') : chalk.red('Incomplete')}`);

  if (verbose) {
    console.log('\n' + chalk.bold('Sub-system Status:'));
    console.log(`- WebSockets: ${report.websocket.gatewayImplementation ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`- Review Engine: ${report.reviewEngine.reviewEngineImplemented ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`- Metrics: ${report.metrics.metricsServiceImplemented ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`- Team Management: ${report.teamManagement.assignmentEngineImplemented ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`- Orchestration: ${report.orchestration.orchestrationMigrated ? chalk.green('✓') : chalk.red('✗')}`);
    console.log(`- Parser: ${report.parser.parserImplemented ? chalk.green('✓') : chalk.red('✗')}`);
  }

  if (verbose && report.legacyFiles.length > 0) {
    console.log('\n' + chalk.bold('Legacy File Mapping:'));
    report.legacyFiles.forEach(f => {
      const status = f.hasNestJSEquivalent ? chalk.green('✓') : chalk.red('✗');
      console.log(`${status} ${f.filename.padEnd(30)} ${f.nestJSEquivalent ? '→ ' + f.nestJSEquivalent : ''}`);
    });
  }

  if (report.recommendations.length > 0) {
    console.log('\n' + chalk.bold('Recommendations:'));
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  }
}

program.parse();
