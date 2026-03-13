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
    this.logger.log('Syncing repositories from open PRs...');
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

    this.logger.log(`Synced ${syncedRepos.length} repositories`);
    return syncedRepos;
  }

  async getRepository(id: number): Promise<Repository | null> {
    return this.repoRepository.findOne({ where: { id } });
  }

  async getAllRepositories(): Promise<Repository[]> {
    return this.repoRepository.find({ order: { fullName: 'ASC' } });
  }

  /**
   * Prepare repository locally for review (clone/fetch and checkout)
   */
  async prepareRepository(repoName: string, headRef: string, baseRef: string): Promise<string> {
    const appConfig = this.config.getAppConfig();
    const workspaceDir = appConfig.workspaceDir;
    const repoDir = path.join(workspaceDir, repoName.replace('/', '-'));

    await fs.ensureDir(workspaceDir);

    if (await fs.pathExists(repoDir)) {
      this.logger.log(`Updating existing repository: ${repoDir}`);
      await this.github.execaVerbose('git', ['fetch', 'origin'], { cwd: repoDir });
    } else {
      this.logger.log(`Cloning repository into: ${repoDir}`);
      await this.github.execaVerbose('gh', ['repo', 'clone', repoName, repoDir, '--', '--depth', '1']);
    }

    this.logger.log(`Checking out PR branch: ${headRef}`);
    try {
      await this.github.execaVerbose('git', ['checkout', headRef], { cwd: repoDir });
      await this.github.execaVerbose('git', ['pull', 'origin', headRef], { cwd: repoDir, allowFail: true });
    } catch (e) {
      // Fallback for cases where branch might not be local yet
      await this.github.execaVerbose('git', ['fetch', 'origin', `${headRef}:${headRef}`], { cwd: repoDir });
      await this.github.execaVerbose('git', ['checkout', headRef], { cwd: repoDir });
    }

    return repoDir;
  }
}
