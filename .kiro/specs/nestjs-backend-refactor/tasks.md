# Rencana Implementasi: NestJS Backend Refactor

## Ringkasan

Dokumen ini berisi rencana implementasi untuk refactor backend PR Review Agent dari Express ke NestJS dengan TypeScript dan TypeORM. Implementasi mengikuti strategi migrasi 8 fase dengan estimasi 16 minggu.

## Catatan Penting

- Tasks yang ditandai dengan `*` bersifat opsional dan dapat dilewati untuk MVP lebih cepat
- Setiap task mereferensikan requirements spesifik untuk traceability
- Property tests memvalidasi correctness properties dari design document
- Checkpoint tasks memastikan validasi incremental

## Tasks

### Phase 1: Setup dan Infrastructure (Minggu 1-2)

- [ ] 1. Setup NestJS project dan konfigurasi dasar
  - [x] 1.1 Initialize NestJS project structure
    - NestJS dependencies sudah ada di package.json, jalankan `yarn install`
    - Buat folder structure: src/modules, src/common, src/database, src/config
    - Setup barrel exports (index.ts) untuk clean imports
    - Update .gitignore untuk include dist/, .env, dan TypeScript build artifacts
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 1.2 Configure TypeScript dan build tools
    - Setup tsconfig.json dengan compiler options yang sesuai (ES2021, decorators, etc.)
    - Configure nest-cli.json untuk asset copying (SQL files)
    - Setup ESLint dan Prettier untuk code quality
    - Configure source maps untuk debugging
    - _Requirements: 1.2_
  
  - [x] 1.3 Setup folder structure dan modules
    - Buat folder structure: src/modules, src/common, src/database
    - Initialize AppModule sebagai root module
    - Setup barrel exports untuk clean imports
    - _Requirements: 1.3_


- [ ] 2. Setup TypeORM dengan SQLite dan entities
  - [x] 2.1 Install dan configure TypeORM dependencies
    - Install @nestjs/typeorm, typeorm, sqlite3 packages
    - Configure TypeOrmModule.forRootAsync() di AppModule
    - Setup database path ke data/pr-review.db
    - Enable synchronize untuk development mode
    - Configure logging untuk database queries
    - _Requirements: 2.1, 2.4_
  
  - [x] 2.2 Create entity classes untuk database schema
    - Buat PullRequest entity dengan decorators (@Entity, @Column, @PrimaryColumn, dll)
    - Buat Review entity dengan relations ke PullRequest
    - Buat Comment entity dengan relation ke Review
    - Buat ReviewMetrics entity dengan one-to-one relation ke Review
    - Buat RepositoryConfig entity
    - Buat DeveloperMetrics entity
    - _Requirements: 2.2_
  
  - [x] 2.3 Setup repository providers dan test database operations
    - Configure TypeOrmModule.forFeature() untuk entities
    - Test entity creation dan schema auto-sync
    - Verify relations loading (eager dan explicit)
    - Test basic CRUD operations dengan repositories
    - _Requirements: 2.3, 2.6_
  
  - [x] 2.4 Write property test untuk TypeORM repository injection
    - **Property 1: TypeORM Repository Injection**
    - **Validates: Requirements 2.3**
    - Test repository dapat di-inject dengan @InjectRepository
    - Verify repository methods berfungsi dengan benar
  
  - [x] 2.5 Write property test untuk database transactions
    - **Property 2: Database Transactions Rollback**
    - **Validates: Requirements 2.5**
    - Test transaction rollback pada error
    - Verify database state kembali ke kondisi sebelum transaction
  
  - [x] 2.6 Write property test untuk entity relations
    - **Property 3: Entity Relations Loading**
    - **Validates: Requirements 2.3**
    - Test relations dapat di-load dengan benar
    - Verify eager loading dan explicit loading


- [ ] 3. Setup ConfigModule dan environment configuration
  - [x] 3.1 Configure NestJS ConfigModule
    - Install @nestjs/config package
    - Setup ConfigModule.forRoot() dengan isGlobal: true
    - Configure .env file loading
    - Create typed configuration interfaces
    - _Requirements: 9.1, 9.2_
  
  - [x] 3.2 Implement repository-specific configuration overrides
    - Create AppConfigService yang extend ConfigService
    - Implement getRepositoryConfig() method
    - Load repository configs dari database
    - Implement config validation logic
    - _Requirements: 9.3, 9.4, 9.6_
  
  - [x] 3.3 Write unit tests untuk configuration loading
    - Test environment variable loading
    - Test repository-specific overrides
    - Test config validation
    - Test default values

- [x] 4. Checkpoint - Verify infrastructure setup
  - Ensure all tests pass, ask the user if questions arise.


### Phase 2: Core Services Migration (Minggu 3-4)

- [x] 5. Implement LoggerModule dan custom logger
  - [x] 5.1 Create custom logger service dengan daily rotation
    - Buat LoggerService yang implement NestJS LoggerService interface
    - Implement daily log rotation logic
    - Setup log file storage di logs/ directory
    - Implement 7-day retention policy
    - Maintain log format: [timestamp] [LEVEL] message
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 5.2 Configure logger untuk HTTP request logging
    - Create LoggingInterceptor untuk request/response logging
    - Log method, URL, status code, dan response time
    - Integrate dengan NestJS middleware pipeline
    - _Requirements: 12.6_
  
  - [x] 5.3 Write unit tests untuk logger functionality
    - Test log file creation dan rotation
    - Test log format compatibility
    - Test retention policy
    - **Property 23: Log Format Compatibility**
    - **Validates: Requirements 12.4**


- [x] 6. Migrate GitHubClientService
  - [x] 6.1 Create GitHubModule dan GitHubClientService
    - Buat GitHubModule dengan providers dan exports
    - Implement GitHubClientService dengan @Injectable decorator
    - Inject ConfigService dan LoggerService via DI
    - _Requirements: 10.1_
  
  - [x] 6.2 Implement PR scanning functionality
    - Migrate scanPullRequests() method dari github-client.js
    - Implement scope filtering (authored, assigned, review-requested)
    - Use execa untuk execute gh CLI commands
    - Parse JSON output menjadi PullRequest objects
    - _Requirements: 10.3_
  
  - [x] 6.3 Implement repository cloning dan branch operations
    - Migrate cloneRepository() method
    - Implement branch checkout logic
    - Handle workspace directory management
    - _Requirements: 7.4_
  
  - [x] 6.4 Implement comment posting functionality
    - Migrate postComment() method
    - Implement atomic comment posting
    - Handle comment formatting
    - _Requirements: 10.4_
  
  - [x] 6.5 Implement auto-merge functionality
    - Migrate autoMerge() method dengan health checks
    - Verify CI status, review approval, no conflicts
    - Implement master/main branch protection
    - _Requirements: 10.5_
  
  - [x] 6.6 Write unit tests dengan mocked gh CLI
    - Mock execa calls untuk gh commands
    - Test PR scanning dengan different scopes
    - Test error handling
  
  - [x] 6.7 Write property test untuk scanning scopes
    - **Property 17: GitHub PR Scanning Scope**
    - **Validates: Requirements 10.3**
    - Test scope filtering correctness
  
  - [x] 6.8 Write property test untuk atomic comment posting
    - **Property 18: Atomic Comment Posting**
    - **Validates: Requirements 10.4**
    - Test rollback pada comment posting failure


- [x] 7. Migrate AiExecutorService
  - [x] 7.1 Create AiModule dan AiExecutorService
    - Buat AiModule dengan providers
    - Implement AiExecutorService dengan strategy pattern
    - Define AiExecutor interface untuk executors
    - _Requirements: 8.1, 8.2_
  
  - [x] 7.2 Implement executor strategies
    - Implement GeminiExecutor
    - Implement CopilotExecutor
    - Implement KiroExecutor
    - Implement ClaudeExecutor
    - Implement CodexExecutor
    - Implement OpenCodeExecutor
    - Register executors dalam Map
    - _Requirements: 8.2_
  
  - [x] 7.3 Implement review execution logic
    - Migrate executeReview() method
    - Implement executor selection berdasarkan config
    - Use execa untuk execute CLI tools
    - Handle timeouts dan errors
    - _Requirements: 8.3, 8.4_
  
  - [x] 7.4 Implement AI output parsing
    - Migrate comment parser logic
    - Parse AI output menjadi structured comments
    - Extract file, line, severity, category, message, suggestion
    - _Requirements: 8.5_
  
  - [x] 7.5 Implement auto-fix generation
    - Migrate generateFix() method
    - Support auto-fix mode
    - _Requirements: 8.6_
  
  - [x] 7.6 Write unit tests untuk executor selection
    - Test executor selection logic
    - Test error handling untuk unknown executors
    - **Property 14: AI Executor Selection**
    - **Validates: Requirements 8.4**
  
  - [x] 7.7 Write property test untuk output parsing
    - **Property 15: AI Output Parsing**
    - **Validates: Requirements 8.5**
    - Test parsing correctness untuk various formats

- [x] 8. Checkpoint - Verify core services
  - Ensure all tests pass, ask the user if questions arise.


### Phase 3: Review Engine Migration (Minggu 5-6)

- [x] 9. Migrate ReviewEngineService
  - [x] 9.1 Create ReviewModule dan ReviewEngineService
    - Buat ReviewModule dengan TypeORM entities
    - Implement ReviewEngineService dengan DI
    - Inject GitHubClientService, AiExecutorService, repositories
    - Inject DataSource untuk transaction support
    - _Requirements: 7.1, 7.3_
  
  - [x] 9.2 Implement reviewPullRequest() method dengan TypeORM
    - Create QueryRunner untuk manual transaction control
    - Create review record dengan reviewRepository
    - Clone repository via GitHubClientService
    - Execute AI review via AiExecutorService
    - Save comments dengan commentRepository
    - Calculate dan save metrics
    - Update review status
    - Commit transaction atau rollback on error
    - _Requirements: 7.2, 7.4, 7.5_
  
  - [x] 9.3 Implement review completion actions
    - Post comments jika mode='comment'
    - Apply auto-fix jika mode='auto-fix'
    - Emit WebSocket events untuk real-time updates
    - _Requirements: 7.5, 7.6_
  
  - [x] 9.4 Implement continuous mode dan once mode
    - Migrate continuousMode() method
    - Migrate onceMode() method
    - Implement periodic PR scanning
    - _Requirements: 7.7_
  
  - [x] 9.5 Write integration tests untuk full review flow
    - Test complete review cycle end-to-end
    - Test transaction rollback on errors
    - Test WebSocket event emission
    - **Property 10: Review Process Functional Compatibility**
    - **Validates: Requirements 7.2**
  
  - [x] 9.6 Write property test untuk repository cloning
    - **Property 11: Repository Clone Before Review**
    - **Validates: Requirements 7.4**
    - Test repository clone dan checkout correctness
  
  - [x] 9.7 Write property test untuk review completion action
    - **Property 12: Review Completion Action**
    - **Validates: Requirements 7.5**
    - Test correct action berdasarkan mode


- [ ] 10. Migrate supporting review services
  - [x] 10.1 Migrate CommentParserService
    - Buat CommentParserService
    - Migrate parsing logic dari comment-parser.js
    - Implement structured comment extraction
    - _Requirements: 8.5_
  
  - [x] 10.2 Migrate ChecklistService
    - Buat ChecklistService
    - Migrate checklist logic dari checklist-manager.js
    - Implement checklist generation dan tracking
    - _Requirements: 7.2_
  
  - [x] 10.3 Write unit tests untuk comment parser
    - Test parsing various AI output formats
    - Test edge cases dan malformed input
  
  - [ ] 10.4 Write unit tests untuk checklist manager
    - Test checklist generation
    - Test checklist tracking

- [ ] 11. Checkpoint - Verify review engine
  - Ensure all tests pass, ask the user if questions arise.


### Phase 4: API Layer Migration (Minggu 7-8)

- [x] 12. Implement REST API controllers
  - [x] 12.1 Create PullRequestController
    - Buat PullRequestModule dan PullRequestController
    - Implement GET /api/prs endpoint dengan query params
    - Implement GET /api/prs/:number endpoint
    - Implement POST /api/prs/:number/review endpoint
    - Create DTOs untuk request validation (ListPrQuery, etc.)
    - _Requirements: 5.1, 5.8_
  
  - [x] 12.2 Create ReviewController
    - Buat ReviewController
    - Implement GET /api/reviews endpoint
    - Implement GET /api/reviews/:id endpoint
    - Implement POST /api/reviews endpoint
    - Create CreateReviewDto dengan validation decorators
    - _Requirements: 5.2, 5.8_
  
  - [x] 12.3 Create MetricsController
    - Buat MetricsController
    - Implement GET /api/metrics/overview endpoint
    - Implement GET /api/metrics/pr/:number endpoint
    - Implement GET /api/metrics/developer/:username endpoint
    - _Requirements: 5.3_
  
  - [ ] 12.4 Create TeamController
    - Buat TeamController
    - Implement team operations endpoints
    - _Requirements: 5.4_
  
  - [ ] 12.5 Create SecurityController
    - Buat SecurityController
    - Implement security operations endpoints
    - _Requirements: 5.5_
  
  - [x] 12.6 Create ConfigController
    - Buat ConfigController
    - Implement GET /api/config/:repository endpoint
    - Implement PUT /api/config/:repository endpoint
    - Create UpdateConfigDto
    - _Requirements: 5.6_
  
  - [ ] 12.7 Create WebhookController
    - Buat WebhookController
    - Implement POST /api/webhooks/github endpoint
    - _Requirements: 5.7_
  
  - [x] 12.8 Create HealthController
    - Buat HealthController
    - Implement GET /health endpoint
    - _Requirements: 3.6_


  - [ ] 12.9 Write API endpoint tests dengan supertest
    - Test semua endpoints dengan valid dan invalid inputs
    - Test response format compatibility
    - Test status codes
    - **Property 4: API Endpoint Compatibility**
    - **Validates: Requirements 3.1, 5.8, 16.3**
  
  - [x] 12.10 Write property test untuk response format
    - **Property 6: Response Format Compatibility**
    - **Validates: Requirements 3.4**
    - Test response data structure match dengan Electron expectations


- [x] 13. Implement WebSocket gateway
  - [x] 13.1 Create ReviewGateway untuk WebSocket
    - Install @nestjs/websockets dan ws packages
    - Buat ReviewGateway dengan @WebSocketGateway decorator
    - Implement OnGatewayConnection dan OnGatewayDisconnect
    - Setup WebSocketServer dengan ws library
    - Track connected clients
    - _Requirements: 6.1, 6.2_
  
  - [x] 13.2 Implement event broadcasting methods
    - Implement broadcastReviewStart()
    - Implement broadcastReviewProgress()
    - Implement broadcastReviewComplete()
    - Implement broadcastReviewError()
    - Implement broadcastMetricsUpdate()
    - Maintain event type compatibility dengan Express
    - _Requirements: 6.3, 6.4_
  
  - [x] 13.3 Implement reconnection support
    - Handle client disconnections gracefully
    - Support automatic reconnection dari Electron
    - _Requirements: 6.5_
  
  - [x] 13.4 Write WebSocket integration tests
    - Test connection dan disconnection
    - Test event broadcasting
    - Test reconnection logic
    - **Property 8: WebSocket Event Broadcasting**
    - **Validates: Requirements 6.3**
  
  - [x] 13.5 Write property test untuk event compatibility
    - **Property 9: WebSocket Event Compatibility**
    - **Validates: Requirements 6.4**
    - Test event format match dengan Electron expectations
  
  - [x] 13.6 Write property test untuk broadcast latency
    - **Property 31: WebSocket Broadcast Latency**
    - **Validates: Requirements 17.3**
    - Test broadcast time < 100ms


- [x] 14. Implement guards, interceptors, dan filters
  - [x] 14.1 Create ApiKeyGuard untuk authentication
    - Implement CanActivate interface
    - Validate X-API-Key header
    - Return 401 untuk invalid/missing keys
    - _Requirements: 3.5, 18.4_
  
  - [x] 14.2 Create global exception filter
    - Implement ExceptionFilter interface
    - Handle AppError dan HttpException
    - Return structured error responses
    - Log errors dengan stack trace
    - _Requirements: 13.3, 13.4, 13.5_
  
  - [x] 14.3 Create validation pipe untuk input validation
    - Configure ValidationPipe globally
    - Use class-validator decorators di DTOs
    - Return 400 untuk invalid input
    - _Requirements: 18.2_
  
  - [x] 14.4 Implement input sanitization
    - Create sanitization utilities
    - Prevent SQL injection dan XSS
    - _Requirements: 18.3_
  
  - [ ] 14.5 Write tests untuk guards dan interceptors
    - Test API key authentication
    - Test error handling
    - Test input validation
    - **Property 7: API Key Authentication**
    - **Validates: Requirements 3.5, 18.4**
  
  - [ ] 14.6 Write property test untuk error responses
    - **Property 25: Error Response Format**
    - **Validates: Requirements 13.3**
    - Test consistent error format
  
  - [ ] 14.7 Write property test untuk input validation
    - **Property 35: Input Validation**
    - **Validates: Requirements 18.2**
    - Test invalid input rejection

- [x] 15. Checkpoint - Verify API layer
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5: Additional Services (Minggu 9-10)

- [ ] 16. Migrate metrics dan analytics services
  - [ ] 16.1 Create MetricsModule dan MetricsCollectorService
    - Buat MetricsModule dengan providers
    - Migrate metrics-collector.js ke MetricsCollectorService
    - Inject repositories untuk metrics storage
    - _Requirements: 11.1, 11.2_
  
  - [ ] 16.2 Migrate HealthScoreCalculatorService
    - Migrate health-score-calculator.js
    - Implement calculateHealthScore() method
    - Ensure consistent score calculation
    - _Requirements: 11.3_
  
  - [ ] 16.3 Migrate QualityScorerService
    - Migrate quality-scorer.js
    - Implement calculateQualityScore() method
    - _Requirements: 11.4_
  
  - [ ] 16.4 Migrate CoverageTrackerService
    - Migrate coverage-tracker.js
    - Implement coverage tracking logic
    - _Requirements: 11.5_
  
  - [ ] 16.5 Implement developer dashboard data aggregation
    - Aggregate metrics untuk developer dashboard
    - _Requirements: 11.6_
  
  - [ ] 16.6 Write unit tests untuk metrics services
    - Test metrics collection
    - Test score calculations
    - **Property 20: Metrics Storage**
    - **Validates: Requirements 11.2**
  
  - [ ] 16.7 Write property test untuk score consistency
    - **Property 21: Score Calculation Consistency**
    - **Validates: Requirements 11.3, 11.4**
    - Test same input produces same output
  
  - [ ] 16.8 Write property test untuk dashboard data
    - **Property 22: Dashboard Data Availability**
    - **Validates: Requirements 11.6**
    - Test aggregated data correctness


- [x] 17. Migrate security dan compliance services
  - [x] 17.1 Create SecurityModule dan SecurityScannerService
    - Buat SecurityModule dengan providers
    - Migrate security-scanner.js
    - Implement vulnerability detection
    - _Requirements: 18.1_
  
  - [x] 17.2 Migrate DependencyScannerService
    - Migrate dependency-scanner.js
    - Implement dependency analysis
    - _Requirements: 18.1_
  
  - [x] 17.3 Migrate ComplianceReporterService
    - Migrate compliance-reporter.js
    - Implement compliance reporting
    - _Requirements: 18.1_
  
  - [x] 17.4 Implement security headers middleware
    - Install dan configure helmet
    - Apply security headers ke responses
    - _Requirements: 18.1_
  
  - [x] 17.5 Implement rate limiting
    - Install @nestjs/throttler
    - Configure rate limits
    - Return 429 untuk excessive requests
    - _Requirements: 18.6_
  
  - [ ] 17.6 Implement authentication logging
    - Log semua authentication attempts
    - Include timestamp, hashed API key, result
    - _Requirements: 18.5_
  
  - [x] 17.7 Write security tests
    - Test security headers presence
    - Test rate limiting
    - Test authentication logging
    - **Property 34: Security Headers Present**
    - **Validates: Requirements 18.1**
  
  - [ ] 17.8 Write property test untuk input sanitization
    - **Property 36: Input Sanitization**
    - **Validates: Requirements 18.3**
    - Test malicious input handling
  
  - [ ] 17.9 Write property test untuk rate limiting
    - **Property 38: Rate Limiting**
    - **Validates: Requirements 18.6**
    - Test excessive requests blocked


- [ ] 18. Migrate team dan developer services
  - [ ] 18.1 Create TeamModule dan services
    - Buat TeamModule dengan providers
    - Migrate developer-dashboard.js ke DeveloperDashboardService
    - Migrate assignment-engine.js ke AssignmentEngineService
    - Migrate capacity-planner.js ke CapacityPlannerService
    - Migrate gamification-engine.js ke GamificationService
    - _Requirements: 11.6_
  
  - [ ] 18.2 Write unit tests untuk team services
    - Test developer metrics aggregation
    - Test reviewer assignment logic
    - Test capacity planning

- [ ] 19. Migrate utility services
  - [ ] 19.1 Migrate remaining utility services
    - Migrate batch-processor.js ke BatchProcessorService
    - Migrate data-exporter.js ke DataExporterService
    - Migrate audit-logger.js ke AuditLoggerService
    - Setup sebagai providers di modules yang sesuai
    - _Requirements: 18.5_
  
  - [ ] 19.2 Write unit tests untuk utility services
    - Test batch processing
    - Test data export
    - Test audit logging

- [ ] 20. Checkpoint - Verify additional services
  - Ensure all tests pass, ask the user if questions arise.


### Phase 6: Electron Integration (Minggu 11-12)

- [ ] 21. Implement backend auto-start dari Electron
  - [ ] 21.1 Update electron/main.cjs untuk spawn NestJS backend
    - Modify startBackend() function untuk run NestJS
    - Development: spawn npm run backend:dev
    - Production: spawn node dari bundled backend
    - Use wait-on untuk wait health endpoint ready
    - _Requirements: 4.1, 4.2, 4.6_
  
  - [ ] 21.2 Implement health check waiting logic
    - Wait untuk http://localhost:3000/health ready
    - Timeout setelah 10 seconds
    - Show error notification jika backend gagal start
    - _Requirements: 4.3, 4.4_
  
  - [ ] 21.3 Implement graceful shutdown
    - Stop backend dengan SIGTERM saat Electron close
    - Ensure clean shutdown
    - _Requirements: 4.2_
  
  - [ ] 21.4 Implement backend health monitoring
    - Monitor backend process health
    - Restart jika crash
    - _Requirements: 4.5_
  
  - [ ] 21.5 Write E2E tests untuk Electron integration
    - Test backend auto-start
    - Test health check waiting
    - Test graceful shutdown
    - Test crash recovery


- [ ] 22. Update Electron API client untuk NestJS
  - [ ] 22.1 Verify electron/api-client.cjs compatibility
    - Test semua API calls ke NestJS endpoints
    - Verify response format compatibility
    - Test error handling
    - _Requirements: 3.1, 3.4_
  
  - [ ] 22.2 Update WebSocket connection logic
    - Verify WebSocket connection ke NestJS gateway
    - Test event handling
    - Test reconnection logic
    - _Requirements: 6.4, 6.5_
  
  - [ ] 22.3 Test CORS configuration
    - Verify CORS headers allow Electron renderer
    - Test cross-origin requests
    - _Requirements: 3.3_
  
  - [ ] 22.4 Write integration tests untuk API client
    - Test all API methods
    - Test WebSocket events
    - **Property 5: CORS Headers Present**
    - **Validates: Requirements 3.3**

- [ ] 23. Configure middleware dan global setup
  - [ ] 23.1 Setup global middleware di main.ts
    - Apply helmet untuk security headers
    - Apply compression middleware
    - Enable CORS dengan proper config
    - Apply ValidationPipe globally
    - Apply GlobalExceptionFilter
    - Apply LoggingInterceptor
    - _Requirements: 3.3, 18.1_
  
  - [ ] 23.2 Configure application bootstrap
    - Setup proper logging level
    - Configure port dari environment
    - Add startup logging
    - _Requirements: 1.6_
  
  - [ ] 23.3 Write tests untuk middleware setup
    - Test middleware applied correctly
    - Test global pipes dan filters

- [ ] 24. Checkpoint - Verify Electron integration
  - Ensure all tests pass, ask the user if questions arise.


### Phase 7: Testing dan Validation (Minggu 13-14)

- [ ] 25. Run comprehensive test suite
  - [ ] 25.1 Run all unit tests dan verify coverage
    - Execute vitest untuk all unit tests
    - Generate coverage report
    - Verify coverage ≥ 80%
    - Fix failing tests
    - _Requirements: 14.4_
  
  - [ ] 25.2 Run all property-based tests
    - Execute all 38 property tests (3 TypeORM + 35 general)
    - Run dengan minimum 100 iterations
    - Verify all properties pass
    - Fix any failing properties
    - _Requirements: 14.4_
  
  - [ ] 25.3 Run integration tests
    - Test full review flow end-to-end
    - Test API endpoints integration
    - Test WebSocket integration
    - Test database operations
    - _Requirements: 14.4_
  
  - [ ] 25.4 Run E2E tests dengan Electron
    - Test Electron app dengan NestJS backend
    - Test auto-start functionality
    - Test UI interactions
    - Test WebSocket real-time updates
    - _Requirements: 14.5_


- [ ] 26. Performance testing dan validation
  - [ ] 26.1 Measure startup performance
    - Measure backend startup time
    - Verify < 5 seconds
    - Optimize jika perlu
    - _Requirements: 17.1_
  
  - [ ] 26.2 Measure API response times
    - Test simple operations (GET single resource, health check)
    - Verify < 200ms response time
    - Profile slow endpoints
    - _Requirements: 17.2_
  
  - [ ] 26.3 Measure WebSocket broadcast latency
    - Test event broadcast time
    - Verify < 100ms latency
    - _Requirements: 17.3_
  
  - [ ] 26.4 Measure memory usage
    - Monitor backend memory consumption
    - Compare dengan Express baseline
    - Verify ≤ 150% of Express
    - _Requirements: 17.4_
  
  - [ ] 26.5 Load test concurrent requests
    - Test concurrent request handling
    - Verify minimal sama dengan Express
    - Identify bottlenecks
    - _Requirements: 17.5_
  
  - [ ] 26.6 Write property tests untuk performance
    - **Property 29: Startup Performance**
    - **Validates: Requirements 17.1**
    - **Property 30: Simple Operation Response Time**
    - **Validates: Requirements 17.2**
    - **Property 32: Memory Usage Limit**
    - **Validates: Requirements 17.4**
    - **Property 33: Concurrent Request Handling**
    - **Validates: Requirements 17.5**


- [ ] 27. Compatibility validation
  - [ ] 27.1 Verify API endpoint compatibility
    - Test semua endpoints match Express behavior
    - Verify request/response formats identical
    - Test error responses
    - _Requirements: 3.1, 16.3_
  
  - [ ] 27.2 Verify WebSocket event compatibility
    - Test event types match Express
    - Verify payload structures identical
    - Test event timing
    - _Requirements: 6.4_
  
  - [ ] 27.3 Verify Electron app functionality unchanged
    - Test all UI features work correctly
    - Test dashboard updates
    - Test notifications
    - Verify no breaking changes
    - _Requirements: 3.2, 16.3_
  
  - [ ] 27.4 Test fresh database creation dengan TypeORM
    - Delete existing database
    - Start backend dan verify schema auto-created
    - Verify all entities created correctly
    - Test basic operations
    - _Requirements: 2.6, 16.5_
  
  - [ ] 27.5 Write property tests untuk compatibility
    - **Property 13: Review Event Emission**
    - **Validates: Requirements 7.6**
    - **Property 16: Repository-Specific Config Override**
    - **Validates: Requirements 9.3**
    - **Property 19: Auto-Merge Health Check**
    - **Validates: Requirements 10.5**
    - **Property 24: HTTP Request Logging**
    - **Validates: Requirements 12.6**
    - **Property 26: Error Logging with Stack Trace**
    - **Validates: Requirements 13.4**
    - **Property 27: Structured Error Codes**
    - **Validates: Requirements 13.5**
    - **Property 37: Authentication Attempt Logging**
    - **Validates: Requirements 18.5**

- [ ] 28. Checkpoint - Verify all testing complete
  - Ensure all tests pass, ask the user if questions arise.


### Phase 8: Documentation dan Deployment (Minggu 15-16)

- [ ] 29. Create documentation
  - [ ] 29.1 Update README dengan NestJS setup instructions
    - Document installation steps
    - Document development workflow
    - Document testing procedures
    - Document build process
    - _Requirements: 16.4_
  
  - [ ] 29.2 Write migration guide untuk developers
    - Document architecture changes
    - Document breaking changes (if any)
    - Document migration steps
    - Document rollback procedure
    - _Requirements: 16.4_
  
  - [ ] 29.3 Document new architecture dan patterns
    - Document module organization
    - Document dependency injection patterns
    - Document TypeORM usage
    - Document testing strategy
    - _Requirements: 16.4_
  
  - [ ] 29.4 Update API documentation
    - Document all endpoints
    - Document request/response formats
    - Document error codes
    - Document WebSocket events
    - _Requirements: 16.4_


- [ ] 30. Configure production build
  - [ ] 30.1 Setup NestJS production build configuration
    - Configure nest-cli.json untuk production
    - Setup tsconfig.json untuk optimal output
    - Configure asset copying (SQL files, templates)
    - _Requirements: 15.1, 15.2_
  
  - [ ] 30.2 Configure package.json scripts
    - Add backend:dev script (nest start --watch)
    - Add backend:build script (nest build)
    - Add backend:start script (node dist/main.js)
    - Add backend:test scripts
    - Update electron scripts untuk NestJS
    - _Requirements: 15.2_
  
  - [ ] 30.3 Update electron-builder configuration
    - Configure files untuk include dist/ backend
    - Setup extraResources untuk backend bundle
    - Configure platform-specific builds
    - _Requirements: 15.3, 15.4_
  
  - [ ] 30.4 Test production build locally
    - Run backend:build dan verify output
    - Test standalone backend execution
    - Test Electron app dengan bundled backend
    - _Requirements: 15.4_


- [ ] 31. Create release builds dan deploy
  - [ ] 31.1 Test development mode end-to-end
    - Run app:dev dan verify hot reload works
    - Test backend auto-restart on changes
    - Test UI hot reload
    - _Requirements: 15.5_
  
  - [ ] 31.2 Create release builds untuk all platforms
    - Build untuk Windows (NSIS installer)
    - Build untuk macOS (DMG)
    - Build untuk Linux (AppImage)
    - Verify builds complete successfully
    - _Requirements: 15.4_
  
  - [ ] 31.3 Test release builds
    - Install dan test Windows build
    - Install dan test macOS build
    - Install dan test Linux build
    - Verify backend auto-start works
    - Verify all features functional
    - _Requirements: 15.4_
  
  - [ ] 31.4 Verify standalone dan embedded modes
    - Test backend standalone mode (npm run backend:start)
    - Test backend embedded mode (via Electron)
    - Verify both modes work correctly
    - _Requirements: 15.6_

- [ ] 32. Final validation dan sign-off
  - [ ] 32.1 Run complete test suite one final time
    - Execute all unit tests
    - Execute all property tests (38 properties)
    - Execute all integration tests
    - Execute all E2E tests
    - Verify 100% pass rate
  
  - [ ] 32.2 Verify success criteria checklist
    - ✅ All 38 correctness properties pass
    - ✅ Test coverage ≥ 80%
    - ✅ Startup time < 5 seconds
    - ✅ API response time < 200ms
    - ✅ WebSocket latency < 100ms
    - ✅ Memory usage ≤ 150% of Express baseline
    - ✅ Zero breaking changes untuk Electron app
    - ✅ All existing features work identically
    - ✅ Production builds successful untuk all platforms
    - ✅ E2E tests pass dengan Electron integration
    - ✅ TypeORM entities auto-create database schema correctly
    - ✅ Fresh database dapat dibuat tanpa manual SQL scripts
  
  - [ ] 32.3 Create release notes
    - Document what changed
    - Document new features (if any)
    - Document known issues (if any)
    - Document upgrade instructions

- [ ] 33. Checkpoint - Final sign-off
  - Ensure all tests pass, ask the user if questions arise.


## Catatan Implementasi

### TypeORM vs better-sqlite3

Refactor ini menggunakan TypeORM dengan SQLite driver (sqlite3 package) sebagai pengganti better-sqlite3:

- **Async Operations**: Semua database operations menjadi async (tidak synchronous seperti better-sqlite3)
- **Repository Pattern**: Gunakan TypeORM repositories untuk CRUD operations
- **Entity-Based Schema**: Schema didefinisikan via entity classes dengan decorators
- **Auto-Sync**: Development mode menggunakan `synchronize: true` untuk auto-create schema
- **Transactions**: Gunakan QueryRunner untuk manual transaction control
- **Fresh Database**: Data loss acceptable - database schema dibuat fresh dari entities

### Testing Strategy

- **Unit Tests**: Test individual services dengan mocked dependencies
- **Property Tests**: Verify 38 correctness properties (3 TypeORM-specific + 35 general)
- **Integration Tests**: Test interactions between modules
- **E2E Tests**: Test complete workflows dengan Electron

### Migration Approach

- **Incremental**: Migrate services satu per satu, test setiap step
- **Checkpoints**: Regular checkpoints untuk validation
- **Rollback Ready**: Maintain Express branch untuk rollback jika needed
- **Fresh Start**: TypeORM entities create fresh schema, no migration scripts needed

### Performance Targets

- Startup time: < 5 seconds
- API response time: < 200ms (simple operations)
- WebSocket latency: < 100ms
- Memory usage: ≤ 150% of Express baseline
- Concurrent requests: Minimal sama dengan Express

### Success Criteria

Migration dianggap sukses jika semua 12 success criteria terpenuhi (listed di task 32.2).

