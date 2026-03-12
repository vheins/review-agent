export interface LegacyFile {
  path: string;
  filename: string;
  hasNestJSEquivalent: boolean;
  nestJSEquivalent?: string;
  unmigratedReason?: string;
  migrationPriority?: 'high' | 'medium' | 'low';
}

export interface ImportReference {
  filePath: string;
  lineNumber: number;
  importPath: string;
  importType: 'relative' | 'absolute';
  legacyFile?: string;
}

export interface TestCoverage {
  modulePath: string;
  hasTests: boolean;
  testFilePath?: string;
  coveragePercentage?: number;
  legacyCoverage?: number;
  needsTesting: boolean;
}

export interface RouteEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  existsInController: boolean;
}

export interface RouteFile {
  path: string;
  filename: string;
  hasControllerEquivalent: boolean;
  controllerEquivalent?: string;
  endpoints: RouteEndpoint[];
  needsMigration: boolean;
}

export interface RootSrcFile {
  path: string;
  filename: string;
  isCode: boolean;
  isUsed: boolean;
  importReferences: ImportReference[];
  recommendation: 'keep' | 'remove' | 'review';
}

export interface DatabaseLayerStatus {
  legacyDBFilesUsed: boolean;
  typeORMConfigComplete: boolean;
  schemaSync: boolean;
  legacyQueriesMigrated: boolean;
}

export interface ConfigStatus {
  legacyConfigUsed: boolean;
  nestJSConfigModule: boolean;
  validationSchema: boolean;
  configServicesIntegrated: boolean;
  hardcodedConfigMigrated: boolean;
}

export interface WebSocketStatus {
  legacyWSUsed: boolean;
  gatewayImplementation: boolean;
  gatewayDecorators: boolean;
  clientConnections: boolean;
  authAndAuthz: boolean;
}

export interface AIExecutorStatus {
  executorType: 'gemini' | 'copilot' | 'kiro' | 'claude' | 'codex' | 'opencode';
  implemented: boolean;
  configIntegrated: boolean;
}

export interface ReviewEngineStatus {
  legacyEngineUsed: boolean;
  reviewEngineImplemented: boolean;
  reviewQueueImplemented: boolean;
  checklistImplemented: boolean;
  workflowComplete: boolean;
}

export interface GitHubIntegrationStatus {
  legacyGitHubUsed: boolean;
  githubServiceImplemented: boolean;
  ghCLITegrated: boolean;
  ciIntegrationMigrated: boolean;
  autoMergeMigrated: boolean;
  autoFixMigrated: boolean;
}

export interface SecurityStatus {
  legacySecurityUsed: boolean;
  securityScannerImplemented: boolean;
  dependencyScannerImplemented: boolean;
  complianceMigrated: boolean;
  licenseScannerImplemented: boolean;
  sensitiveDataHandlerMigrated: boolean;
}

export interface MetricsStatus {
  legacyMetricsUsed: boolean;
  metricsServiceImplemented: boolean;
  healthScoreMigrated: boolean;
  qualityScoreMigrated: boolean;
  coverageTrackerMigrated: boolean;
  performanceAlertMigrated: boolean;
  dataExporterMigrated: boolean;
}

export interface TeamManagementStatus {
  legacyAssignmentUsed: boolean;
  assignmentEngineImplemented: boolean;
  capacityPlannerMigrated: boolean;
  developerDashboardMigrated: boolean;
  gamificationMigrated: boolean;
  feedbackAnalyzerMigrated: boolean;
}

export interface UtilityServiceStatus {
  serviceType: 'logger' | 'errorHandler' | 'notification' | 'email' | 'gracefulShutdown' | 'auditLogger';
  legacyUsed: boolean;
  migrated: boolean;
  implementation?: string;
}

export interface OrchestrationStatus {
  legacyOrchestrationUsed: boolean;
  orchestrationMigrated: boolean;
  delegateMigrated: boolean;
  batchProcessorMigrated: boolean;
  taskLockManagerMigrated: boolean;
  stuckTaskDetectorMigrated: boolean;
}

export interface ResourceManagementStatus {
  legacyResourceManagerUsed: boolean;
  cachingMigrated: boolean;
  retryStrategyMigrated: boolean;
  repositoryManagerMigrated: boolean;
  elapsedTimeTrackerMigrated: boolean;
}

export interface SpecializedServiceStatus {
  serviceType: 'slaMonitor' | 'falsePositiveTracker' | 'rejectionCategorizer' | 'discussionTracker' | 'escalationService' | 'smartNotificationEngine' | 'visualizationFormatter';
  migrated: boolean;
}

export interface ParserStatus {
  legacyParserUsed: boolean;
  parserImplemented: boolean;
  templateManagerMigrated: boolean;
  roundTripValid: boolean;
}

export interface MigrationReport {
  legacyFiles: LegacyFile[];
  importReferences: ImportReference[];
  testCoverage: TestCoverage[];
  routeFiles: RouteFile[];
  rootSrcFiles: RootSrcFile[];
  databaseLayer: DatabaseLayerStatus;
  config: ConfigStatus;
  websocket: WebSocketStatus;
  aiExecutors: AIExecutorStatus[];
  reviewEngine: ReviewEngineStatus;
  githubIntegration: GitHubIntegrationStatus;
  security: SecurityStatus;
  metrics: MetricsStatus;
  teamManagement: TeamManagementStatus;
  utilityServices: UtilityServiceStatus[];
  orchestration: OrchestrationStatus;
  resourceManagement: ResourceManagementStatus;
  specializedServices: SpecializedServiceStatus[];
  parser: ParserStatus;
  overallStatus: 'complete' | 'incomplete' | 'needs_review';
  unmigratedFiles: string[];
  recommendations: string[];
}
