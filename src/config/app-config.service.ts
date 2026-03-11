import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositoryConfig } from '../database/entities/repository-config.entity.js';
import { AppConfig } from './app.config.js';
import { ReviewConfig } from './review.config.js';
import { AiExecutorConfig } from './ai-executor.config.js';
import { DatabaseConfig } from './database.config.js';

/**
 * AppConfigService - Extended Configuration Service
 * 
 * This service extends NestJS ConfigService to provide repository-specific
 * configuration overrides loaded from the database.
 * 
 * Features:
 * - Access to all global configuration via ConfigService
 * - Repository-specific configuration overrides from database
 * - Configuration validation
 * - Configuration versioning support
 * - Caching for performance
 * 
 * Usage:
 * ```typescript
 * constructor(private appConfig: AppConfigService) {}
 * 
 * // Get global config
 * const port = this.appConfig.get<number>('app.apiPort');
 * 
 * // Get repository-specific config
 * const repoConfig = await this.appConfig.getRepositoryConfig('owner/repo');
 * ```
 * 
 * Requirements: 9.3, 9.4, 9.6
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly configCache = new Map<string, RepositoryConfig>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly cacheTimestamps = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(RepositoryConfig)
    private readonly repoConfigRepository: Repository<RepositoryConfig>,
  ) {}

  /**
   * Get configuration value from global config
   * Delegates to NestJS ConfigService
   * 
   * @param key - Configuration key (e.g., 'app.apiPort')
   * @param defaultValue - Optional default value
   * @returns Configuration value
   */
  get<T = any>(key: string, defaultValue?: T): T {
    return this.configService.get<T>(key, defaultValue as T);
  }

  /**
   * Get entire app configuration namespace
   */
  getAppConfig(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  /**
   * Get entire review configuration namespace
   */
  getReviewConfig(): ReviewConfig {
    return this.configService.get<ReviewConfig>('review')!;
  }

  /**
   * Get entire AI executor configuration namespace
   */
  getAiExecutorConfig(): AiExecutorConfig {
    return this.configService.get<AiExecutorConfig>('aiExecutor')!;
  }

  /**
   * Get entire database configuration namespace
   */
  getDatabaseConfig(): DatabaseConfig {
    return this.configService.get<DatabaseConfig>('database')!;
  }

  /**
   * Get repository-specific configuration with overrides
   * 
   * This method loads repository-specific configuration from the database
   * and merges it with global configuration. Repository-specific values
   * override global values.
   * 
   * Features:
   * - Caching for performance (5 minute TTL)
   * - Falls back to global config if no repo-specific config exists
   * - Validates configuration values
   * - Supports configuration versioning
   * 
   * @param repository - Repository name (e.g., 'owner/repo')
   * @returns Repository configuration with overrides applied
   * 
   * Requirements: 9.3, 9.4, 9.6
   */
  async getRepositoryConfig(repository: string): Promise<RepositoryConfig> {
    // Check cache first
    const cached = this.getCachedConfig(repository);
    if (cached) {
      this.logger.debug(`Using cached config for repository: ${repository}`);
      return cached;
    }

    try {
      // Load from database
      let repoConfig = await this.repoConfigRepository.findOne({
        where: { repository },
      });

      // If no repo-specific config exists, create default from global config
      if (!repoConfig) {
        this.logger.debug(
          `No repository-specific config found for ${repository}, using global defaults`,
        );
        repoConfig = this.createDefaultConfig(repository);
      }

      // Validate configuration
      this.validateConfig(repoConfig);

      // Cache the result
      this.cacheConfig(repository, repoConfig);

      return repoConfig;
    } catch (error) {
      this.logger.error(
        `Failed to load repository config for ${repository}: ${error.message}`,
        error.stack,
      );
      // Return default config on error
      return this.createDefaultConfig(repository);
    }
  }

  /**
   * Create default repository configuration from global config
   * 
   * @param repository - Repository name
   * @returns Default repository configuration
   */
  private createDefaultConfig(repository: string): RepositoryConfig {
    const appConfig = this.getAppConfig();
    const reviewConfig = this.getReviewConfig();
    const aiConfig = this.getAiExecutorConfig();

    const config = new RepositoryConfig();
    config.repository = repository;
    config.enabled = true;
    config.reviewMode = reviewConfig.reviewMode;
    config.executor = aiConfig.executor;
    config.scanScope = appConfig.prScope.join(',');
    config.autoMerge = appConfig.autoMerge;
    config.protectedBranches = ['main', 'master'];
    config.excludePatterns = [];
    config.customPrompt = null;
    config.version = 1;

    return config;
  }

  /**
   * Validate repository configuration
   * 
   * Validates that configuration values are valid and consistent.
   * Throws error if validation fails.
   * 
   * @param config - Repository configuration to validate
   * @throws Error if validation fails
   * 
   * Requirements: 9.4
   */
  private validateConfig(config: RepositoryConfig): void {
    const errors: string[] = [];

    // Validate repository name
    if (!config.repository || config.repository.trim() === '') {
      errors.push('Repository name is required');
    }

    // Validate review mode
    if (!['comment', 'auto-fix'].includes(config.reviewMode)) {
      errors.push(
        `Invalid review mode: ${config.reviewMode}. Must be 'comment' or 'auto-fix'`,
      );
    }

    // Validate executor
    const validExecutors = [
      'gemini',
      'copilot',
      'kiro',
      'claude',
      'codex',
      'opencode',
    ];
    if (!validExecutors.includes(config.executor.toLowerCase())) {
      errors.push(
        `Invalid executor: ${config.executor}. Must be one of: ${validExecutors.join(', ')}`,
      );
    }

    // Validate scan scope
    const validScopes = ['authored', 'assigned', 'review-requested', 'all'];
    const scopes = config.scanScope.split(',').map((s) => s.trim());
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        errors.push(
          `Invalid scan scope: ${scope}. Must be one of: ${validScopes.join(', ')}`,
        );
      }
    }

    // Validate protected branches is an array
    if (!Array.isArray(config.protectedBranches)) {
      errors.push('Protected branches must be an array');
    }

    // Validate exclude patterns is an array
    if (!Array.isArray(config.excludePatterns)) {
      errors.push('Exclude patterns must be an array');
    }

    // Validate version is positive
    if (config.version < 1) {
      errors.push('Version must be a positive integer');
    }

    if (errors.length > 0) {
      const errorMessage = `Configuration validation failed for ${config.repository}:\n${errors.join('\n')}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.logger.debug(`Configuration validated successfully for ${config.repository}`);
  }

  /**
   * Get cached configuration if available and not expired
   * 
   * @param repository - Repository name
   * @returns Cached config or null if not found/expired
   */
  private getCachedConfig(repository: string): RepositoryConfig | null {
    const cached = this.configCache.get(repository);
    const timestamp = this.cacheTimestamps.get(repository);

    if (cached && timestamp) {
      const age = Date.now() - timestamp;
      if (age < this.CACHE_TTL) {
        return cached;
      }
      // Cache expired, remove it
      this.configCache.delete(repository);
      this.cacheTimestamps.delete(repository);
    }

    return null;
  }

  /**
   * Cache repository configuration
   * 
   * @param repository - Repository name
   * @param config - Configuration to cache
   */
  private cacheConfig(repository: string, config: RepositoryConfig): void {
    this.configCache.set(repository, config);
    this.cacheTimestamps.set(repository, Date.now());
  }

  /**
   * Clear cache for a specific repository
   * Useful when configuration is updated
   * 
   * @param repository - Repository name
   */
  clearCache(repository: string): void {
    this.configCache.delete(repository);
    this.cacheTimestamps.delete(repository);
    this.logger.debug(`Cache cleared for repository: ${repository}`);
  }

  /**
   * Clear all cached configurations
   */
  clearAllCache(): void {
    this.configCache.clear();
    this.cacheTimestamps.clear();
    this.logger.debug('All configuration cache cleared');
  }

  /**
   * Save or update repository configuration
   * 
   * @param config - Repository configuration to save
   * @returns Saved configuration
   */
  async saveRepositoryConfig(
    config: RepositoryConfig,
  ): Promise<RepositoryConfig> {
    // Validate before saving
    this.validateConfig(config);

    // Increment version
    const existing = await this.repoConfigRepository.findOne({
      where: { repository: config.repository },
    });

    if (existing) {
      config.version = existing.version + 1;
    }

    // Save to database
    const saved = await this.repoConfigRepository.save(config);

    // Clear cache to force reload
    this.clearCache(config.repository);

    this.logger.log(
      `Repository configuration saved for ${config.repository} (version ${saved.version})`,
    );

    return saved;
  }

  /**
   * Get configuration version for a repository
   * 
   * @param repository - Repository name
   * @returns Configuration version or 0 if not found
   * 
   * Requirements: 9.6
   */
  async getConfigVersion(repository: string): Promise<number> {
    const config = await this.repoConfigRepository.findOne({
      where: { repository },
      select: ['version'],
    });

    return config?.version || 0;
  }
}
