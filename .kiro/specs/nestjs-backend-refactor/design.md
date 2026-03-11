# Design Document: NestJS Backend Refactor

## Overview

Dokumen ini menjelaskan desain teknis untuk refactor backend PR Review Agent dari Express ke NestJS dengan TypeScript. Refactor ini bertujuan untuk meningkatkan struktur kode, maintainability, dan scalability dengan mengadopsi arsitektur modular NestJS sambil mempertahankan 100% kompatibilitas dengan aplikasi Electron desktop yang sudah ada.

### Tujuan Desain

1. **Modularitas**: Mengorganisir kode dalam NestJS modules yang terpisah berdasarkan domain
2. **Type Safety**: Memanfaatkan TypeScript untuk mengurangi runtime errors
3. **Dependency Injection**: Menggunakan DI pattern untuk loose coupling dan testability
4. **Backward Compatibility**: Mempertahankan semua API contracts dan database schema existing
5. **Performance**: Memastikan performance tidak menurun dari implementasi Express

### Prinsip Desain

- **Zero Breaking Changes**: Semua API endpoints, WebSocket events, dan database schema tetap sama
- **Gradual Migration**: Mendukung migrasi bertahap dengan feature flags jika diperlukan
- **Electron Integration**: Backend dapat berjalan sebagai standalone process atau embedded dalam Electron
- **SQLite First**: Tetap menggunakan better-sqlite3 dengan synchronous API
- **Testing Continuity**: Mempertahankan atau meningkatkan test coverage existing

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React UI   │  │   Preload    │  │ Main Process │      │
│  │  (Renderer)  │◄─┤   (IPC)      │◄─┤ (Auto-Start) │      │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘      │
│         │                                     │              │
└─────────┼─────────────────────────────────────┼──────────────┘
          │ HTTP/WS                             │ Child Process
          ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend Server                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   HTTP Layer                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │   Guards   │  │Interceptors│  │   Pipes    │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Controllers Layer                     │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │  │
│  │  │  PR  │ │Review│ │Metric│ │ Team │ │Config│      │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Services Layer                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │   Review   │  │   GitHub   │  │     AI     │     │  │
│  │  │   Engine   │  │   Client   │  │  Executor  │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │  Metrics   │  │   Config   │  │  Security  │     │  │
│  │  │ Collector  │  │  Manager   │  │  Scanner   │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Providers Layer                       │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │  Database  │  │   Logger   │  │  WebSocket │     │  │
│  │  │  Manager   │  │  Service   │  │  Gateway   │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                                     │
          ▼                                     ▼
┌──────────────────┐                  ┌──────────────────┐
│ SQLite Database  │                  │  External APIs   │
│ (better-sqlite3) │                  │  (GitHub, AI)    │
└──────────────────┘                  └──────────────────┘
```

### Module Organization

NestJS backend akan diorganisir dalam modules berikut:

#### Core Modules

1. **AppModule** (Root Module)
   - Mengimport semua feature modules
   - Konfigurasi global middleware, guards, interceptors
   - Setup WebSocket gateway

2. **ConfigModule**
   - Environment configuration
   - Repository-specific overrides
   - Validation schemas

3. **DatabaseModule**
   - TypeORM configuration untuk SQLite
   - Entity registration
   - Repository providers
   - Transaction support

4. **LoggerModule**
   - Custom logger implementation
   - Daily rotation
   - Log formatting

#### Feature Modules

5. **PullRequestModule**
   - PR scanning dan monitoring
   - PR operations (list, get, update)
   - Controllers: `PullRequestController`
   - Services: `PullRequestService`

6. **ReviewModule**
   - Review orchestration
   - Comment posting
   - Auto-fix application
   - Controllers: `ReviewController`
   - Services: `ReviewEngineService`, `CommentParserService`, `ChecklistService`

7. **GitHubModule**
   - GitHub API integration
   - Repository cloning
   - Branch operations
   - CI integration
   - Controllers: `WebhookController`
   - Services: `GitHubClientService`, `CiIntegrationService`, `AutoMergeService`

8. **AiModule**
   - AI executor management
   - Multi-executor support
   - Auto-fix generation
   - Services: `AiExecutorService`, `AiFixGeneratorService`, `DelegateService`

9. **MetricsModule**
   - Metrics collection
   - Health score calculation
   - Quality scoring
   - Coverage tracking
   - Controllers: `MetricsController`
   - Services: `MetricsCollectorService`, `HealthScoreService`, `QualityScorerService`

10. **TeamModule**
    - Developer dashboard
    - Reviewer assignment
    - Capacity planning
    - Gamification
    - Controllers: `TeamController`
    - Services: `DeveloperDashboardService`, `AssignmentEngineService`, `CapacityPlannerService`

11. **SecurityModule**
    - Security scanning
    - Dependency analysis
    - Compliance reporting
    - Controllers: `SecurityController`
    - Services: `SecurityScannerService`, `DependencyScannerService`, `ComplianceReporterService`

12. **WebSocketModule**
    - Real-time updates
    - Event broadcasting
    - Gateway: `ReviewGateway`

### Dependency Injection Pattern

```typescript
// Example: ReviewEngineService dengan DI
@Injectable()
export class ReviewEngineService {
  constructor(
    private readonly githubClient: GitHubClientService,
    private readonly aiExecutor: AiExecutorService,
    private readonly dbManager: DatabaseManagerService,
    private readonly wsGateway: ReviewGateway,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}
  
  async reviewPullRequest(prNumber: number): Promise<ReviewResult> {
    // Implementation
  }
}
```

## Components and Interfaces

### Core Components

#### 1. TypeORM Entities

Entity classes untuk mendefinisikan database schema.

```typescript
// src/database/entities/pull-request.entity.ts
@Entity('pull_requests')
export class PullRequest {
  @PrimaryColumn()
  number: number;
  
  @Column()
  title: string;
  
  @Column()
  author: string;
  
  @Column()
  repository: string;
  
  @Column()
  branch: string;
  
  @Column({ name: 'base_branch' })
  baseBranch: string;
  
  @Column()
  status: string;
  
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
  
  @Column()
  url: string;
  
  @Column({ name: 'is_draft' })
  isDraft: boolean;
  
  @Column('simple-json')
  labels: string[];
  
  @OneToMany(() => Review, review => review.pullRequest)
  reviews: Review[];
}

// src/database/entities/review.entity.ts
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ name: 'pr_number' })
  prNumber: number;
  
  @Column()
  repository: string;
  
  @Column()
  status: string;
  
  @Column()
  mode: string;
  
  @Column()
  executor: string;
  
  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;
  
  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
  
  @ManyToOne(() => PullRequest, pr => pr.reviews)
  @JoinColumn({ name: 'pr_number' })
  pullRequest: PullRequest;
  
  @OneToMany(() => Comment, comment => comment.review)
  comments: Comment[];
  
  @OneToOne(() => ReviewMetrics, metrics => metrics.review)
  metrics: ReviewMetrics;
}

// src/database/entities/comment.entity.ts
@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ name: 'review_id' })
  reviewId: string;
  
  @Column()
  file: string;
  
  @Column()
  line: number;
  
  @Column()
  severity: string;
  
  @Column()
  category: string;
  
  @Column('text')
  message: string;
  
  @Column('text', { nullable: true })
  suggestion: string;
  
  @Column({ name: 'posted_at', nullable: true })
  postedAt: Date;
  
  @ManyToOne(() => Review, review => review.comments)
  @JoinColumn({ name: 'review_id' })
  review: Review;
}

// src/database/entities/review-metrics.entity.ts
@Entity('review_metrics')
export class ReviewMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column({ name: 'review_id' })
  reviewId: string;
  
  @Column()
  duration: number;
  
  @Column({ name: 'files_reviewed' })
  filesReviewed: number;
  
  @Column({ name: 'comments_generated' })
  commentsGenerated: number;
  
  @Column('simple-json', { name: 'issues_found' })
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
    architecture: number;
    testing: number;
  };
  
  @Column({ name: 'health_score' })
  healthScore: number;
  
  @Column({ name: 'quality_score' })
  qualityScore: number;
  
  @OneToOne(() => Review, review => review.metrics)
  @JoinColumn({ name: 'review_id' })
  review: Review;
}

// src/database/entities/repository-config.entity.ts
@Entity('repository_configs')
export class RepositoryConfig {
  @PrimaryColumn()
  repository: string;
  
  @Column()
  enabled: boolean;
  
  @Column({ name: 'review_mode' })
  reviewMode: string;
  
  @Column()
  executor: string;
  
  @Column({ name: 'scan_scope' })
  scanScope: string;
  
  @Column({ name: 'auto_merge' })
  autoMerge: boolean;
  
  @Column('simple-json', { name: 'protected_branches' })
  protectedBranches: string[];
  
  @Column('simple-json', { name: 'exclude_patterns' })
  excludePatterns: string[];
  
  @Column('text', { name: 'custom_prompt', nullable: true })
  customPrompt: string;
  
  @Column()
  version: number;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// src/database/entities/developer-metrics.entity.ts
@Entity('developer_metrics')
export class DeveloperMetrics {
  @PrimaryColumn()
  username: string;
  
  @Column({ name: 'total_prs' })
  totalPrs: number;
  
  @Column({ name: 'reviewed_prs' })
  reviewedPrs: number;
  
  @Column({ name: 'average_health_score', type: 'float' })
  averageHealthScore: number;
  
  @Column({ name: 'average_quality_score', type: 'float' })
  averageQualityScore: number;
  
  @Column('simple-json', { name: 'issues_found' })
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
  };
  
  @Column({ name: 'average_review_time' })
  averageReviewTime: number;
  
  @Column({ name: 'last_review_at', nullable: true })
  lastReviewAt: Date;
  
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Key Entities:**
- `PullRequest`: PR data dengan relations ke reviews
- `Review`: Review sessions dengan relations ke PR, comments, dan metrics
- `Comment`: Review comments dengan relation ke review
- `ReviewMetrics`: Metrics data dengan one-to-one relation ke review
- `RepositoryConfig`: Repository-specific configurations
- `DeveloperMetrics`: Developer statistics

#### 2. ReviewEngineService

Service utama untuk orkestrasi review process dengan TypeORM repositories.

```typescript
@Injectable()
export class ReviewEngineService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(ReviewMetrics)
    private metricsRepository: Repository<ReviewMetrics>,
    private githubClient: GitHubClientService,
    private aiExecutor: AiExecutorService,
    private wsGateway: ReviewGateway,
    private logger: LoggerService,
    private dataSource: DataSource,
  ) {}
  
  async reviewPullRequest(options: ReviewOptions): Promise<ReviewResult> {
    // Use QueryRunner for transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // 1. Create review record
      const review = this.reviewRepository.create({
        prNumber: options.prNumber,
        repository: options.repository,
        status: 'in_progress',
        mode: options.mode,
        executor: options.executor,
      });
      await queryRunner.manager.save(review);
      
      // 2. Clone repository
      const repoPath = await this.githubClient.cloneRepository(
        options.repository,
        options.branch
      );
      
      // 3. Execute AI review
      const output = await this.aiExecutor.executeReview(options.executor, {
        repoPath,
        prNumber: options.prNumber,
      });
      
      // 4. Save comments
      const comments = output.comments.map(c => 
        this.commentRepository.create({
          reviewId: review.id,
          ...c,
        })
      );
      await queryRunner.manager.save(comments);
      
      // 5. Calculate and save metrics
      const metrics = this.metricsRepository.create({
        reviewId: review.id,
        duration: Date.now() - review.startedAt.getTime(),
        filesReviewed: output.filesReviewed,
        commentsGenerated: comments.length,
        issuesFound: this.calculateIssues(comments),
        healthScore: this.calculateHealthScore(comments),
        qualityScore: this.calculateQualityScore(comments),
      });
      await queryRunner.manager.save(metrics);
      
      // 6. Update review status
      review.status = 'completed';
      review.completedAt = new Date();
      await queryRunner.manager.save(review);
      
      await queryRunner.commitTransaction();
      
      // 7. Post results
      if (options.mode === 'comment') {
        await this.githubClient.postComments(options.prNumber, comments);
      } else {
        await this.githubClient.applyAutoFix(options.prNumber, output.fixes);
      }
      
      // 8. Emit WebSocket event
      this.wsGateway.broadcastReviewComplete(options.prNumber, {
        reviewId: review.id,
        metrics,
      });
      
      return { review, comments, metrics };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  
  async continuousMode(): Promise<void> {
    // Scan PRs periodically
  }
  
  async onceMode(): Promise<void> {
    // Run review once and exit
  }
}
```

**Key Methods:**
- `reviewPullRequest()`: Review single PR dengan transaction support
- `continuousMode()`: Run continuous scanning
- `onceMode()`: Run once and exit
- Uses TypeORM repositories untuk database operations
- Uses QueryRunner untuk manual transaction control

#### 3. AiExecutorService

Service untuk menjalankan berbagai AI executors dengan strategy pattern.

```typescript
interface AiExecutor {
  name: string;
  execute(context: ReviewContext): Promise<string>;
}

@Injectable()
export class AiExecutorService {
  private executors: Map<string, AiExecutor>;
  
  async executeReview(
    executor: string,
    context: ReviewContext
  ): Promise<ReviewOutput> {
    // Select and execute appropriate executor
  }
  
  async generateFix(comment: Comment): Promise<string> {
    // Generate auto-fix code
  }
}
```

**Supported Executors:**
- GeminiExecutor
- CopilotExecutor
- KiroExecutor
- ClaudeExecutor
- CodexExecutor
- OpenCodeExecutor

#### 4. GitHubClientService

Service untuk interaksi dengan GitHub API menggunakan gh CLI.

```typescript
@Injectable()
export class GitHubClientService {
  async scanPullRequests(scope: ScanScope): Promise<PullRequest[]> {
    // Scan PRs based on scope (authored, assigned, review-requested)
  }
  
  async postComment(pr: number, comment: Comment): Promise<void> {
    // Post atomic comment
  }
  
  async cloneRepository(repo: string, branch: string): Promise<string> {
    // Clone and checkout
  }
  
  async autoMerge(pr: number): Promise<boolean> {
    // Auto-merge with health checks
  }
  
  async getCiStatus(pr: number): Promise<CiStatus> {
    // Get CI status
  }
}
```

#### 5. ConfigService (Extended)

NestJS ConfigService dengan custom configuration.

```typescript
@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}
  
  get<T>(key: string): T {
    return this.configService.get<T>(key);
  }
  
  getRepositoryConfig(repo: string): RepositoryConfig {
    // Get repo-specific overrides
  }
  
  validateConfig(): void {
    // Validate configuration at startup
  }
}
```

#### 6. ReviewGateway (WebSocket)

WebSocket gateway untuk real-time updates.

```typescript
@WebSocketGateway()
export class ReviewGateway {
  @WebSocketServer()
  server: Server;
  
  broadcastReviewStart(pr: number): void {
    this.server.emit('review:start', { pr });
  }
  
  broadcastReviewComplete(pr: number, result: ReviewResult): void {
    this.server.emit('review:complete', { pr, result });
  }
  
  broadcastReviewError(pr: number, error: Error): void {
    this.server.emit('review:error', { pr, error });
  }
}
```

**Events:**
- `review:start`: Review dimulai
- `review:progress`: Progress update
- `review:complete`: Review selesai
- `review:error`: Error occurred
- `metrics:update`: Metrics updated

#### 7. MetricsCollectorService

Service untuk mengumpulkan dan menghitung metrics.

```typescript
@Injectable()
export class MetricsCollectorService {
  async collectReviewMetrics(review: Review): Promise<void> {
    // Store review metrics
  }
  
  async calculateHealthScore(pr: number): Promise<number> {
    // Calculate PR health score
  }
  
  async calculateQualityScore(pr: number): Promise<number> {
    // Calculate code quality score
  }
  
  async trackCoverage(pr: number): Promise<CoverageData> {
    // Track test coverage
  }
}
```

### Controllers

#### PullRequestController

```typescript
@Controller('api/prs')
export class PullRequestController {
  @Get()
  async listPullRequests(@Query() query: ListPrQuery): Promise<PullRequest[]> {}
  
  @Get(':number')
  async getPullRequest(@Param('number') number: number): Promise<PullRequest> {}
  
  @Post(':number/review')
  async triggerReview(@Param('number') number: number): Promise<ReviewResult> {}
}
```

#### ReviewController

```typescript
@Controller('api/reviews')
export class ReviewController {
  @Get()
  async listReviews(@Query() query: ListReviewQuery): Promise<Review[]> {}
  
  @Get(':id')
  async getReview(@Param('id') id: string): Promise<Review> {}
  
  @Post()
  async createReview(@Body() dto: CreateReviewDto): Promise<Review> {}
}
```

#### MetricsController

```typescript
@Controller('api/metrics')
export class MetricsController {
  @Get('overview')
  async getOverview(): Promise<MetricsOverview> {}
  
  @Get('pr/:number')
  async getPrMetrics(@Param('number') number: number): Promise<PrMetrics> {}
  
  @Get('developer/:username')
  async getDeveloperMetrics(@Param('username') username: string): Promise<DeveloperMetrics> {}
}
```

### Guards and Interceptors

#### ApiKeyGuard

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    return this.validateApiKey(apiKey);
  }
}
```

#### LoggingInterceptor

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(`${request.method} ${request.url} - ${duration}ms`);
      })
    );
  }
}
```

#### ErrorInterceptor

```typescript
@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError(err => {
        // Transform errors to consistent format
        throw new HttpException(
          {
            statusCode: err.status || 500,
            message: err.message,
            errorCode: err.code,
          },
          err.status || 500
        );
      })
    );
  }
}
```

### Exception Filters

#### GlobalExceptionFilter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : 500;
    
    const message = exception instanceof HttpException
      ? exception.message
      : 'Internal server error';
    
    this.logger.error(`${request.method} ${request.url}`, exception);
    
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

## Data Models

### TypeScript Interfaces

#### PullRequest

```typescript
interface PullRequest {
  number: number;
  title: string;
  author: string;
  repository: string;
  branch: string;
  baseBranch: string;
  status: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
  url: string;
  isDraft: boolean;
  labels: string[];
}
```

#### Review

```typescript
interface Review {
  id: string;
  prNumber: number;
  repository: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  mode: 'comment' | 'auto-fix';
  executor: string;
  startedAt: Date;
  completedAt?: Date;
  comments: Comment[];
  metrics: ReviewMetrics;
}
```

#### Comment

```typescript
interface Comment {
  id: string;
  reviewId: string;
  file: string;
  line: number;
  severity: 'info' | 'warning' | 'error';
  category: 'bug' | 'security' | 'performance' | 'maintainability' | 'architecture' | 'testing';
  message: string;
  suggestion?: string;
  postedAt?: Date;
}
```

#### ReviewMetrics

```typescript
interface ReviewMetrics {
  reviewId: string;
  duration: number; // milliseconds
  filesReviewed: number;
  commentsGenerated: number;
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
    architecture: number;
    testing: number;
  };
  healthScore: number; // 0-100
  qualityScore: number; // 0-100
}
```

#### RepositoryConfig

```typescript
interface RepositoryConfig {
  repository: string;
  enabled: boolean;
  reviewMode: 'comment' | 'auto-fix';
  executor: string;
  scanScope: 'authored' | 'assigned' | 'review-requested' | 'all';
  autoMerge: boolean;
  protectedBranches: string[];
  excludePatterns: string[];
  customPrompt?: string;
  version: number;
}
```

#### DeveloperMetrics

```typescript
interface DeveloperMetrics {
  username: string;
  totalPrs: number;
  reviewedPrs: number;
  averageHealthScore: number;
  averageQualityScore: number;
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
  };
  averageReviewTime: number; // milliseconds
  lastReviewAt?: Date;
}
```

### Database Schema

Database schema didefinisikan menggunakan TypeORM entities. TypeORM akan auto-create atau sync schema saat aplikasi startup.

**Key Tables (Auto-generated dari Entities):**
- `pull_requests`: Menyimpan PR data (dari PullRequest entity)
- `reviews`: Menyimpan review sessions (dari Review entity)
- `comments`: Menyimpan review comments (dari Comment entity)
- `review_metrics`: Menyimpan review metrics (dari ReviewMetrics entity)
- `developer_metrics`: Menyimpan developer statistics (dari DeveloperMetrics entity)
- `repository_configs`: Menyimpan repository-specific configurations (dari RepositoryConfig entity)

**Schema Synchronization:**
- Development: `synchronize: true` untuk auto-sync schema changes
- Production: `synchronize: false`, gunakan migrations untuk schema changes

### DTOs (Data Transfer Objects)

#### CreateReviewDto

```typescript
class CreateReviewDto {
  @IsNumber()
  prNumber: number;
  
  @IsString()
  repository: string;
  
  @IsEnum(['comment', 'auto-fix'])
  mode: 'comment' | 'auto-fix';
  
  @IsString()
  @IsOptional()
  executor?: string;
}
```

#### ListPrQuery

```typescript
class ListPrQuery {
  @IsString()
  @IsOptional()
  repository?: string;
  
  @IsEnum(['open', 'closed', 'merged'])
  @IsOptional()
  status?: string;
  
  @IsNumber()
  @IsOptional()
  limit?: number;
  
  @IsNumber()
  @IsOptional()
  offset?: number;
}
```

#### UpdateConfigDto

```typescript
class UpdateConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
  
  @IsEnum(['comment', 'auto-fix'])
  @IsOptional()
  reviewMode?: string;
  
  @IsString()
  @IsOptional()
  executor?: string;
  
  @IsBoolean()
  @IsOptional()
  autoMerge?: boolean;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Setelah menganalisis semua acceptance criteria, saya mengidentifikasi beberapa redundansi yang perlu dieliminasi:

1. **Endpoint Existence Properties (5.1-5.7)**: Semua kriteria tentang keberadaan endpoint groups dapat digabungkan menjadi satu property yang memverifikasi semua endpoint categories tersedia.

2. **Score Calculation Properties (11.3-11.4)**: Health score dan quality score calculation dapat digabungkan karena keduanya mengikuti pola yang sama - menghitung score berdasarkan metrics.

3. **Authentication Properties (3.5, 18.4)**: Kedua kriteria ini membahas API key authentication dan dapat digabungkan menjadi satu property komprehensif.

4. **Logging Properties (12.6, 13.4, 18.5)**: Berbagai kriteria logging dapat digabungkan menjadi property yang lebih komprehensif tentang logging behavior.

5. **Performance Properties (17.1-17.3)**: Startup time, response time, dan broadcast time dapat dikelompokkan sebagai performance benchmarks yang berbeda, namun tetap dipisah karena mengukur aspek yang berbeda.

### Property 1: TypeORM Repository Injection

*For any* service yang membutuhkan database access, TypeORM repository harus dapat di-inject menggunakan @InjectRepository decorator dan berfungsi dengan benar.

**Validates: Requirements 2.3**

### Property 2: Database Transactions Rollback

*For any* database transaction yang mengalami error, semua operasi dalam transaction harus di-rollback dan database state harus kembali ke kondisi sebelum transaction dimulai.

**Validates: Requirements 2.5**

### Property 3: Entity Relations Loading

*For any* entity dengan relations (OneToMany, ManyToOne, OneToOne), relations harus dapat di-load dengan benar menggunakan eager loading atau explicit loading.

**Validates: Requirements 2.3**

### Property 4: API Endpoint Compatibility

*For any* REST API endpoint yang ada di Express implementation, NestJS implementation harus menyediakan endpoint yang sama dengan path, method, request format, dan response format yang identik.

**Validates: Requirements 3.1, 5.8, 16.3**

### Property 5: CORS Headers Present

*For any* HTTP response dari Backend_Server, response harus menyertakan CORS headers yang memungkinkan komunikasi dengan Electron renderer process.

**Validates: Requirements 3.3**

### Property 6: Response Format Compatibility

*For any* request dari Electron_App ke Backend_Server, response data structure harus match dengan format yang diharapkan oleh Electron_App (field names, types, nesting).

**Validates: Requirements 3.4**

### Property 7: API Key Authentication

*For any* protected endpoint, request dengan valid API key di X-API-Key header harus succeed, dan request tanpa atau dengan invalid API key harus fail dengan 401 status code.

**Validates: Requirements 3.5, 18.4**

### Property 8: WebSocket Event Broadcasting

*For any* review event yang terjadi (start, progress, complete, error), semua connected WebSocket clients harus menerima event broadcast dengan event type dan payload yang correct.

**Validates: Requirements 6.3**

### Property 9: WebSocket Event Compatibility

*For any* WebSocket event yang di-emit oleh Backend_Server, event type dan payload structure harus match dengan format yang diharapkan oleh Electron_App.

**Validates: Requirements 6.4**

### Property 10: Review Process Functional Compatibility

*For any* pull request yang di-review, NestJS Review_Engine harus menghasilkan review results (comments, metrics, scores) yang equivalent dengan Express implementation untuk input yang sama.

**Validates: Requirements 7.2**

### Property 11: Repository Clone and Checkout

*For any* review yang dimulai, Review_Engine harus clone repository ke workspace directory dan checkout branch yang correct sebelum menjalankan AI review.

**Validates: Requirements 7.4**

### Property 12: Review Completion Action

*For any* completed review, Review_Engine harus melakukan action yang correct berdasarkan mode: post comments jika mode='comment', atau apply auto-fix jika mode='auto-fix'.

**Validates: Requirements 7.5**

### Property 13: Review Event Emission

*For any* review lifecycle event (start, progress, complete, error), Review_Engine harus emit corresponding WebSocket event dengan timing yang correct.

**Validates: Requirements 7.6**

### Property 14: AI Executor Selection

*For any* review request dengan specified executor dalam configuration, AI_Executor harus memilih dan menggunakan executor yang correct (Gemini, Copilot, Kiro, Claude, Codex, atau OpenCode).

**Validates: Requirements 8.4**

### Property 15: AI Output Parsing

*For any* AI tool output, AI_Executor harus parse output menjadi structured comments dengan fields yang required (file, line, severity, category, message, suggestion).

**Validates: Requirements 8.5**

### Property 16: Repository-Specific Config Override

*For any* repository dengan specific configuration, Config_Manager harus return repository-specific values yang override global configuration values.

**Validates: Requirements 9.3**

### Property 17: GitHub PR Scanning Scope

*For any* configured scan scope (authored, assigned, review-requested, all), GitHub_Client harus return hanya PRs yang match scope criteria.

**Validates: Requirements 10.3**

### Property 18: Atomic Comment Posting

*For any* set of comments untuk single PR, GitHub_Client harus post semua comments atomically - jika satu comment gagal, semua comments harus di-rollback.

**Validates: Requirements 10.4**

### Property 19: Auto-Merge Health Check

*For any* PR yang eligible untuk auto-merge, GitHub_Client harus verify semua health checks (CI status, review approval, no conflicts) pass sebelum melakukan merge.

**Validates: Requirements 10.5**

### Property 20: Metrics Storage

*For any* completed review, Metrics_Collector harus store review metrics (duration, files reviewed, comments generated, issues found) ke SQLite_Database.

**Validates: Requirements 11.2**

### Property 21: Score Calculation Consistency

*For any* PR dengan review metrics, calculated health score dan quality score harus consistent - same metrics input harus menghasilkan same score output.

**Validates: Requirements 11.3, 11.4**

### Property 22: Dashboard Data Availability

*For any* developer dengan review history, Metrics_Collector harus menyediakan aggregated dashboard data (total PRs, average scores, issues found, review time).

**Validates: Requirements 11.6**

### Property 23: Log Format Compatibility

*For any* log entry yang ditulis, log format harus match Express implementation format: `[timestamp] [LEVEL] message`.

**Validates: Requirements 12.4**

### Property 24: HTTP Request Logging

*For any* HTTP request yang diterima Backend_Server, request harus di-log dengan method, URL, status code, dan response time.

**Validates: Requirements 12.6**

### Property 25: Error Response Format

*For any* error yang terjadi, Backend_Server harus respond dengan consistent error format yang include statusCode, message, timestamp, dan path.

**Validates: Requirements 13.3**

### Property 26: Error Logging with Stack Trace

*For any* error yang terjadi, Backend_Server harus log error dengan complete stack trace untuk debugging.

**Validates: Requirements 13.4**

### Property 27: Structured Error Codes

*For any* application error, error response harus include specific error code yang identify error type.

**Validates: Requirements 13.5**

### Property 28: Feature Flag Control

*For any* feature dengan feature flag, behavior harus berubah correctly berdasarkan flag value (enabled/disabled).

**Validates: Requirements 16.2**

### Property 29: Startup Performance

*For any* Backend_Server startup, server harus ready untuk menerima requests dalam waktu kurang dari 5 detik.

**Validates: Requirements 17.1**

### Property 30: Simple Operation Response Time

*For any* simple REST API operation (get single resource, health check), response time harus kurang dari 200ms.

**Validates: Requirements 17.2**

### Property 31: WebSocket Broadcast Latency

*For any* WebSocket broadcast event, event harus dikirim ke semua connected clients dalam waktu kurang dari 100ms.

**Validates: Requirements 17.3**

### Property 32: Memory Usage Limit

*For any* Backend_Server runtime state, memory usage harus tidak melebihi 150% dari Express implementation baseline.

**Validates: Requirements 17.4**

### Property 33: Concurrent Request Handling

*For any* set of concurrent requests, Backend_Server harus handle minimal sama banyak concurrent requests seperti Express implementation tanpa error atau timeout.

**Validates: Requirements 17.5**

### Property 34: Security Headers Present

*For any* HTTP response, response harus include security headers (X-Frame-Options, X-Content-Type-Options, etc.) yang di-set oleh helmet middleware.

**Validates: Requirements 18.1**

### Property 35: Input Validation

*For any* API endpoint dengan validation rules, invalid input harus rejected dengan 400 status code dan validation error details.

**Validates: Requirements 18.2**

### Property 36: Input Sanitization

*For any* user input yang potentially malicious (SQL injection, XSS), input harus di-sanitize sebelum processing atau storage.

**Validates: Requirements 18.3**

### Property 37: Authentication Attempt Logging

*For any* authentication attempt (success atau failure), attempt harus di-log dengan timestamp, API key (hashed), dan result.

**Validates: Requirements 18.5**

### Property 38: Rate Limiting

*For any* client yang mengirim excessive requests, requests harus di-rate limit setelah threshold tercapai dengan 429 status code.

**Validates: Requirements 18.6**


## Error Handling

### Error Handling Strategy

NestJS backend akan menggunakan layered error handling approach dengan exception filters, custom exceptions, dan structured error responses.

### Exception Hierarchy

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Specific error types
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

export class GitHubError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 502, 'GITHUB_ERROR', details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ReviewError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'REVIEW_ERROR', details);
  }
}
```

### Global Exception Filter

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = 500;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let details = undefined;
    
    if (exception instanceof AppError) {
      status = exception.statusCode;
      message = exception.message;
      errorCode = exception.errorCode;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
      errorCode = 'HTTP_ERROR';
    }
    
    // Log error with stack trace
    this.logger.error(
      `${request.method} ${request.url} - ${message}`,
      exception instanceof Error ? exception.stack : undefined
    );
    
    // Send structured error response
    response.status(status).json({
      statusCode: status,
      errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

### Error Handling Patterns

#### 1. Service Layer Error Handling

Services throw specific AppError subclasses:

```typescript
@Injectable()
export class ReviewEngineService {
  async reviewPullRequest(prNumber: number): Promise<ReviewResult> {
    try {
      // Clone repository
      const repoPath = await this.githubClient.cloneRepository(repo, branch);
    } catch (error) {
      throw new GitHubError('Failed to clone repository', { prNumber, error: error.message });
    }
    
    try {
      // Execute AI review
      const output = await this.aiExecutor.executeReview(executor, context);
    } catch (error) {
      throw new ReviewError('AI review execution failed', { prNumber, executor, error: error.message });
    }
    
    // ... rest of implementation
  }
}
```

#### 2. Controller Layer Error Handling

Controllers let errors bubble up to global exception filter:

```typescript
@Controller('api/reviews')
export class ReviewController {
  @Post()
  async createReview(@Body() dto: CreateReviewDto): Promise<Review> {
    // Validation errors thrown by ValidationPipe
    // Service errors bubble up to GlobalExceptionFilter
    return this.reviewEngine.reviewPullRequest(dto.prNumber);
  }
}
```

#### 3. Database Error Handling

Database operations wrap SQLite errors:

```typescript
@Injectable()
export class DatabaseManagerService {
  prepare(sql: string): Database.Statement {
    try {
      return this.db.prepare(sql);
    } catch (error) {
      throw new DatabaseError('Failed to prepare statement', { sql, error: error.message });
    }
  }
  
  transaction<T>(fn: () => T): T {
    try {
      return this.db.transaction(fn)();
    } catch (error) {
      // Transaction automatically rolled back by better-sqlite3
      throw new DatabaseError('Transaction failed', { error: error.message });
    }
  }
}
```

#### 4. WebSocket Error Handling

WebSocket gateway handles errors gracefully:

```typescript
@WebSocketGateway()
export class ReviewGateway {
  @SubscribeMessage('review:start')
  handleReviewStart(@MessageBody() data: any): void {
    try {
      // Process message
    } catch (error) {
      this.logger.error('WebSocket error', error);
      this.server.emit('error', {
        message: 'Failed to process message',
        details: error.message,
      });
    }
  }
}
```

### Error Recovery Strategies

#### 1. Retry Logic

Untuk transient errors (network issues, temporary GitHub API failures):

```typescript
async executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}
```

#### 2. Graceful Degradation

Jika AI executor gagal, fallback ke executor lain:

```typescript
async executeReview(context: ReviewContext): Promise<ReviewOutput> {
  const executors = [this.config.primaryExecutor, ...this.config.fallbackExecutors];
  
  for (const executor of executors) {
    try {
      return await this.executeWithExecutor(executor, context);
    } catch (error) {
      this.logger.warn(`Executor ${executor} failed, trying next`, error);
    }
  }
  
  throw new ReviewError('All executors failed');
}
```

#### 3. Circuit Breaker

Untuk external services yang frequently fail:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}
```

### Error Monitoring

#### 1. Error Metrics

Track error rates dan patterns:

```typescript
@Injectable()
export class ErrorMetricsService {
  private errorCounts = new Map<string, number>();
  
  recordError(errorCode: string): void {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);
  }
  
  getErrorMetrics(): ErrorMetrics {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      errorsByCode: Object.fromEntries(this.errorCounts),
    };
  }
}
```

#### 2. Error Notifications

Send notifications untuk critical errors:

```typescript
async notifyError(error: AppError): void {
  if (error.statusCode >= 500) {
    await this.notifier.notify({
      title: 'Backend Error',
      message: error.message,
      sound: true,
    });
  }
}
```

## Testing Strategy

### Testing Approach

Backend akan menggunakan dual testing approach dengan kombinasi unit tests dan property-based tests untuk comprehensive coverage.

### Testing Framework

- **Unit & Integration Tests**: Vitest (kompatibel dengan existing test suite)
- **Property-Based Tests**: fast-check library
- **E2E Tests**: Supertest untuk HTTP endpoints
- **Mocking**: NestJS testing utilities

### Test Organization

```
tests/
├── unit/                    # Unit tests untuk individual services
│   ├── database.test.ts
│   ├── review-engine.test.ts
│   ├── ai-executor.test.ts
│   └── github-client.test.ts
├── integration/             # Integration tests untuk module interactions
│   ├── review-flow.test.ts
│   ├── api-endpoints.test.ts
│   └── websocket.test.ts
├── property/                # Property-based tests
│   ├── database-properties.test.ts
│   ├── api-properties.test.ts
│   └── review-properties.test.ts
├── e2e/                     # End-to-end tests
│   ├── full-review-cycle.test.ts
│   └── electron-integration.test.ts
└── fixtures/                # Test data dan mocks
    ├── mock-prs.ts
    ├── mock-reviews.ts
    └── test-repositories/
```

### Unit Testing

Unit tests fokus pada specific examples, edge cases, dan error conditions.

#### Example: TypeORM Repository Unit Test

```typescript
describe('ReviewService', () => {
  let service: ReviewService;
  let reviewRepository: Repository<Review>;
  let module: TestingModule;
  
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Review, Comment, ReviewMetrics],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Review, Comment, ReviewMetrics]),
      ],
      providers: [ReviewService],
    }).compile();
    
    service = module.get<ReviewService>(ReviewService);
    reviewRepository = module.get('ReviewRepository');
  });
  
  afterEach(async () => {
    await module.close();
  });
  
  it('should create review', async () => {
    const dto = {
      prNumber: 123,
      repository: 'test/repo',
      status: 'pending',
      mode: 'comment',
      executor: 'gemini',
    };
    
    const review = await service.createReview(dto);
    
    expect(review.id).toBeDefined();
    expect(review.prNumber).toBe(123);
  });
  
  it('should rollback transaction on error', async () => {
    const dto = { prNumber: 123, repository: 'test/repo' };
    
    // Mock error during transaction
    jest.spyOn(reviewRepository, 'save').mockRejectedValueOnce(new Error('DB error'));
    
    await expect(service.reviewWithTransaction(dto)).rejects.toThrow();
    
    // Verify rollback - no review should exist
    const reviews = await reviewRepository.find();
    expect(reviews).toHaveLength(0);
  });
  
  it('should load relations', async () => {
    const review = await service.createReview({
      prNumber: 123,
      repository: 'test/repo',
    });
    
    const loaded = await service.findReviewById(review.id);
    
    expect(loaded.comments).toBeDefined();
    expect(loaded.metrics).toBeDefined();
  });
});
```

#### Example: ReviewEngineService Unit Test

```typescript
describe('ReviewEngineService', () => {
  let service: ReviewEngineService;
  let mockGithubClient: jest.Mocked<GitHubClientService>;
  let mockAiExecutor: jest.Mocked<AiExecutorService>;
  
  beforeEach(() => {
    mockGithubClient = createMock<GitHubClientService>();
    mockAiExecutor = createMock<AiExecutorService>();
    service = new ReviewEngineService(mockGithubClient, mockAiExecutor, ...);
  });
  
  it('should clone repository before review', async () => {
    mockGithubClient.cloneRepository.mockResolvedValue('/tmp/repo');
    mockAiExecutor.executeReview.mockResolvedValue({ comments: [] });
    
    await service.reviewPullRequest(123);
    
    expect(mockGithubClient.cloneRepository).toHaveBeenCalled();
  });
  
  it('should post comments in comment mode', async () => {
    const comments = [{ file: 'test.js', line: 10, message: 'Issue' }];
    mockAiExecutor.executeReview.mockResolvedValue({ comments });
    
    await service.reviewPullRequest(123, { mode: 'comment' });
    
    expect(mockGithubClient.postComment).toHaveBeenCalledWith(123, comments[0]);
  });
  
  it('should throw ReviewError on AI executor failure', async () => {
    mockAiExecutor.executeReview.mockRejectedValue(new Error('AI failed'));
    
    await expect(service.reviewPullRequest(123)).rejects.toThrow(ReviewError);
  });
});
```

### Property-Based Testing

Property tests verify universal properties across many generated inputs. Setiap property test harus run minimal 100 iterations.

#### Example: Database Properties

```typescript
import fc from 'fast-check';

describe('Database Properties', () => {
  let service: DatabaseManagerService;
  
  beforeEach(() => {
    service = createTestDatabaseManager();
  });
  
  /**
   * Feature: nestjs-backend-refactor, Property 1: Database Operations Synchronous
   * For any database operation, the operation should return results directly without returning a Promise
   */
  it('property: all database operations are synchronous', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          title: fc.string(),
          author: fc.string(),
        }),
        (pr) => {
          const result = service.prepare('INSERT INTO pull_requests (id, title, author) VALUES (?, ?, ?)')
            .run(pr.id, pr.title, pr.author);
          
          // Should not be a Promise
          expect(result).not.toBeInstanceOf(Promise);
          expect(typeof result).toBe('object');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: nestjs-backend-refactor, Property 3: Database Transactions Rollback
   * For any database transaction that errors, all operations must be rolled back
   */
  it('property: transactions rollback on error', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.string(), title: fc.string() })),
        (reviews) => {
          const initialCount = service.prepare('SELECT COUNT(*) as count FROM reviews').get().count;
          
          try {
            service.transaction(() => {
              reviews.forEach(review => {
                service.prepare('INSERT INTO reviews (id, title) VALUES (?, ?)').run(review.id, review.title);
              });
              throw new Error('Rollback test');
            });
          } catch (e) {
            // Expected
          }
          
          const finalCount = service.prepare('SELECT COUNT(*) as count FROM reviews').get().count;
          expect(finalCount).toBe(initialCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Example: API Properties

```typescript
describe('API Properties', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = module.createNestApplication();
    await app.init();
  });
  
  /**
   * Feature: nestjs-backend-refactor, Property 5: CORS Headers Present
   * For any HTTP response, response must include CORS headers
   */
  it('property: all responses include CORS headers', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('/api/prs', '/api/reviews', '/api/metrics', '/health'),
        async (endpoint) => {
          const response = await request(app.getHttpServer()).get(endpoint);
          
          expect(response.headers['access-control-allow-origin']).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: nestjs-backend-refactor, Property 7: API Key Authentication
   * For any protected endpoint, valid API key succeeds and invalid fails
   */
  it('property: API key authentication works correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          endpoint: fc.constantFrom('/api/prs', '/api/reviews'),
          apiKey: fc.string(),
        }),
        async ({ endpoint, apiKey }) => {
          const validKey = process.env.API_KEY;
          const response = await request(app.getHttpServer())
            .get(endpoint)
            .set('X-API-Key', apiKey);
          
          if (apiKey === validKey) {
            expect(response.status).not.toBe(401);
          } else {
            expect(response.status).toBe(401);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: nestjs-backend-refactor, Property 35: Input Validation
   * For any endpoint with validation rules, invalid input is rejected
   */
  it('property: invalid input is rejected with 400', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          prNumber: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          mode: fc.string(),
        }),
        async (invalidDto) => {
          const response = await request(app.getHttpServer())
            .post('/api/reviews')
            .send(invalidDto);
          
          if (typeof invalidDto.prNumber !== 'number' || !['comment', 'auto-fix'].includes(invalidDto.mode)) {
            expect(response.status).toBe(400);
            expect(response.body.errorCode).toBe('VALIDATION_ERROR');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Example: Review Engine Properties

```typescript
describe('Review Engine Properties', () => {
  /**
   * Feature: nestjs-backend-refactor, Property 12: Review Completion Action
   * For any completed review, correct action is taken based on mode
   */
  it('property: review mode determines action', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          prNumber: fc.integer({ min: 1, max: 10000 }),
          mode: fc.constantFrom('comment', 'auto-fix'),
          comments: fc.array(fc.record({
            file: fc.string(),
            line: fc.integer({ min: 1 }),
            message: fc.string(),
          })),
        }),
        async ({ prNumber, mode, comments }) => {
          const mockGithub = createMock<GitHubClientService>();
          const mockAi = createMock<AiExecutorService>();
          mockAi.executeReview.mockResolvedValue({ comments });
          
          const service = new ReviewEngineService(mockGithub, mockAi, ...);
          await service.reviewPullRequest(prNumber, { mode });
          
          if (mode === 'comment') {
            expect(mockGithub.postComment).toHaveBeenCalled();
          } else {
            expect(mockGithub.applyAutoFix).toHaveBeenCalled();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests verify interactions between multiple modules.

```typescript
describe('Review Flow Integration', () => {
  let app: INestApplication;
  let dbManager: DatabaseManagerService;
  
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GitHubClientService)
      .useValue(createMockGitHubClient())
      .compile();
    
    app = module.createNestApplication();
    await app.init();
    
    dbManager = module.get(DatabaseManagerService);
  });
  
  it('should complete full review cycle', async () => {
    // 1. Trigger review via API
    const response = await request(app.getHttpServer())
      .post('/api/reviews')
      .send({ prNumber: 123, repository: 'test/repo', mode: 'comment' });
    
    expect(response.status).toBe(201);
    const reviewId = response.body.id;
    
    // 2. Verify review stored in database
    const review = dbManager.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
    expect(review).toBeDefined();
    expect(review.status).toBe('completed');
    
    // 3. Verify metrics collected
    const metrics = dbManager.prepare('SELECT * FROM metrics WHERE review_id = ?').get(reviewId);
    expect(metrics).toBeDefined();
    expect(metrics.health_score).toBeGreaterThan(0);
  });
});
```

### E2E Testing

E2E tests verify complete workflows including Electron integration.

```typescript
describe('Electron Integration E2E', () => {
  it('should auto-start backend when Electron opens', async () => {
    // Start Electron app
    const electronApp = await startElectronApp();
    
    // Wait for backend to be ready
    await waitForBackendReady('http://localhost:3000');
    
    // Verify health endpoint
    const response = await fetch('http://localhost:3000/health');
    expect(response.status).toBe(200);
    
    // Close Electron app
    await electronApp.close();
    
    // Verify backend stopped
    await expect(fetch('http://localhost:3000/health')).rejects.toThrow();
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 80%+ line coverage
- **Integration Tests**: Cover all critical user flows
- **Property Tests**: All 38 correctness properties implemented
- **E2E Tests**: Cover Electron integration dan full review cycle

### Test Database Isolation

Setiap test suite menggunakan separate test database:

```typescript
export function createTestDatabaseManager(): DatabaseManagerService {
  const testDbPath = path.join(__dirname, `test-${Date.now()}.db`);
  const service = new DatabaseManagerService({ dbPath: testDbPath });
  service.onModuleInit();
  
  // Cleanup after tests
  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });
  
  return service;
}
```

### Mocking Strategy

#### 1. External Services

Mock GitHub CLI dan AI executors:

```typescript
export function createMockGitHubClient(): Partial<GitHubClientService> {
  return {
    scanPullRequests: jest.fn().mockResolvedValue([]),
    cloneRepository: jest.fn().mockResolvedValue('/tmp/test-repo'),
    postComment: jest.fn().mockResolvedValue(undefined),
    autoMerge: jest.fn().mockResolvedValue(true),
  };
}

export function createMockAiExecutor(): Partial<AiExecutorService> {
  return {
    executeReview: jest.fn().mockResolvedValue({
      comments: [
        { file: 'test.js', line: 10, severity: 'warning', message: 'Test issue' }
      ],
    }),
    generateFix: jest.fn().mockResolvedValue('// Fixed code'),
  };
}
```

#### 2. NestJS Dependencies

Use NestJS testing utilities:

```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ReviewEngineService,
    {
      provide: GitHubClientService,
      useValue: createMockGitHubClient(),
    },
    {
      provide: AiExecutorService,
      useValue: createMockAiExecutor(),
    },
  ],
}).compile();
```

### Continuous Testing

- Tests run automatically on every commit via CI
- Property tests run with 100 iterations in CI, 1000 iterations nightly
- E2E tests run on PR creation
- Coverage reports generated dan tracked over time


## Integration Points

### Electron Integration

#### 1. Backend Auto-Start dari Electron Main Process

Electron main process (`electron/main.cjs`) akan spawn NestJS backend sebagai child process.

```javascript
// electron/main.cjs
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const waitOn = require('wait-on');

let backendProcess = null;

async function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // Development: run with ts-node
    backendProcess = spawn('npm', ['run', 'backend:dev'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
    });
  } else {
    // Production: run compiled JS
    const backendPath = path.join(process.resourcesPath, 'backend', 'main.js');
    backendProcess = spawn('node', [backendPath], {
      stdio: 'inherit',
    });
  }
  
  // Wait for backend to be ready
  try {
    await waitOn({
      resources: ['http://localhost:3000/health'],
      timeout: 10000,
      interval: 500,
    });
    console.log('Backend server ready');
  } catch (error) {
    console.error('Backend failed to start:', error);
    app.quit();
  }
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

app.on('ready', async () => {
  await startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});
```

#### 2. API Communication

Electron renderer process berkomunikasi dengan backend via HTTP dan WebSocket.

```javascript
// electron/api-client.cjs
const API_BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

class ApiClient {
  constructor() {
    this.apiKey = process.env.API_KEY;
    this.ws = null;
  }
  
  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  connectWebSocket(handlers) {
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      console.log('WebSocket connected');
    });
    
    this.ws.on('message', (data) => {
      const event = JSON.parse(data);
      const handler = handlers[event.type];
      if (handler) {
        handler(event.payload);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    this.ws.on('close', () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => this.connectWebSocket(handlers), 3000);
    });
  }
  
  // API methods
  async getPullRequests(query = {}) {
    const params = new URLSearchParams(query);
    return this.request(`/prs?${params}`);
  }
  
  async getReviews(query = {}) {
    const params = new URLSearchParams(query);
    return this.request(`/reviews?${params}`);
  }
  
  async triggerReview(prNumber, options = {}) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify({ prNumber, ...options }),
    });
  }
  
  async getMetrics() {
    return this.request('/metrics/overview');
  }
}

module.exports = new ApiClient();
```

#### 3. IPC Bridge (Preload Script)

Preload script menyediakan safe API untuk renderer process.

```javascript
// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Backend API calls
  getPullRequests: (query) => ipcRenderer.invoke('api:getPullRequests', query),
  getReviews: (query) => ipcRenderer.invoke('api:getReviews', query),
  triggerReview: (prNumber, options) => ipcRenderer.invoke('api:triggerReview', prNumber, options),
  getMetrics: () => ipcRenderer.invoke('api:getMetrics'),
  
  // WebSocket events
  onReviewStart: (callback) => ipcRenderer.on('review:start', (_, data) => callback(data)),
  onReviewProgress: (callback) => ipcRenderer.on('review:progress', (_, data) => callback(data)),
  onReviewComplete: (callback) => ipcRenderer.on('review:complete', (_, data) => callback(data)),
  onReviewError: (callback) => ipcRenderer.on('review:error', (_, data) => callback(data)),
});
```

### External Service Integration

#### 1. GitHub CLI Integration

```typescript
// src/github/github-client.service.ts
import { Injectable } from '@nestjs/common';
import { execa } from 'execa';

@Injectable()
export class GitHubClientService {
  async scanPullRequests(scope: ScanScope): Promise<PullRequest[]> {
    const scopeFlag = this.getScopeFlag(scope);
    const { stdout } = await execa('gh', [
      'pr', 'list',
      scopeFlag,
      '--json', 'number,title,author,headRefName,baseRefName,state,createdAt,updatedAt,url,isDraft,labels',
    ]);
    
    return JSON.parse(stdout);
  }
  
  async cloneRepository(repo: string, branch: string): Promise<string> {
    const workspacePath = path.join(process.cwd(), 'workspace', repo.replace('/', '-'));
    
    if (!fs.existsSync(workspacePath)) {
      await execa('gh', ['repo', 'clone', repo, workspacePath]);
    }
    
    await execa('git', ['checkout', branch], { cwd: workspacePath });
    await execa('git', ['pull'], { cwd: workspacePath });
    
    return workspacePath;
  }
  
  async postComment(pr: number, comment: Comment): Promise<void> {
    const body = this.formatComment(comment);
    await execa('gh', ['pr', 'comment', pr.toString(), '--body', body]);
  }
  
  private getScopeFlag(scope: ScanScope): string {
    switch (scope) {
      case 'authored': return '--author=@me';
      case 'assigned': return '--assignee=@me';
      case 'review-requested': return '--search="review-requested:@me"';
      default: return '';
    }
  }
}
```

#### 2. AI Executor Integration

```typescript
// src/ai/ai-executor.service.ts
import { Injectable } from '@nestjs/common';
import { execa } from 'execa';

interface AiExecutor {
  name: string;
  command: string;
  args: (context: ReviewContext) => string[];
}

@Injectable()
export class AiExecutorService {
  private executors: Map<string, AiExecutor> = new Map([
    ['gemini', {
      name: 'Gemini',
      command: 'gemini',
      args: (ctx) => ['review', ctx.repoPath, '--pr', ctx.prNumber.toString()],
    }],
    ['copilot', {
      name: 'GitHub Copilot',
      command: 'gh',
      args: (ctx) => ['copilot', 'review', ctx.repoPath],
    }],
    ['kiro', {
      name: 'Kiro',
      command: 'kiro',
      args: (ctx) => ['review', ctx.repoPath, '--pr', ctx.prNumber.toString()],
    }],
    // ... other executors
  ]);
  
  async executeReview(executorName: string, context: ReviewContext): Promise<ReviewOutput> {
    const executor = this.executors.get(executorName);
    if (!executor) {
      throw new ReviewError(`Unknown executor: ${executorName}`);
    }
    
    try {
      const { stdout } = await execa(executor.command, executor.args(context), {
        cwd: context.repoPath,
        timeout: 300000, // 5 minutes
      });
      
      return this.parseOutput(stdout);
    } catch (error) {
      throw new ReviewError(`Executor ${executorName} failed`, { error: error.message });
    }
  }
  
  private parseOutput(output: string): ReviewOutput {
    // Parse AI output into structured comments
    const comments = this.commentParser.parse(output);
    return { comments };
  }
}
```

### Database Integration

#### 1. TypeORM Module Setup

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PullRequest } from './database/entities/pull-request.entity';
import { Review } from './database/entities/review.entity';
import { Comment } from './database/entities/comment.entity';
import { ReviewMetrics } from './database/entities/review-metrics.entity';
import { RepositoryConfig } from './database/entities/repository-config.entity';
import { DeveloperMetrics } from './database/entities/developer-metrics.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get('DB_PATH', 'data/pr-review.db'),
        entities: [
          PullRequest,
          Review,
          Comment,
          ReviewMetrics,
          RepositoryConfig,
          DeveloperMetrics,
        ],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DB_LOGGING', false),
      }),
      inject: [ConfigService],
    }),
    // Feature modules
  ],
})
export class AppModule {}
```

#### 2. Repository Usage in Services

```typescript
// src/review/review.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from '../database/entities/review.entity';
import { Comment } from '../database/entities/comment.entity';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    private dataSource: DataSource,
  ) {}
  
  async createReview(dto: CreateReviewDto): Promise<Review> {
    const review = this.reviewRepository.create(dto);
    return this.reviewRepository.save(review);
  }
  
  async findReviewById(id: string): Promise<Review> {
    return this.reviewRepository.findOne({
      where: { id },
      relations: ['comments', 'metrics', 'pullRequest'],
    });
  }
  
  async findReviewsByPr(prNumber: number): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { prNumber },
      relations: ['comments', 'metrics'],
      order: { startedAt: 'DESC' },
    });
  }
  
  async updateReviewStatus(id: string, status: string): Promise<Review> {
    await this.reviewRepository.update(id, { status });
    return this.findReviewById(id);
  }
  
  // Transaction example
  async reviewWithTransaction(dto: CreateReviewDto): Promise<Review> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      const review = queryRunner.manager.create(Review, dto);
      await queryRunner.manager.save(review);
      
      // More operations...
      
      await queryRunner.commitTransaction();
      return review;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

#### 3. Feature Module with Repository

```typescript
// src/review/review.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '../database/entities/review.entity';
import { Comment } from '../database/entities/comment.entity';
import { ReviewMetrics } from '../database/entities/review-metrics.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Comment, ReviewMetrics]),
  ],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
```

### WebSocket Integration

#### 1. WebSocket Gateway

```typescript
// src/websocket/review.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';

@WebSocketGateway()
export class ReviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private readonly logger = new Logger(ReviewGateway.name);
  private clients: Set<WebSocket> = new Set();
  
  handleConnection(client: WebSocket) {
    this.clients.add(client);
    this.logger.log(`Client connected. Total clients: ${this.clients.size}`);
  }
  
  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
    this.logger.log(`Client disconnected. Total clients: ${this.clients.size}`);
  }
  
  broadcastReviewStart(pr: number, repository: string): void {
    this.broadcast('review:start', { pr, repository, timestamp: new Date() });
  }
  
  broadcastReviewProgress(pr: number, progress: number, message: string): void {
    this.broadcast('review:progress', { pr, progress, message, timestamp: new Date() });
  }
  
  broadcastReviewComplete(pr: number, result: ReviewResult): void {
    this.broadcast('review:complete', { pr, result, timestamp: new Date() });
  }
  
  broadcastReviewError(pr: number, error: string): void {
    this.broadcast('review:error', { pr, error, timestamp: new Date() });
  }
  
  broadcastMetricsUpdate(metrics: MetricsUpdate): void {
    this.broadcast('metrics:update', { metrics, timestamp: new Date() });
  }
  
  private broadcast(type: string, payload: any): void {
    const message = JSON.stringify({ type, payload });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
```

## Build and Deployment Architecture

### Development Setup

#### 1. Package.json Scripts

```json
{
  "scripts": {
    "backend:dev": "nest start --watch",
    "backend:build": "nest build",
    "backend:start": "node dist/main.js",
    "backend:test": "vitest",
    "backend:test:watch": "vitest --watch",
    
    "electron:dev": "concurrently \"npm run backend:dev\" \"wait-on http://localhost:3000/health && electron .\"",
    "electron:build": "npm run backend:build && electron-builder",
    
    "ui:dev": "vite",
    "ui:build": "vite build",
    
    "app:dev": "concurrently \"npm run ui:dev\" \"npm run electron:dev\"",
    "app:build": "npm run ui:build && npm run backend:build && electron-builder",
    
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

#### 2. NestJS Configuration

```typescript
// nest-cli.json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      "database/**/*.sql"
    ],
    "watchAssets": true
  }
}
```

#### 3. TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": false,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

### Production Build

#### 1. Backend Build Process

```bash
# Compile TypeScript to JavaScript
npm run backend:build

# Output structure:
dist/
├── main.js                 # Entry point
├── main.js.map
├── modules/
│   ├── review/
│   ├── github/
│   ├── ai/
│   └── ...
└── database/
    └── schema.sql          # Copied from src
```

#### 2. Electron Builder Configuration

```json
// electron-builder.json
{
  "appId": "com.prreview.agent",
  "productName": "PR Review Agent",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "electron/**/*",
    "dist/**/*",
    "data/",
    "database/",
    "context/",
    "node_modules/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "dist",
      "to": "backend",
      "filter": ["**/*"]
    },
    {
      "from": "database",
      "to": "database",
      "filter": ["**/*"]
    }
  ],
  "win": {
    "target": ["nsis"],
    "icon": "build/icon.ico"
  },
  "mac": {
    "target": ["dmg"],
    "icon": "build/icon.icns"
  },
  "linux": {
    "target": ["AppImage"],
    "icon": "build/icon.png"
  }
}
```

#### 3. Production Entry Point

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  // Global middleware
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());
  
  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  
  console.log(`Backend server running on http://localhost:${port}`);
}

bootstrap();
```

### Deployment Modes

#### 1. Standalone Mode

Backend dapat dijalankan sebagai standalone server untuk development atau testing:

```bash
# Development
npm run backend:dev

# Production
npm run backend:build
npm run backend:start
```

#### 2. Embedded Mode (Electron)

Backend di-bundle dengan Electron app dan auto-start:

```bash
# Development
npm run app:dev

# Production build
npm run app:build

# Distributable output:
release/
├── PR Review Agent-1.0.0.exe        # Windows
├── PR Review Agent-1.0.0.dmg        # macOS
└── PR Review Agent-1.0.0.AppImage   # Linux
```

### Migration Strategy

#### Phase 1: Setup dan Infrastructure (Week 1-2)

1. **Setup NestJS Project**
   - Initialize NestJS project dengan CLI
   - Configure TypeScript, ESLint, Prettier
   - Setup folder structure sesuai NestJS conventions

2. **TypeORM Module Setup**
   - Install TypeORM dan SQLite driver (`@nestjs/typeorm`, `typeorm`, `sqlite3`)
   - Configure TypeOrmModule dengan SQLite
   - Create entity classes untuk semua tables
   - Test entity creation dan schema synchronization
   - Write unit tests untuk repository operations

3. **Configuration Module**
   - Implement ConfigModule dengan @nestjs/config
   - Migrate environment variables
   - Implement repository-specific overrides
   - Write tests untuk config loading dan validation

#### Phase 2: Core Services Migration (Week 3-4)

4. **Logger Module**
   - Implement custom logger dengan daily rotation
   - Maintain log format compatibility
   - Write tests untuk logging functionality

5. **GitHub Client Service**
   - Migrate github-client.js ke GitHubClientService
   - Implement PR scanning, cloning, comment posting
   - Write unit tests dengan mocked gh CLI
   - Write property tests untuk scanning scopes

6. **AI Executor Service**
   - Migrate ai-executors.js ke AiExecutorService
   - Implement strategy pattern untuk multiple executors
   - Write tests untuk executor selection dan output parsing

#### Phase 3: Review Engine Migration (Week 5-6)

7. **Review Engine Service**
   - Migrate review-engine.js ke ReviewEngineService
   - Implement review orchestration dengan DI dan TypeORM repositories
   - Integrate dengan GitHub, AI, Database services
   - Implement transaction support dengan QueryRunner
   - Write integration tests untuk full review flow

8. **Comment Parser Service**
   - Migrate comment-parser.js ke CommentParserService
   - Write property tests untuk parsing logic

9. **Checklist Manager Service**
   - Migrate checklist-manager.js ke ChecklistService
   - Write unit tests

#### Phase 4: API Layer Migration (Week 7-8)

10. **Controllers Implementation**
    - Migrate Express routes ke NestJS controllers
    - Implement DTOs dan validation pipes
    - Write API endpoint tests
    - Verify response format compatibility

11. **WebSocket Gateway**
    - Migrate websocket-server.js ke ReviewGateway
    - Implement event broadcasting
    - Write WebSocket integration tests
    - Verify event format compatibility

12. **Guards dan Interceptors**
    - Implement ApiKeyGuard
    - Implement LoggingInterceptor
    - Implement ErrorInterceptor
    - Write tests untuk middleware

#### Phase 5: Additional Services (Week 9-10)

13. **Metrics Services**
    - Migrate metrics-collector.js, health-score-calculator.js, quality-scorer.js
    - Write tests untuk score calculations

14. **Security Services**
    - Migrate security-scanner.js, dependency-scanner.js
    - Implement input validation dan sanitization
    - Write security tests

15. **Team Services**
    - Migrate developer-dashboard.js, assignment-engine.js, capacity-planner.js
    - Write tests

#### Phase 6: Electron Integration (Week 11-12)

16. **Auto-Start Implementation**
    - Update electron/main.cjs untuk spawn NestJS backend
    - Implement health check waiting
    - Implement graceful shutdown
    - Write E2E tests untuk Electron integration

17. **API Client Update**
    - Update electron/api-client.cjs untuk NestJS endpoints
    - Verify all API calls work correctly
    - Test WebSocket reconnection

#### Phase 7: Testing dan Validation (Week 13-14)

18. **Comprehensive Testing**
    - Run all unit tests (target: 80%+ coverage)
    - Run all property tests (100 iterations minimum) - 3 TypeORM properties
    - Run integration tests
    - Run E2E tests dengan Electron

19. **Performance Testing**
    - Measure startup time (< 5 seconds)
    - Measure API response times (< 200ms)
    - Measure WebSocket latency (< 100ms)
    - Measure memory usage (< 150% of Express baseline)
    - Load test concurrent requests

20. **Compatibility Validation**
    - Verify all API endpoints work identically
    - Verify WebSocket events match format
    - Verify Electron app functionality unchanged
    - Test fresh database creation dengan TypeORM entities

#### Phase 8: Documentation dan Deployment (Week 15-16)

21. **Documentation**
    - Update README dengan NestJS setup instructions
    - Write migration guide untuk developers
    - Document new architecture dan patterns
    - Update API documentation

22. **Build dan Release**
    - Configure production build
    - Test electron-builder packaging
    - Create release builds untuk Windows, macOS, Linux
    - Deploy dan verify

### Rollback Strategy

Jika migration mengalami critical issues:

1. **Feature Flags**: Use feature flags untuk switch antara Express dan NestJS
2. **Parallel Running**: Run Express dan NestJS side-by-side untuk comparison
3. **Git Branches**: Maintain Express implementation di separate branch
4. **Gradual Rollout**: Deploy ke subset users dulu sebelum full rollout
5. **Fresh Start**: Karena menggunakan TypeORM dengan fresh schema, rollback hanya perlu switch ke Express branch

### Success Criteria

Migration dianggap sukses jika:

1. ✅ Semua 38 correctness properties pass (3 TypeORM-specific + 35 general)
2. ✅ Test coverage ≥ 80%
3. ✅ Startup time < 5 seconds
4. ✅ API response time < 200ms
5. ✅ WebSocket latency < 100ms
6. ✅ Memory usage ≤ 150% of Express baseline
7. ✅ Zero breaking changes untuk Electron app
8. ✅ All existing features work identically
9. ✅ Production builds successful untuk all platforms
10. ✅ E2E tests pass dengan Electron integration
11. ✅ TypeORM entities auto-create database schema correctly
12. ✅ Fresh database dapat dibuat tanpa manual SQL scripts

