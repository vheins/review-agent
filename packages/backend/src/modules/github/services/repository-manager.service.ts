import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { Repository } from '../../../database/entities/repository.entity.js';
import { GitHubClientService } from '../github.service.js';

@Injectable()
export class RepositoryManagerService {
  private readonly logger = new Logger(RepositoryManagerService.name);

  constructor(
    private readonly github: GitHubClientService,
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
}
