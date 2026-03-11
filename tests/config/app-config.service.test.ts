import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AppConfigService } from '../../src/config/app-config.service.js';
import { RepositoryConfig } from '../../src/database/entities/repository-config.entity.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let configService: ConfigService;
  let repoConfigRepository: Repository<RepositoryConfig>;

  // Mock data
  const mockAppConfig = {
    nodeEnv: 'test',
    apiPort: 3000,
    reviewInterval: 600,
    logLevel: 'info',
    workspaceDir: './workspace',
    excludeRepoOwners: [],
    prScope: ['authored', 'assigned', 'review-requested'],
    autoMerge: false,
  };

  const mockReviewConfig = {
    delegate: false,
    reviewMode: 'comment' as const,
    severityThreshold: 10,
    severityCritical: 5,
    severityHigh: 3,
    severityMedium: 2,
    severityLow: 1,
  };

  const mockAiExecutorConfig = {
    executor: 'gemini',
    gemini: { model: 'gemini-pro', temperature: 0.7 },
    copilot: { model: 'gpt-4' },
    kiro: { model: 'default' },
    claude: { model: 'claude-3' },
    codex: { model: 'codex' },
    opencode: { model: 'default' },
  };

  const mockDatabaseConfig = {
    type: 'sqlite' as const,
    database: 'data/pr-review.db',
  };

  const mockRepoConfig: RepositoryConfig = {
    repository: 'owner/repo',
    enabled: true,
    reviewMode: 'comment',
    executor: 'gemini',
    scanScope: 'authored,assigned',
    autoMerge: false,
    protectedBranches: ['main', 'master'],
    excludePatterns: ['*.md'],
    customPrompt: 'Custom prompt',
    version: 1,
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Create mock repository
    const mockRepository = {
      findOne: vi.fn(),
      save: vi.fn(),
    } as unknown as Repository<RepositoryConfig>;

    // Create mock ConfigService
    const mockConfigService = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'app') return mockAppConfig;
        if (key === 'review') return mockReviewConfig;
        if (key === 'aiExecutor') return mockAiExecutorConfig;
        if (key === 'database') return mockDatabaseConfig;
        if (key === 'app.apiPort') return mockAppConfig.apiPort;
        return defaultValue;
      }),
    } as unknown as ConfigService;

    // Create service instance directly with mocks
    service = new AppConfigService(mockConfigService, mockRepository);
    configService = mockConfigService;
    repoConfigRepository = mockRepository;
  });

  describe('get', () => {
    it('should delegate to ConfigService.get', () => {
      const result = service.get('app.apiPort');
      expect(result).toBe(3000);
      expect(configService.get).toHaveBeenCalledWith('app.apiPort', undefined);
    });

    it('should support default values', () => {
      const result = service.get('nonexistent.key', 'default');
      expect(result).toBe('default');
    });
  });

  describe('getAppConfig', () => {
    it('should return app configuration', () => {
      const result = service.getAppConfig();
      expect(result).toEqual(mockAppConfig);
    });
  });

  describe('getReviewConfig', () => {
    it('should return review configuration', () => {
      const result = service.getReviewConfig();
      expect(result).toEqual(mockReviewConfig);
    });
  });

  describe('getAiExecutorConfig', () => {
    it('should return AI executor configuration', () => {
      const result = service.getAiExecutorConfig();
      expect(result).toEqual(mockAiExecutorConfig);
    });
  });

  describe('getDatabaseConfig', () => {
    it('should return database configuration', () => {
      const result = service.getDatabaseConfig();
      expect(result).toEqual(mockDatabaseConfig);
    });
  });

  describe('getRepositoryConfig', () => {
    it('should load repository config from database', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(
        mockRepoConfig,
      );

      const result = await service.getRepositoryConfig('owner/repo');

      expect(result).toEqual(mockRepoConfig);
      expect(repoConfigRepository.findOne).toHaveBeenCalledWith({
        where: { repository: 'owner/repo' },
      });
    });

    it('should return default config if no repo-specific config exists', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getRepositoryConfig('owner/new-repo');

      expect(result.repository).toBe('owner/new-repo');
      expect(result.enabled).toBe(true);
      expect(result.reviewMode).toBe('comment');
      expect(result.executor).toBe('gemini');
      expect(result.version).toBe(1);
    });

    it('should cache repository config', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(
        mockRepoConfig,
      );

      // First call - should hit database
      await service.getRepositoryConfig('owner/repo');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.getRepositoryConfig('owner/repo');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should return default config on database error', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getRepositoryConfig('owner/repo');

      expect(result.repository).toBe('owner/repo');
      expect(result.enabled).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      expect(() => {
        (service as any).validateConfig(mockRepoConfig);
      }).not.toThrow();
    });

    it('should throw error for empty repository name', () => {
      const invalidConfig = { ...mockRepoConfig, repository: '' };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Repository name is required');
    });

    it('should throw error for invalid review mode', () => {
      const invalidConfig = { ...mockRepoConfig, reviewMode: 'invalid' };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Invalid review mode');
    });

    it('should throw error for invalid executor', () => {
      const invalidConfig = { ...mockRepoConfig, executor: 'invalid' };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Invalid executor');
    });

    it('should throw error for invalid scan scope', () => {
      const invalidConfig = { ...mockRepoConfig, scanScope: 'invalid' };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Invalid scan scope');
    });

    it('should throw error for non-array protected branches', () => {
      const invalidConfig = {
        ...mockRepoConfig,
        protectedBranches: 'not-an-array' as any,
      };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Protected branches must be an array');
    });

    it('should throw error for non-array exclude patterns', () => {
      const invalidConfig = {
        ...mockRepoConfig,
        excludePatterns: 'not-an-array' as any,
      };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Exclude patterns must be an array');
    });

    it('should throw error for invalid version', () => {
      const invalidConfig = { ...mockRepoConfig, version: 0 };
      expect(() => {
        (service as any).validateConfig(invalidConfig);
      }).toThrow('Version must be a positive integer');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific repository', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(
        mockRepoConfig,
      );

      // Load config to cache it
      await service.getRepositoryConfig('owner/repo');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache('owner/repo');

      // Next call should hit database again
      await service.getRepositoryConfig('owner/repo');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cached configurations', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(
        mockRepoConfig,
      );

      // Load multiple configs
      await service.getRepositoryConfig('owner/repo1');
      await service.getRepositoryConfig('owner/repo2');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(2);

      // Clear all cache
      service.clearAllCache();

      // Next calls should hit database again
      await service.getRepositoryConfig('owner/repo1');
      await service.getRepositoryConfig('owner/repo2');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(4);
    });
  });

  describe('saveRepositoryConfig', () => {
    it('should save new repository config', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(repoConfigRepository, 'save').mockResolvedValue(mockRepoConfig);

      const result = await service.saveRepositoryConfig(mockRepoConfig);

      expect(result).toEqual(mockRepoConfig);
      expect(repoConfigRepository.save).toHaveBeenCalledWith(mockRepoConfig);
    });

    it('should increment version when updating existing config', async () => {
      const existingConfig = { ...mockRepoConfig, version: 1 };
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(
        existingConfig,
      );
      vi.spyOn(repoConfigRepository, 'save').mockResolvedValue({
        ...mockRepoConfig,
        version: 2,
      });

      const result = await service.saveRepositoryConfig(mockRepoConfig);

      expect(result.version).toBe(2);
    });

    it('should validate config before saving', async () => {
      const invalidConfig = { ...mockRepoConfig, reviewMode: 'invalid' };

      await expect(
        service.saveRepositoryConfig(invalidConfig as any),
      ).rejects.toThrow('Invalid review mode');
    });

    it('should clear cache after saving', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(repoConfigRepository, 'save').mockResolvedValue(mockRepoConfig);

      // Load config to cache it
      await service.getRepositoryConfig('owner/repo');

      // Save config (should clear cache)
      await service.saveRepositoryConfig(mockRepoConfig);

      // Next call should hit database again
      await service.getRepositoryConfig('owner/repo');
      expect(repoConfigRepository.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('getConfigVersion', () => {
    it('should return config version', async () => {
      // Reset mock to return version 1
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue({
        ...mockRepoConfig,
        version: 1,
      });

      const version = await service.getConfigVersion('owner/repo');

      expect(version).toBe(1);
      expect(repoConfigRepository.findOne).toHaveBeenCalledWith({
        where: { repository: 'owner/repo' },
        select: ['version'],
      });
    });

    it('should return 0 if config not found', async () => {
      vi.spyOn(repoConfigRepository, 'findOne').mockResolvedValue(null);

      const version = await service.getConfigVersion('owner/new-repo');

      expect(version).toBe(0);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default config from global config', () => {
      const result = (service as any).createDefaultConfig('owner/repo');

      expect(result.repository).toBe('owner/repo');
      expect(result.enabled).toBe(true);
      expect(result.reviewMode).toBe('comment');
      expect(result.executor).toBe('gemini');
      expect(result.scanScope).toBe('authored,assigned,review-requested');
      expect(result.autoMerge).toBe(false);
      expect(result.protectedBranches).toEqual(['main', 'master']);
      expect(result.excludePatterns).toEqual([]);
      expect(result.customPrompt).toBeNull();
      expect(result.version).toBe(1);
    });
  });
});
