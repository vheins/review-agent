import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import {
  PullRequest,
  Review,
  Comment,
  ReviewMetrics,
  RepositoryConfig,
  DeveloperMetrics,
} from '../src/database/entities/index.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Property-Based Tests for TypeORM Repository Injection
 * 
 * **Validates: Requirements 2.3**
 * 
 * Property 1: TypeORM Repository Injection
 * For any service yang membutuhkan database access, TypeORM repository harus dapat 
 * di-inject menggunakan @InjectRepository decorator dan berfungsi dengan benar.
 * 
 * These tests verify that:
 * - All registered entities can have their repositories injected
 * - Repository methods (save, find, update, delete) work correctly
 * - CRUD operations maintain data integrity across many random inputs
 */
describe('Property-Based Tests: TypeORM Repository Injection', () => {
  let module: TestingModule;
  let dataSource: DataSource;
  let prRepository: Repository<PullRequest>;
  let reviewRepository: Repository<Review>;
  let commentRepository: Repository<Comment>;
  let metricsRepository: Repository<ReviewMetrics>;
  let configRepository: Repository<RepositoryConfig>;
  let developerRepository: Repository<DeveloperMetrics>;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test-pbt-pr-review.db');

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

  describe('Property 1: TypeORM Repository Injection', () => {
    it('should inject PullRequest repository and perform CRUD operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('open', 'closed', 'merged'),
          fc.boolean(),
          async (number, title, author, repository, branch, status, isDraft) => {
            // Repository should be injected
            expect(prRepository).toBeDefined();
            expect(prRepository).toBeInstanceOf(Repository);

            // Create entity
            const pr = prRepository.create({
              number,
              title,
              author,
              repository,
              branch,
              baseBranch: 'main',
              status,
              url: `https://github.com/${repository}/pull/${number}`,
              isDraft,
              labels: [],
            });

            // Save should work
            const saved = await prRepository.save(pr);
            expect(saved).toBeDefined();
            expect(saved.number).toBe(number);
            expect(saved.title).toBe(title);

            // Find should work
            const found = await prRepository.findOne({ where: { number } });
            expect(found).toBeDefined();
            expect(found?.number).toBe(number);
            expect(found?.title).toBe(title);

            // Update should work
            await prRepository.update({ number }, { status: 'closed' });
            const updated = await prRepository.findOne({ where: { number } });
            expect(updated?.status).toBe('closed');

            // Delete should work
            await prRepository.delete({ number });
            const deleted = await prRepository.findOne({ where: { number } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inject Review repository and perform CRUD operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom('pending', 'in_progress', 'completed', 'failed'),
          fc.constantFrom('comment', 'auto-fix'),
          fc.constantFrom('gemini', 'copilot', 'kiro', 'claude', 'codex', 'opencode'),
          async (prNumber, repository, status, mode, executor) => {
            // Repository should be injected
            expect(reviewRepository).toBeDefined();
            expect(reviewRepository).toBeInstanceOf(Repository);

            // Create entity
            const review = reviewRepository.create({
              prNumber,
              repository,
              status,
              mode,
              executor,
            });

            // Save should work
            const saved = await reviewRepository.save(review);
            expect(saved).toBeDefined();
            expect(saved.id).toBeDefined();
            expect(saved.prNumber).toBe(prNumber);
            expect(saved.status).toBe(status);

            // Find should work
            const found = await reviewRepository.findOne({ where: { id: saved.id } });
            expect(found).toBeDefined();
            expect(found?.prNumber).toBe(prNumber);

            // Update should work
            await reviewRepository.update({ id: saved.id }, { status: 'completed' });
            const updated = await reviewRepository.findOne({ where: { id: saved.id } });
            expect(updated?.status).toBe('completed');

            // Delete should work
            await reviewRepository.delete({ id: saved.id });
            const deleted = await reviewRepository.findOne({ where: { id: saved.id } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inject Comment repository and perform CRUD operations correctly', async () => {
      // First create a review to reference
      const review = reviewRepository.create({
        prNumber: 1,
        repository: 'test/repo',
        status: 'in_progress',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.constantFrom('info', 'warning', 'error'),
          fc.constantFrom('bug', 'security', 'performance', 'maintainability', 'architecture', 'testing'),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (file, line, severity, category, message) => {
            // Repository should be injected
            expect(commentRepository).toBeDefined();
            expect(commentRepository).toBeInstanceOf(Repository);

            // Create entity
            const comment = commentRepository.create({
              reviewId: savedReview.id,
              file,
              line,
              severity,
              category,
              message,
              suggestion: null,
            });

            // Save should work
            const saved = await commentRepository.save(comment);
            expect(saved).toBeDefined();
            expect(saved.id).toBeDefined();
            expect(saved.file).toBe(file);
            expect(saved.line).toBe(line);

            // Find should work
            const found = await commentRepository.findOne({ where: { id: saved.id } });
            expect(found).toBeDefined();
            expect(found?.file).toBe(file);

            // Update should work
            await commentRepository.update({ id: saved.id }, { severity: 'error' });
            const updated = await commentRepository.findOne({ where: { id: saved.id } });
            expect(updated?.severity).toBe('error');

            // Delete should work
            await commentRepository.delete({ id: saved.id });
            const deleted = await commentRepository.findOne({ where: { id: saved.id } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inject ReviewMetrics repository and perform CRUD operations correctly', async () => {
      // First create a review to reference
      const review = reviewRepository.create({
        prNumber: 2,
        repository: 'test/repo',
        status: 'completed',
        mode: 'comment',
        executor: 'gemini',
      });
      const savedReview = await reviewRepository.save(review);

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000, max: 300000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          async (duration, filesReviewed, commentsGenerated, bugs, security, performance, healthScore, qualityScore) => {
            // Repository should be injected
            expect(metricsRepository).toBeDefined();
            expect(metricsRepository).toBeInstanceOf(Repository);

            // Create entity
            const metrics = metricsRepository.create({
              reviewId: savedReview.id,
              duration,
              filesReviewed,
              commentsGenerated,
              issuesFound: {
                bugs,
                security,
                performance,
                maintainability: 0,
                architecture: 0,
                testing: 0,
              },
              healthScore,
              qualityScore,
            });

            // Save should work
            const saved = await metricsRepository.save(metrics);
            expect(saved).toBeDefined();
            expect(saved.id).toBeDefined();
            expect(saved.duration).toBe(duration);
            expect(saved.filesReviewed).toBe(filesReviewed);

            // Find should work
            const found = await metricsRepository.findOne({ where: { id: saved.id } });
            expect(found).toBeDefined();
            expect(found?.duration).toBe(duration);

            // Update should work
            await metricsRepository.update({ id: saved.id }, { healthScore: 95.0 });
            const updated = await metricsRepository.findOne({ where: { id: saved.id } });
            expect(updated?.healthScore).toBe(95.0);

            // Delete should work
            await metricsRepository.delete({ id: saved.id });
            const deleted = await metricsRepository.findOne({ where: { id: saved.id } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inject RepositoryConfig repository and perform CRUD operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.boolean(),
          fc.constantFrom('comment', 'auto-fix'),
          fc.constantFrom('gemini', 'copilot', 'kiro', 'claude'),
          fc.constantFrom('authored', 'assigned', 'review-requested', 'all'),
          fc.boolean(),
          async (repository, enabled, reviewMode, executor, scanScope, autoMerge) => {
            // Repository should be injected
            expect(configRepository).toBeDefined();
            expect(configRepository).toBeInstanceOf(Repository);

            // Create entity
            const config = configRepository.create({
              repository,
              enabled,
              reviewMode,
              executor,
              scanScope,
              autoMerge,
              protectedBranches: ['main'],
              excludePatterns: [],
              customPrompt: null,
              version: 1,
            });

            // Save should work
            const saved = await configRepository.save(config);
            expect(saved).toBeDefined();
            expect(saved.repository).toBe(repository);
            expect(saved.enabled).toBe(enabled);

            // Find should work
            const found = await configRepository.findOne({ where: { repository } });
            expect(found).toBeDefined();
            expect(found?.repository).toBe(repository);

            // Update should work
            await configRepository.update({ repository }, { enabled: !enabled });
            const updated = await configRepository.findOne({ where: { repository } });
            expect(updated?.enabled).toBe(!enabled);

            // Delete should work
            await configRepository.delete({ repository });
            const deleted = await configRepository.findOne({ where: { repository } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inject DeveloperMetrics repository and perform CRUD operations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 0, max: 1000 }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.integer({ min: 0, max: 100 }),
          async (username, totalPrs, reviewedPrs, avgHealthScore, avgQualityScore, avgReviewTime) => {
            // Repository should be injected
            expect(developerRepository).toBeDefined();
            expect(developerRepository).toBeInstanceOf(Repository);

            // Create entity
            const metrics = developerRepository.create({
              username,
              totalPrs,
              reviewedPrs,
              averageHealthScore: avgHealthScore,
              averageQualityScore: avgQualityScore,
              issuesFound: {
                bugs: 0,
                security: 0,
                performance: 0,
                maintainability: 0,
              },
              averageReviewTime: avgReviewTime,
              lastReviewAt: null,
            });

            // Save should work
            const saved = await developerRepository.save(metrics);
            expect(saved).toBeDefined();
            expect(saved.username).toBe(username);
            expect(saved.totalPrs).toBe(totalPrs);

            // Find should work
            const found = await developerRepository.findOne({ where: { username } });
            expect(found).toBeDefined();
            expect(found?.username).toBe(username);

            // Update should work
            await developerRepository.update({ username }, { totalPrs: totalPrs + 1 });
            const updated = await developerRepository.findOne({ where: { username } });
            expect(updated?.totalPrs).toBe(totalPrs + 1);

            // Delete should work
            await developerRepository.delete({ username });
            const deleted = await developerRepository.findOne({ where: { username } });
            expect(deleted).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should verify all repositories are injectable and functional', async () => {
      // This test verifies that all 6 entities have working repositories
      const repositories = [
        { name: 'PullRequest', repo: prRepository },
        { name: 'Review', repo: reviewRepository },
        { name: 'Comment', repo: commentRepository },
        { name: 'ReviewMetrics', repo: metricsRepository },
        { name: 'RepositoryConfig', repo: configRepository },
        { name: 'DeveloperMetrics', repo: developerRepository },
      ];

      for (const { name, repo } of repositories) {
        expect(repo, `${name} repository should be injected`).toBeDefined();
        expect(repo, `${name} repository should be a Repository instance`).toBeInstanceOf(Repository);
        
        // Verify repository has standard methods
        expect(typeof repo.create, `${name} repository should have create method`).toBe('function');
        expect(typeof repo.save, `${name} repository should have save method`).toBe('function');
        expect(typeof repo.find, `${name} repository should have find method`).toBe('function');
        expect(typeof repo.findOne, `${name} repository should have findOne method`).toBe('function');
        expect(typeof repo.update, `${name} repository should have update method`).toBe('function');
        expect(typeof repo.delete, `${name} repository should have delete method`).toBe('function');
      }
    });
  });

  describe('Property 2: Database Transactions Rollback', () => {
    it('should rollback all operations when transaction fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 10 }),
          async (prNumber, title, author, repository, numComments) => {
            // Get initial counts
            const initialPrCount = await prRepository.count();
            const initialReviewCount = await reviewRepository.count();
            const initialCommentCount = await commentRepository.count();
            const initialMetricsCount = await metricsRepository.count();

            // Create QueryRunner for manual transaction control
            const queryRunner = dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
              // 1. Save a PR
              const pr = prRepository.create({
                number: prNumber,
                title,
                author,
                repository,
                branch: 'feature/test',
                baseBranch: 'main',
                status: 'open',
                url: `https://github.com/${repository}/pull/${prNumber}`,
                isDraft: false,
                labels: [],
              });
              await queryRunner.manager.save(pr);

              // 2. Save a Review
              const review = reviewRepository.create({
                prNumber,
                repository,
                status: 'in_progress',
                mode: 'comment',
                executor: 'gemini',
              });
              const savedReview = await queryRunner.manager.save(review);

              // 3. Save multiple Comments
              const comments = [];
              for (let i = 0; i < numComments; i++) {
                const comment = commentRepository.create({
                  reviewId: savedReview.id,
                  file: `src/file${i}.ts`,
                  line: i + 1,
                  severity: 'warning',
                  category: 'bug',
                  message: `Test comment ${i}`,
                  suggestion: null,
                });
                comments.push(comment);
              }
              await queryRunner.manager.save(comments);

              // 4. Save ReviewMetrics
              const metrics = metricsRepository.create({
                reviewId: savedReview.id,
                duration: 30000,
                filesReviewed: 5,
                commentsGenerated: numComments,
                issuesFound: {
                  bugs: 1,
                  security: 0,
                  performance: 0,
                  maintainability: 0,
                  architecture: 0,
                  testing: 0,
                },
                healthScore: 85.0,
                qualityScore: 80.0,
              });
              await queryRunner.manager.save(metrics);

              // 5. Intentionally cause an error to trigger rollback
              throw new Error('Intentional error to test rollback');
            } catch (error) {
              // Rollback transaction
              await queryRunner.rollbackTransaction();
            } finally {
              await queryRunner.release();
            }

            // Verify all operations were rolled back
            const finalPrCount = await prRepository.count();
            const finalReviewCount = await reviewRepository.count();
            const finalCommentCount = await commentRepository.count();
            const finalMetricsCount = await metricsRepository.count();

            // Database state should be unchanged
            expect(finalPrCount).toBe(initialPrCount);
            expect(finalReviewCount).toBe(initialReviewCount);
            expect(finalCommentCount).toBe(initialCommentCount);
            expect(finalMetricsCount).toBe(initialMetricsCount);

            // Verify specific entities don't exist
            const pr = await prRepository.findOne({ where: { number: prNumber } });
            expect(pr).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should commit all operations when transaction succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 5 }),
          async (prNumber, title, author, repository, numComments) => {
            // Get initial counts
            const initialPrCount = await prRepository.count();
            const initialReviewCount = await reviewRepository.count();
            const initialCommentCount = await commentRepository.count();
            const initialMetricsCount = await metricsRepository.count();

            // Create QueryRunner for manual transaction control
            const queryRunner = dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            let savedReviewId: string;

            try {
              // 1. Save a PR
              const pr = prRepository.create({
                number: prNumber,
                title,
                author,
                repository,
                branch: 'feature/test',
                baseBranch: 'main',
                status: 'open',
                url: `https://github.com/${repository}/pull/${prNumber}`,
                isDraft: false,
                labels: [],
              });
              await queryRunner.manager.save(pr);

              // 2. Save a Review
              const review = reviewRepository.create({
                prNumber,
                repository,
                status: 'in_progress',
                mode: 'comment',
                executor: 'gemini',
              });
              const savedReview = await queryRunner.manager.save(review);
              savedReviewId = savedReview.id;

              // 3. Save multiple Comments
              const comments = [];
              for (let i = 0; i < numComments; i++) {
                const comment = commentRepository.create({
                  reviewId: savedReview.id,
                  file: `src/file${i}.ts`,
                  line: i + 1,
                  severity: 'warning',
                  category: 'bug',
                  message: `Test comment ${i}`,
                  suggestion: null,
                });
                comments.push(comment);
              }
              await queryRunner.manager.save(comments);

              // 4. Save ReviewMetrics
              const metrics = metricsRepository.create({
                reviewId: savedReview.id,
                duration: 30000,
                filesReviewed: 5,
                commentsGenerated: numComments,
                issuesFound: {
                  bugs: 1,
                  security: 0,
                  performance: 0,
                  maintainability: 0,
                  architecture: 0,
                  testing: 0,
                },
                healthScore: 85.0,
                qualityScore: 80.0,
              });
              await queryRunner.manager.save(metrics);

              // Commit transaction (no error)
              await queryRunner.commitTransaction();
            } catch (error) {
              await queryRunner.rollbackTransaction();
              throw error;
            } finally {
              await queryRunner.release();
            }

            // Verify all operations were committed
            const finalPrCount = await prRepository.count();
            const finalReviewCount = await reviewRepository.count();
            const finalCommentCount = await commentRepository.count();
            const finalMetricsCount = await metricsRepository.count();

            // Counts should have increased
            expect(finalPrCount).toBe(initialPrCount + 1);
            expect(finalReviewCount).toBe(initialReviewCount + 1);
            expect(finalCommentCount).toBe(initialCommentCount + numComments);
            expect(finalMetricsCount).toBe(initialMetricsCount + 1);

            // Verify specific entities exist
            const pr = await prRepository.findOne({ where: { number: prNumber } });
            expect(pr).toBeDefined();
            expect(pr?.title).toBe(title);

            const review = await reviewRepository.findOne({ where: { id: savedReviewId } });
            expect(review).toBeDefined();
            expect(review?.prNumber).toBe(prNumber);

            const comments = await commentRepository.find({ where: { reviewId: savedReviewId } });
            expect(comments).toHaveLength(numComments);

            const metrics = await metricsRepository.findOne({ where: { reviewId: savedReviewId } });
            expect(metrics).toBeDefined();
            expect(metrics?.commentsGenerated).toBe(numComments);

            // Cleanup for next iteration
            await commentRepository.delete({ reviewId: savedReviewId });
            await metricsRepository.delete({ reviewId: savedReviewId });
            await reviewRepository.delete({ id: savedReviewId });
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rollback partial saves when error occurs mid-transaction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 2, max: 10 }),
          fc.integer({ min: 1, max: 9 }),
          async (prNumber, repository, totalComments, errorAtComment) => {
            // Ensure errorAtComment is less than totalComments
            const errorIndex = errorAtComment % totalComments;

            // Get initial state
            const initialCommentCount = await commentRepository.count();

            // Create a review first (outside transaction for this test)
            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'in_progress',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            // Start transaction
            const queryRunner = dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
              // Save comments one by one, error at specific index
              for (let i = 0; i < totalComments; i++) {
                if (i === errorIndex) {
                  throw new Error(`Error at comment ${i}`);
                }

                const comment = commentRepository.create({
                  reviewId: savedReview.id,
                  file: `src/file${i}.ts`,
                  line: i + 1,
                  severity: 'warning',
                  category: 'bug',
                  message: `Comment ${i}`,
                  suggestion: null,
                });
                await queryRunner.manager.save(comment);
              }

              await queryRunner.commitTransaction();
            } catch (error) {
              await queryRunner.rollbackTransaction();
            } finally {
              await queryRunner.release();
            }

            // Verify no comments were saved (all rolled back)
            const finalCommentCount = await commentRepository.count();
            expect(finalCommentCount).toBe(initialCommentCount);

            const comments = await commentRepository.find({ where: { reviewId: savedReview.id } });
            expect(comments).toHaveLength(0);

            // Cleanup
            await reviewRepository.delete({ id: savedReview.id });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle nested entity saves with rollback correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.boolean(),
          async (prNumber, repository, shouldFail) => {
            // Get initial counts
            const initialPrCount = await prRepository.count();
            const initialReviewCount = await reviewRepository.count();
            const initialCommentCount = await commentRepository.count();
            const initialMetricsCount = await metricsRepository.count();

            const queryRunner = dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
              // Create PR
              const pr = prRepository.create({
                number: prNumber,
                title: 'Nested test',
                author: 'testuser',
                repository,
                branch: 'feature/nested',
                baseBranch: 'main',
                status: 'open',
                url: `https://github.com/${repository}/pull/${prNumber}`,
                isDraft: false,
                labels: [],
              });
              await queryRunner.manager.save(pr);

              // Create Review
              const review = reviewRepository.create({
                prNumber,
                repository,
                status: 'in_progress',
                mode: 'comment',
                executor: 'gemini',
              });
              const savedReview = await queryRunner.manager.save(review);

              // Create Comment
              const comment = commentRepository.create({
                reviewId: savedReview.id,
                file: 'src/test.ts',
                line: 10,
                severity: 'warning',
                category: 'bug',
                message: 'Test',
                suggestion: null,
              });
              await queryRunner.manager.save(comment);

              // Create Metrics
              const metrics = metricsRepository.create({
                reviewId: savedReview.id,
                duration: 10000,
                filesReviewed: 1,
                commentsGenerated: 1,
                issuesFound: {
                  bugs: 1,
                  security: 0,
                  performance: 0,
                  maintainability: 0,
                  architecture: 0,
                  testing: 0,
                },
                healthScore: 90.0,
                qualityScore: 85.0,
              });
              await queryRunner.manager.save(metrics);

              if (shouldFail) {
                throw new Error('Intentional failure');
              }

              await queryRunner.commitTransaction();
            } catch (error) {
              await queryRunner.rollbackTransaction();
            } finally {
              await queryRunner.release();
            }

            // Verify state based on shouldFail
            const finalPrCount = await prRepository.count();
            const finalReviewCount = await reviewRepository.count();
            const finalCommentCount = await commentRepository.count();
            const finalMetricsCount = await metricsRepository.count();

            if (shouldFail) {
              // All should be rolled back
              expect(finalPrCount).toBe(initialPrCount);
              expect(finalReviewCount).toBe(initialReviewCount);
              expect(finalCommentCount).toBe(initialCommentCount);
              expect(finalMetricsCount).toBe(initialMetricsCount);

              const pr = await prRepository.findOne({ where: { number: prNumber } });
              expect(pr).toBeNull();
            } else {
              // All should be committed
              expect(finalPrCount).toBe(initialPrCount + 1);
              expect(finalReviewCount).toBe(initialReviewCount + 1);
              expect(finalCommentCount).toBe(initialCommentCount + 1);
              expect(finalMetricsCount).toBe(initialMetricsCount + 1);

              const pr = await prRepository.findOne({ where: { number: prNumber } });
              expect(pr).toBeDefined();

              // Cleanup
              const review = await reviewRepository.findOne({ where: { prNumber } });
              if (review) {
                await commentRepository.delete({ reviewId: review.id });
                await metricsRepository.delete({ reviewId: review.id });
                await reviewRepository.delete({ id: review.id });
              }
              await prRepository.delete({ number: prNumber });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Entity Relations Loading', () => {
    it('should load OneToMany relations explicitly using relations option', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 5 }),
          async (prNumber, repository, numReviews) => {
            // Create a PR
            const pr = prRepository.create({
              number: prNumber,
              title: 'Test PR for relations',
              author: 'testuser',
              repository,
              branch: 'feature/test',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            // Create multiple reviews for this PR
            const reviewIds: string[] = [];
            for (let i = 0; i < numReviews; i++) {
              const review = reviewRepository.create({
                prNumber,
                repository,
                status: 'completed',
                mode: 'comment',
                executor: 'gemini',
              });
              const saved = await reviewRepository.save(review);
              reviewIds.push(saved.id);
            }

            // Load PR with reviews using explicit loading
            const prWithReviews = await prRepository.findOne({
              where: { number: prNumber },
              relations: ['reviews'],
            });

            // Verify relations loaded correctly
            expect(prWithReviews).toBeDefined();
            expect(prWithReviews?.reviews).toBeDefined();
            expect(prWithReviews?.reviews).toHaveLength(numReviews);
            
            // Verify each review is correctly populated
            prWithReviews?.reviews.forEach((review) => {
              expect(review.id).toBeDefined();
              expect(review.prNumber).toBe(prNumber);
              expect(review.repository).toBe(repository);
              expect(reviewIds).toContain(review.id);
            });

            // Cleanup
            for (const reviewId of reviewIds) {
              await reviewRepository.delete({ id: reviewId });
            }
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load ManyToOne relations explicitly using relations option', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (prNumber, repository, title) => {
            // Create a PR
            const pr = prRepository.create({
              number: prNumber,
              title,
              author: 'testuser',
              repository,
              branch: 'feature/test',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            // Create a review for this PR
            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'completed',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            // Load review with PR using explicit loading
            const reviewWithPr = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['pullRequest'],
            });

            // Verify ManyToOne relation loaded correctly
            expect(reviewWithPr).toBeDefined();
            expect(reviewWithPr?.pullRequest).toBeDefined();
            expect(reviewWithPr?.pullRequest.number).toBe(prNumber);
            expect(reviewWithPr?.pullRequest.title).toBe(title);
            expect(reviewWithPr?.pullRequest.repository).toBe(repository);

            // Cleanup
            await reviewRepository.delete({ id: savedReview.id });
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load OneToOne relations explicitly using relations option', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1000, max: 300000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          async (prNumber, repository, duration, filesReviewed, healthScore) => {
            // Create a review
            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'completed',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            // Create metrics for this review (OneToOne)
            const metrics = metricsRepository.create({
              reviewId: savedReview.id,
              duration,
              filesReviewed,
              commentsGenerated: 5,
              issuesFound: {
                bugs: 1,
                security: 0,
                performance: 0,
                maintainability: 0,
                architecture: 0,
                testing: 0,
              },
              healthScore,
              qualityScore: 80.0,
            });
            await metricsRepository.save(metrics);

            // Load review with metrics using explicit loading
            const reviewWithMetrics = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['metrics'],
            });

            // Verify OneToOne relation loaded correctly
            expect(reviewWithMetrics).toBeDefined();
            expect(reviewWithMetrics?.metrics).toBeDefined();
            expect(reviewWithMetrics?.metrics.reviewId).toBe(savedReview.id);
            expect(reviewWithMetrics?.metrics.duration).toBe(duration);
            expect(reviewWithMetrics?.metrics.filesReviewed).toBe(filesReviewed);
            expect(reviewWithMetrics?.metrics.healthScore).toBe(healthScore);

            // Load metrics with review (reverse direction)
            const metricsWithReview = await metricsRepository.findOne({
              where: { reviewId: savedReview.id },
              relations: ['review'],
            });

            // Verify reverse OneToOne relation
            expect(metricsWithReview).toBeDefined();
            expect(metricsWithReview?.review).toBeDefined();
            expect(metricsWithReview?.review.id).toBe(savedReview.id);
            expect(metricsWithReview?.review.prNumber).toBe(prNumber);

            // Cleanup
            await metricsRepository.delete({ reviewId: savedReview.id });
            await reviewRepository.delete({ id: savedReview.id });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load nested relations (PR -> Review -> Comments)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1, max: 5 }),
          async (prNumber, repository, numReviews, commentsPerReview) => {
            // Create a PR
            const pr = prRepository.create({
              number: prNumber,
              title: 'Nested relations test',
              author: 'testuser',
              repository,
              branch: 'feature/nested',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            // Create reviews with comments
            const reviewIds: string[] = [];
            for (let i = 0; i < numReviews; i++) {
              const review = reviewRepository.create({
                prNumber,
                repository,
                status: 'completed',
                mode: 'comment',
                executor: 'gemini',
              });
              const savedReview = await reviewRepository.save(review);
              reviewIds.push(savedReview.id);

              // Create comments for each review
              for (let j = 0; j < commentsPerReview; j++) {
                const comment = commentRepository.create({
                  reviewId: savedReview.id,
                  file: `src/file${j}.ts`,
                  line: j + 1,
                  severity: 'warning',
                  category: 'bug',
                  message: `Comment ${j} for review ${i}`,
                  suggestion: null,
                });
                await commentRepository.save(comment);
              }
            }

            // Load PR with nested relations: PR -> Reviews -> Comments
            const prWithNestedRelations = await prRepository.findOne({
              where: { number: prNumber },
              relations: ['reviews', 'reviews.comments'],
            });

            // Verify nested relations loaded correctly
            expect(prWithNestedRelations).toBeDefined();
            expect(prWithNestedRelations?.reviews).toBeDefined();
            expect(prWithNestedRelations?.reviews).toHaveLength(numReviews);

            // Verify each review has correct comments
            prWithNestedRelations?.reviews.forEach((review) => {
              expect(review.comments).toBeDefined();
              expect(review.comments).toHaveLength(commentsPerReview);
              
              review.comments.forEach((comment) => {
                expect(comment.reviewId).toBe(review.id);
                expect(comment.file).toMatch(/^src\/file\d+\.ts$/);
              });
            });

            // Cleanup
            for (const reviewId of reviewIds) {
              await commentRepository.delete({ reviewId });
              await reviewRepository.delete({ id: reviewId });
            }
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should load multiple relation types simultaneously', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 3 }),
          fc.integer({ min: 1000, max: 100000 }),
          async (prNumber, repository, numComments, duration) => {
            // Create a PR
            const pr = prRepository.create({
              number: prNumber,
              title: 'Multiple relations test',
              author: 'testuser',
              repository,
              branch: 'feature/multi',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            // Create a review
            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'completed',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            // Create comments (OneToMany)
            for (let i = 0; i < numComments; i++) {
              const comment = commentRepository.create({
                reviewId: savedReview.id,
                file: `src/file${i}.ts`,
                line: i + 1,
                severity: 'warning',
                category: 'bug',
                message: `Comment ${i}`,
                suggestion: null,
              });
              await commentRepository.save(comment);
            }

            // Create metrics (OneToOne)
            const metrics = metricsRepository.create({
              reviewId: savedReview.id,
              duration,
              filesReviewed: 10,
              commentsGenerated: numComments,
              issuesFound: {
                bugs: 2,
                security: 1,
                performance: 0,
                maintainability: 0,
                architecture: 0,
                testing: 0,
              },
              healthScore: 85.0,
              qualityScore: 80.0,
            });
            await metricsRepository.save(metrics);

            // Load review with all relations: ManyToOne (PR), OneToMany (Comments), OneToOne (Metrics)
            const reviewWithAllRelations = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['pullRequest', 'comments', 'metrics'],
            });

            // Verify all relation types loaded correctly
            expect(reviewWithAllRelations).toBeDefined();
            
            // ManyToOne: Review -> PullRequest
            expect(reviewWithAllRelations?.pullRequest).toBeDefined();
            expect(reviewWithAllRelations?.pullRequest.number).toBe(prNumber);
            
            // OneToMany: Review -> Comments
            expect(reviewWithAllRelations?.comments).toBeDefined();
            expect(reviewWithAllRelations?.comments).toHaveLength(numComments);
            
            // OneToOne: Review -> Metrics
            expect(reviewWithAllRelations?.metrics).toBeDefined();
            expect(reviewWithAllRelations?.metrics.duration).toBe(duration);
            expect(reviewWithAllRelations?.metrics.commentsGenerated).toBe(numComments);

            // Cleanup
            await commentRepository.delete({ reviewId: savedReview.id });
            await metricsRepository.delete({ reviewId: savedReview.id });
            await reviewRepository.delete({ id: savedReview.id });
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain relation data integrity across operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 1, max: 5 }),
          async (prNumber, repository, numComments) => {
            // Create entities with relations
            const pr = prRepository.create({
              number: prNumber,
              title: 'Integrity test',
              author: 'testuser',
              repository,
              branch: 'feature/integrity',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'in_progress',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            const commentIds: string[] = [];
            for (let i = 0; i < numComments; i++) {
              const comment = commentRepository.create({
                reviewId: savedReview.id,
                file: `src/file${i}.ts`,
                line: i + 1,
                severity: 'warning',
                category: 'bug',
                message: `Comment ${i}`,
                suggestion: null,
              });
              const saved = await commentRepository.save(comment);
              commentIds.push(saved.id);
            }

            // Load with relations
            const reviewWithRelations = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['pullRequest', 'comments'],
            });

            // Verify initial state
            expect(reviewWithRelations?.pullRequest.number).toBe(prNumber);
            expect(reviewWithRelations?.comments).toHaveLength(numComments);

            // Update parent entity
            await reviewRepository.update({ id: savedReview.id }, { status: 'completed' });

            // Reload with relations
            const updatedReview = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['pullRequest', 'comments'],
            });

            // Verify relations still intact after update
            expect(updatedReview?.status).toBe('completed');
            expect(updatedReview?.pullRequest.number).toBe(prNumber);
            expect(updatedReview?.comments).toHaveLength(numComments);
            
            // Verify comment IDs unchanged
            const loadedCommentIds = updatedReview?.comments.map(c => c.id) || [];
            commentIds.forEach(id => {
              expect(loadedCommentIds).toContain(id);
            });

            // Cleanup
            await commentRepository.delete({ reviewId: savedReview.id });
            await reviewRepository.delete({ id: savedReview.id });
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty relations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prNumber, repository) => {
            // Create a PR without any reviews
            const pr = prRepository.create({
              number: prNumber,
              title: 'Empty relations test',
              author: 'testuser',
              repository,
              branch: 'feature/empty',
              baseBranch: 'main',
              status: 'open',
              url: `https://github.com/${repository}/pull/${prNumber}`,
              isDraft: false,
              labels: [],
            });
            await prRepository.save(pr);

            // Load PR with reviews relation
            const prWithReviews = await prRepository.findOne({
              where: { number: prNumber },
              relations: ['reviews'],
            });

            // Verify empty relation is an empty array, not null/undefined
            expect(prWithReviews).toBeDefined();
            expect(prWithReviews?.reviews).toBeDefined();
            expect(Array.isArray(prWithReviews?.reviews)).toBe(true);
            expect(prWithReviews?.reviews).toHaveLength(0);

            // Create a review without comments
            const review = reviewRepository.create({
              prNumber,
              repository,
              status: 'in_progress',
              mode: 'comment',
              executor: 'gemini',
            });
            const savedReview = await reviewRepository.save(review);

            // Load review with comments relation
            const reviewWithComments = await reviewRepository.findOne({
              where: { id: savedReview.id },
              relations: ['comments'],
            });

            // Verify empty comments relation
            expect(reviewWithComments).toBeDefined();
            expect(reviewWithComments?.comments).toBeDefined();
            expect(Array.isArray(reviewWithComments?.comments)).toBe(true);
            expect(reviewWithComments?.comments).toHaveLength(0);

            // Cleanup
            await reviewRepository.delete({ id: savedReview.id });
            await prRepository.delete({ number: prNumber });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
