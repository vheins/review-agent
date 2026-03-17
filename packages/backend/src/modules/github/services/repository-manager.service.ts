import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import fs from 'fs-extra';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Repository } from '../../../database/entities/repository.entity.js';
import { GitHubClientService } from '../github.service.js';
import { AppConfigService } from '../../../config/app-config.service.js';

@Injectable()
export class RepositoryManagerService {
  private readonly logger = new Logger(RepositoryManagerService.name);

  constructor(
    private readonly github: GitHubClientService,
    private readonly config: AppConfigService,
    @InjectRepository(Repository)
    private readonly repoRepository: TypeOrmRepository<Repository>,
  ) {}

  async syncRepositories(): Promise<Repository[]> {
    this.logger.log('[Manager] Syncing repositories from open PRs');
    const start = Date.now();
    const prs = await this.github.fetchOpenPRs();
    
    const syncedRepos: Repository[] = [];
    const seen = new Set<string>();

    for (const pr of prs) {
      const fullName = pr.repository.nameWithOwner;
      if (seen.has(fullName)) continue;
      
      const [owner, name] = fullName.split('/');
      
      let repo = await this.repoRepository.findOne({
        where: { owner, name }
      });

      if (repo) {
        repo.fullName = fullName;
        repo.defaultBranch = pr.baseRefName || repo.defaultBranch;
        repo.updatedAt = new Date();
      } else {
        repo = this.repoRepository.create({
          owner,
          name,
          fullName,
          defaultBranch: pr.baseRefName || 'main',
          githubRepoId: 0,
        });
      }

      const saved = await this.repoRepository.save(repo);
      syncedRepos.push(saved);
      seen.add(fullName);
    }

    this.logger.log(`[Manager] Synced ${syncedRepos.length} repositories in ${Date.now() - start}ms`);
    return syncedRepos;
  }

  async getRepository(id: number): Promise<Repository | null> {
    this.logger.debug(`[Manager] Getting repository by ID: ${id}`);
    return this.repoRepository.findOne({ where: { id } });
  }

  async getAllRepositories(): Promise<Repository[]> {
    this.logger.debug('[Manager] Getting all repositories');
    return this.repoRepository.find({ order: { fullName: 'ASC' } });
  }

  /**
   * Prepare repository locally for review (clone/fetch and checkout)
   */
  async prepareRepository(repoName: string, headRef: string, baseRef: string, prNumber?: number): Promise<string> {
    this.logger.log(`[Manager] Preparing local repository: ${repoName} (branch: ${headRef})`);
    const start = Date.now();
    
    const appConfig = this.config.getAppConfig();
    const workspaceDir = appConfig.workspaceDir;
    const repoDir = path.join(workspaceDir, repoName.replace('/', '-'));

    await fs.ensureDir(workspaceDir);

    if (await fs.pathExists(repoDir)) {
      if (await this.isShallowRepository(repoDir)) {
        this.logger.warn(`[Manager] Existing repository is shallow, recreating full clone at ${repoDir}`);
        await fs.remove(repoDir);
        await this.cloneRepository(repoName, repoDir);
      } else {
        this.logger.debug(`[Manager] Updating existing repository at ${repoDir}`);
        await this.github.execaVerbose('git', ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], { cwd: repoDir });
        await this.github.execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
      }
    } else {
      await this.cloneRepository(repoName, repoDir);
    }

    // Force cleanup of any pending merge/conflict states before checkout
    this.logger.debug(`[Manager] Ensuring clean state at ${repoDir}`);
    await this.github.execaVerbose('git', ['merge', '--abort'], { cwd: repoDir, allowFail: true });
    await this.github.execaVerbose('git', ['am', '--abort'], { cwd: repoDir, allowFail: true });
    await this.github.execaVerbose('git', ['rebase', '--abort'], { cwd: repoDir, allowFail: true });
    await this.github.execaVerbose('git', ['reset', '--hard', 'HEAD'], { cwd: repoDir, allowFail: true });

    this.logger.debug(`[Manager] Checking out branch: ${headRef}`);
    try {
      await this.github.execaVerbose('git', ['checkout', headRef], { cwd: repoDir });
      await this.github.execaVerbose('git', ['reset', '--hard', `origin/${headRef}`], { cwd: repoDir, allowFail: true });
      await this.github.execaVerbose('git', ['clean', '-fd'], { cwd: repoDir, allowFail: true });
    } catch (e) {
      this.logger.warn(`[Manager] Checkout failed, trying fetch fallback: ${e.message}`);
      const fetchTarget = prNumber ? `pull/${prNumber}/head` : headRef;
      await this.github.execaVerbose('git', ['fetch', 'origin', fetchTarget], { cwd: repoDir });
      await this.github.execaVerbose('git', ['checkout', '-B', headRef, 'FETCH_HEAD'], { cwd: repoDir });
    }

    this.logger.log(`[Manager] Repository ready in ${Date.now() - start}ms`);
    return repoDir;
  }

  private async cloneRepository(repoName: string, repoDir: string): Promise<void> {
    this.logger.log(`[Manager] Cloning repository ${repoName} into ${repoDir}`);
    await this.github.execaVerbose('git', ['clone', `git@github.com:${repoName}.git`, repoDir]);
  }

  private async isShallowRepository(repoDir: string): Promise<boolean> {
    try {
      const { stdout } = await this.github.execaVerbose('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: repoDir,
        silent: true,
      });

      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }
}
