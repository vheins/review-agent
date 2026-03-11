import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../src/database/database.module.js';
import {
  PullRequest,
  Review,
  Comment,
  ReviewMetrics,
  RepositoryConfig,
  DeveloperMetrics,
} from '../src/database/entities/index.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * TypeORM Database Configuration and Entity Tests
 * 
 * Tests verify that:
 * - TypeORM is properly configured with SQLite
 * - All entities can be created and saved
 * - Relations between entities work correctly (eager and explicit loading)
 * - Schema auto-sync creates all tables
 * - Basic CRUD operations work for all entities
 * 
 * Requirements: 2.1, 2.3, 2.4, 2.6
 */
describe('TypeORM Database Configuration', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let prRepository: Repository<PullRequest>;
  let reviewRepository: Repository<Review>;
  let commentRepository: Repository<Comment>;
  let metricsRepository: Repository<ReviewMetrics>;
  let configRepository: Repository<RepositoryConfig>;
  let developerRepository: Repository<DeveloperMetrics>;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-pr-review.db');

  beforeEach(async () => {
    // Clean up test database
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }

    // Create test module with all entities
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: testDbPath,
          entities: [
            PullRequest,
            Review,
            Comment,
            ReviewMetrics,
            RepositoryConfig,
            DeveloperMetrics,
          ],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([
          PullRequest,
          Review,
          Comment,
          ReviewMetrics,
          RepositoryConfig,
          DeveloperMetrics,
        ]),
      ],
    }).compile();

    dataSource = module.get(DataSource);
    prRepository = module.get('PullRequestRepository');
    reviewRepository = module.get('ReviewRepository');
    commentRepository = module.get('CommentRepository');
    metricsRepository = module.get('ReviewMetricsRepository');
    configRepository = module.get('RepositoryConfigRepository');
    developerRepository = module.get('DeveloperMetricsRepository');
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    // Clean up test database
    if (await fs.pathExists(testDbPath)) {
      await fs.remove(testDbPath);
    }
  });

  describe('Repository Injection', () => {
    it('should inject all repositories', () => {
      expect(prRepository).toBeDefined();
      expect(prRepository).toBeInstanceOf(Repository);
      expect(reviewRepository).toBeDefined();
      expect(reviewRepository).toBeInstanceOf(Repository);
      expect(commentRepository).toBeDefined();
      expect(commentRepository).toBeInstanceOf(Repository);
      expect(metricsRepository).toBeDefined();
      expect(metricsRepository).toBeInstanceOf(Repository);
      expect(configRepository).toBeDefined();
      expect(configRepository).toBeInstanceOf(Repository);
      expect(developerRepository).toBeDefined();
      expect(developerRepository).toBeInstanceOf(Repository);
    });
  });

  describe('Schema Auto-Sync', () => {
    it('should create all tables via schema synchronization', async () => {
      // Query SQLite master table to check if all tables exist
      const tables = await dataSource.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map((t: any) => t.name);
      
      expect(tableNames).toContain('pull_requests');
      expect(tableNames).toContain('reviews');
      expect(tableNames).toContain('comments');
      expect(tableNames).toContain('review_metrics');
      expect(tableNames).toContain('repository_configs');
      expect(tableNames).toContain('developer_metrics');
    });
  });

  describe('PullRequest Entity CRUD', () => {
    it('should create and save a pull request entity', async () => {
      const pr = prRepository.create({
        number: 123,
        title: 'Test PR',
        author: 'testuser',
        repository: 'test/repo',
        branch: 'feature/test',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo/pull/123',
        isDraft: false,
        labels: ['bug', 'enhancement'],
      });

      const saved = await prRepository.save(pr);

      expect(saved).toBeDefined();
      expect(saved.number).toBe(123);
      expect(saved.title).toBe('Test PR');
      expect(saved.labels).toEqual(['bug', 'enhancement']);
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should find a pull request by number', async () => {
      const pr = prRepository.create({
        number: 456,
        title: 'Another Test PR',
        author: 'testuser2',
        repository: 'test/repo2',
        branch: 'feature/test2',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo2/pull/456',
        isDraft: true,
        labels: [],
      });
      await prRepository.save(pr);

      const found = await prRepository.findOne({ where: { number: 456 } });

      expect(found).toBeDefined();
      expect(found?.number).toBe(456);
      expect(found?.title).toBe('Another Test PR');
      expect(found?.isDraft).toBe(true);
    });

    it('should update a pull request', async () => {
      const pr = prRepository.create({
        number: 789,
        title: 'Update Test PR',
        author: 'testuser3',
        repository: 'test/repo3',
        branch: 'feature/test3',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo3/pull/789',
        isDraft: false,
        labels: ['wip'],
      });
      await prRepository.save(pr);

      await prRepository.update({ number: 789 }, { status: 'closed', isDraft: true });

      const updated = await prRepository.findOne({ where: { number: 789 } });
      expect(updated?.status).toBe('closed');
      expect(updated?.isDraft).toBe(true);
    });

    it('should delete a pull request', async () => {
      const pr = prRepository.create({
        number: 999,
        title: 'Delete Test PR',
        author: 'testuser4',
        repository: 'test/repo4',
        branch: 'feature/test4',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo4/pull/999',
        isDraft: false,
        labels: [],
      });
      await prRepository.save(pr);

      await prRepository.delete({ number: 999 });

      const deleted = await prRepository.findOne({ where: { number: 999 } });
      expect(deleted).toBeNull();
    });
  });

  describe('Review Entity CRUD', () => {
    it('should create and save a review entity', async () => {
      const review = reviewRepository.create({
        prNumber: 123,
        repository: 'test/repo',
        status: 'in_progress',
        mode: 'comment',
        executor: 'gemini',
      });

      const saved = await reviewRepository.save(review);

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.prNumber).toBe(123);
      expect(saved.status).toBe('in_progress');
      expect(saved.startedAt).toBeInstanceOf(Date);
      expect(saved.completedAt).toBeNull();
    });

    it('should update review status and completion time', async () => {
      const review = reviewRepository.create({
        prNumber: 456,
        repository: 'test/repo',
        status: 'in_progress',
        mode: 'auto-fix',
        executor: 'copilot',
      });
      const saved = await reviewRepository.save(review);

      const completedAt = new Date();
      await reviewRepository.update(
        { id: saved.id },
        { status: 'completed', completedAt }
      );

      const updated = await reviewRepository.findOne({ where: { id: saved.id } });
      expect(updated?.status).toBe('completed');
      expect(updated?.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('Comment Entity CRUD', () => {
    it('should create and save a comment entity', async () => {
      const review = reviewRepository.create({
        prNumber: 123,
        repository: 'test/repo',
        status: 'in_progress',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      const comment = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/index.ts',
        line: 42,
        severity: 'warning',
        category: 'bug',
        message: 'Potential null pointer exception',
        suggestion: 'Add null check before accessing property',
      });

      const saved = await commentRepository.save(comment);

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.reviewId).toBe(savedReview.id);
      expect(saved.file).toBe('src/index.ts');
      expect(saved.line).toBe(42);
    });

    it('should find comments by review id', async () => {
      const review = reviewRepository.create({
        prNumber: 789,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'kiro',
      });
      const savedReview = await reviewRepository.save(review);

      const comment1 = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/app.ts',
        line: 10,
        severity: 'error',
        category: 'security',
        message: 'SQL injection vulnerability',
        suggestion: 'Use parameterized queries',
      });

      const comment2 = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/utils.ts',
        line: 25,
        severity: 'info',
        category: 'maintainability',
        message: 'Consider extracting this to a separate function',
        suggestion: null,
      });

      await commentRepository.save([comment1, comment2]);

      const comments = await commentRepository.find({
        where: { reviewId: savedReview.id },
      });

      expect(comments).toHaveLength(2);
      expect(comments[0].reviewId).toBe(savedReview.id);
      expect(comments[1].reviewId).toBe(savedReview.id);
    });
  });

  describe('ReviewMetrics Entity CRUD', () => {
    it('should create and save review metrics', async () => {
      const review = reviewRepository.create({
        prNumber: 111,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      const metrics = metricsRepository.create({
        reviewId: savedReview.id,
        duration: 45000,
        filesReviewed: 12,
        commentsGenerated: 8,
        issuesFound: {
          bugs: 2,
          security: 1,
          performance: 3,
          maintainability: 2,
          architecture: 0,
          testing: 0,
        },
        healthScore: 85.5,
        qualityScore: 78.3,
      });

      const saved = await metricsRepository.save(metrics);

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.reviewId).toBe(savedReview.id);
      expect(saved.duration).toBe(45000);
      expect(saved.issuesFound.bugs).toBe(2);
      expect(saved.healthScore).toBe(85.5);
    });
  });

  describe('RepositoryConfig Entity CRUD', () => {
    it('should create and save repository config', async () => {
      const config = configRepository.create({
        repository: 'test/repo',
        enabled: true,
        reviewMode: 'comment',
        executor: 'gemini',
        scanScope: 'authored',
        autoMerge: false,
        protectedBranches: ['main', 'develop'],
        excludePatterns: ['*.md', 'docs/*'],
        customPrompt: 'Focus on security issues',
        version: 1,
      });

      const saved = await configRepository.save(config);

      expect(saved).toBeDefined();
      expect(saved.repository).toBe('test/repo');
      expect(saved.enabled).toBe(true);
      expect(saved.protectedBranches).toEqual(['main', 'develop']);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should update repository config', async () => {
      const config = configRepository.create({
        repository: 'test/repo2',
        enabled: true,
        reviewMode: 'comment',
        executor: 'gemini',
        scanScope: 'all',
        autoMerge: false,
        protectedBranches: ['main'],
        excludePatterns: [],
        customPrompt: null,
        version: 1,
      });
      await configRepository.save(config);

      await configRepository.update(
        { repository: 'test/repo2' },
        { enabled: false, autoMerge: true, version: 2 }
      );

      const updated = await configRepository.findOne({
        where: { repository: 'test/repo2' },
      });
      expect(updated?.enabled).toBe(false);
      expect(updated?.autoMerge).toBe(true);
      expect(updated?.version).toBe(2);
    });
  });

  describe('DeveloperMetrics Entity CRUD', () => {
    it('should create and save developer metrics', async () => {
      const metrics = developerRepository.create({
        username: 'testdev',
        totalPrs: 50,
        reviewedPrs: 45,
        averageHealthScore: 82.5,
        averageQualityScore: 75.8,
        issuesFound: {
          bugs: 15,
          security: 8,
          performance: 12,
          maintainability: 20,
        },
        averageReviewTime: 3600000,
        lastReviewAt: new Date(),
      });

      const saved = await developerRepository.save(metrics);

      expect(saved).toBeDefined();
      expect(saved.username).toBe('testdev');
      expect(saved.totalPrs).toBe(50);
      expect(saved.issuesFound.bugs).toBe(15);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it('should update developer metrics', async () => {
      const metrics = developerRepository.create({
        username: 'testdev2',
        totalPrs: 10,
        reviewedPrs: 8,
        averageHealthScore: 80.0,
        averageQualityScore: 70.0,
        issuesFound: {
          bugs: 5,
          security: 2,
          performance: 3,
          maintainability: 4,
        },
        averageReviewTime: 2400000,
        lastReviewAt: null,
      });
      await developerRepository.save(metrics);

      await developerRepository.update(
        { username: 'testdev2' },
        { totalPrs: 11, reviewedPrs: 9 }
      );

      const updated = await developerRepository.findOne({
        where: { username: 'testdev2' },
      });
      expect(updated?.totalPrs).toBe(11);
      expect(updated?.reviewedPrs).toBe(9);
    });
  });

  describe('Entity Relations', () => {
    it('should load PullRequest with reviews relation explicitly', async () => {
      // Create PR
      const pr = prRepository.create({
        number: 100,
        title: 'Relations Test PR',
        author: 'testuser',
        repository: 'test/repo',
        branch: 'feature/relations',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo/pull/100',
        isDraft: false,
        labels: [],
      });
      await prRepository.save(pr);

      // Create reviews for this PR
      const review1 = reviewRepository.create({
        prNumber: 100,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const review2 = reviewRepository.create({
        prNumber: 100,
        repository: 'test/repo',
        status: 'in_progress',
        mode: 'auto-fix',
        executor: 'copilot',
      });
      await reviewRepository.save([review1, review2]);

      // Load PR with reviews relation
      const prWithReviews = await prRepository.findOne({
        where: { number: 100 },
        relations: ['reviews'],
      });

      expect(prWithReviews).toBeDefined();
      expect(prWithReviews?.reviews).toBeDefined();
      expect(prWithReviews?.reviews).toHaveLength(2);
      expect(prWithReviews?.reviews[0].prNumber).toBe(100);
    });

    it('should load Review with pullRequest relation explicitly', async () => {
      // Create PR
      const pr = prRepository.create({
        number: 200,
        title: 'Review Relations Test',
        author: 'testuser',
        repository: 'test/repo',
        branch: 'feature/test',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo/pull/200',
        isDraft: false,
        labels: [],
      });
      await prRepository.save(pr);

      // Create review
      const review = reviewRepository.create({
        prNumber: 200,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'kiro',
      });
      const savedReview = await reviewRepository.save(review);

      // Load review with PR relation
      const reviewWithPr = await reviewRepository.findOne({
        where: { id: savedReview.id },
        relations: ['pullRequest'],
      });

      expect(reviewWithPr).toBeDefined();
      expect(reviewWithPr?.pullRequest).toBeDefined();
      expect(reviewWithPr?.pullRequest?.number).toBe(200);
      expect(reviewWithPr?.pullRequest?.title).toBe('Review Relations Test');
    });

    it('should load Review with comments relation explicitly', async () => {
      // Create review
      const review = reviewRepository.create({
        prNumber: 300,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      // Create comments
      const comment1 = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/test1.ts',
        line: 10,
        severity: 'error',
        category: 'bug',
        message: 'Test comment 1',
        suggestion: null,
      });
      const comment2 = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/test2.ts',
        line: 20,
        severity: 'warning',
        category: 'performance',
        message: 'Test comment 2',
        suggestion: 'Optimize this',
      });
      await commentRepository.save([comment1, comment2]);

      // Load review with comments
      const reviewWithComments = await reviewRepository.findOne({
        where: { id: savedReview.id },
        relations: ['comments'],
      });

      expect(reviewWithComments).toBeDefined();
      expect(reviewWithComments?.comments).toBeDefined();
      expect(reviewWithComments?.comments).toHaveLength(2);
      expect(reviewWithComments?.comments[0].reviewId).toBe(savedReview.id);
    });

    it('should load Review with metrics relation explicitly', async () => {
      // Create review
      const review = reviewRepository.create({
        prNumber: 400,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      // Create metrics
      const metrics = metricsRepository.create({
        reviewId: savedReview.id,
        duration: 30000,
        filesReviewed: 5,
        commentsGenerated: 3,
        issuesFound: {
          bugs: 1,
          security: 0,
          performance: 1,
          maintainability: 1,
          architecture: 0,
          testing: 0,
        },
        healthScore: 90.0,
        qualityScore: 85.0,
      });
      await metricsRepository.save(metrics);

      // Load review with metrics
      const reviewWithMetrics = await reviewRepository.findOne({
        where: { id: savedReview.id },
        relations: ['metrics'],
      });

      expect(reviewWithMetrics).toBeDefined();
      expect(reviewWithMetrics?.metrics).toBeDefined();
      expect(reviewWithMetrics?.metrics.reviewId).toBe(savedReview.id);
      expect(reviewWithMetrics?.metrics.healthScore).toBe(90.0);
    });

    it('should load Comment with review relation explicitly', async () => {
      // Create review
      const review = reviewRepository.create({
        prNumber: 500,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'copilot',
      });
      const savedReview = await reviewRepository.save(review);

      // Create comment
      const comment = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/test.ts',
        line: 15,
        severity: 'info',
        category: 'maintainability',
        message: 'Consider refactoring',
        suggestion: null,
      });
      const savedComment = await commentRepository.save(comment);

      // Load comment with review
      const commentWithReview = await commentRepository.findOne({
        where: { id: savedComment.id },
        relations: ['review'],
      });

      expect(commentWithReview).toBeDefined();
      expect(commentWithReview?.review).toBeDefined();
      expect(commentWithReview?.review?.id).toBe(savedReview.id);
      expect(commentWithReview?.review?.prNumber).toBe(500);
    });

    it('should load ReviewMetrics with review relation explicitly', async () => {
      // Create review
      const review = reviewRepository.create({
        prNumber: 600,
        repository: 'test/repo',
        status: 'completed',
        mode: 'auto-fix',
        executor: 'kiro',
      });
      const savedReview = await reviewRepository.save(review);

      // Create metrics
      const metrics = metricsRepository.create({
        reviewId: savedReview.id,
        duration: 60000,
        filesReviewed: 8,
        commentsGenerated: 5,
        issuesFound: {
          bugs: 2,
          security: 1,
          performance: 1,
          maintainability: 1,
          architecture: 0,
          testing: 0,
        },
        healthScore: 75.0,
        qualityScore: 70.0,
      });
      const savedMetrics = await metricsRepository.save(metrics);

      // Load metrics with review
      const metricsWithReview = await metricsRepository.findOne({
        where: { id: savedMetrics.id },
        relations: ['review'],
      });

      expect(metricsWithReview).toBeDefined();
      expect(metricsWithReview?.review).toBeDefined();
      expect(metricsWithReview?.review?.id).toBe(savedReview.id);
      expect(metricsWithReview?.review?.executor).toBe('kiro');
    });

    it('should load nested relations (PR -> Review -> Comments)', async () => {
      // Create PR
      const pr = prRepository.create({
        number: 700,
        title: 'Nested Relations Test',
        author: 'testuser',
        repository: 'test/repo',
        branch: 'feature/nested',
        baseBranch: 'main',
        status: 'open',
        url: 'https://github.com/test/repo/pull/700',
        isDraft: false,
        labels: [],
      });
      await prRepository.save(pr);

      // Create review
      const review = reviewRepository.create({
        prNumber: 700,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      // Create comments
      const comment = commentRepository.create({
        reviewId: savedReview.id,
        file: 'src/nested.ts',
        line: 30,
        severity: 'warning',
        category: 'bug',
        message: 'Nested test comment',
        suggestion: null,
      });
      await commentRepository.save(comment);

      // Load PR with nested relations
      const prWithNested = await prRepository.findOne({
        where: { number: 700 },
        relations: ['reviews', 'reviews.comments'],
      });

      expect(prWithNested).toBeDefined();
      expect(prWithNested?.reviews).toBeDefined();
      expect(prWithNested?.reviews).toHaveLength(1);
      expect(prWithNested?.reviews[0].comments).toBeDefined();
      expect(prWithNested?.reviews[0].comments).toHaveLength(1);
      expect(prWithNested?.reviews[0].comments[0].message).toBe('Nested test comment');
    });
  });
});
