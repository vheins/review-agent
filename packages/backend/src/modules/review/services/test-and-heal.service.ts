import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestRun } from '../../../database/entities/test-run.entity.js';
import { GitHubClientService } from '../../github/github.service.js';

@Injectable()
export class TestAndHealService {
  private readonly logger = new Logger(TestAndHealService.name);

  constructor(
    @InjectRepository(TestRun)
    private readonly testRunRepository: Repository<TestRun>,
    private readonly github: GitHubClientService,
  ) {}

  async runTests(repoDir: string, repository: string, prNumber: number, type = 'initial') {
    const startTime = new Date();
    this.logger.log(`Running tests for PR #${prNumber} in ${repository} (${type})...`);

    try {
      const { stdout, stderr, exitCode } = await this.github.execaVerbose('yarn', ['test'], { cwd: repoDir, allowFail: true });
      const endTime = new Date();
      const status = exitCode === 0 ? 'passed' : 'failed';

      const testRun = this.testRunRepository.create({
        prNumber,
        repository,
        runType: type,
        status,
        testResults: { stdout, stderr },
        startedAt: startTime,
        completedAt: endTime,
        durationSeconds: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
      });

      if (status === 'failed') {
        testRun.failuresDetected = this.parseFailures(stderr || stdout);
      }

      const savedRun = await this.testRunRepository.save(testRun);

      let healResult = null;
      if (status === 'failed' && type === 'initial') {
        const healable = testRun.failuresDetected?.some((f: any) => f.healable);
        if (healable) {
          healResult = await this.healFailures(repoDir, repository, prNumber, testRun.failuresDetected);
        }
      }

      return { testRunId: savedRun.id, status, healResult };
    } catch (e) {
      this.logger.error(`Test execution crashed: ${e.message}`);
      return null;
    }
  }

  private parseFailures(output: string) {
    const failures = [];
    
    if (output.includes('Module not found') || output.includes('Cannot find module')) {
      failures.push({ type: 'import_error', healable: true, message: 'Missing or incorrect import' });
    }
    
    if (output.includes('Snapshot mismatch') || output.includes('snapshot failed')) {
      failures.push({ type: 'snapshot_mismatch', healable: true, message: 'UI snapshots need update' });
    }

    if (output.includes('timeout') || output.includes('exceeded timeout')) {
      failures.push({ type: 'timeout', healable: false, message: 'Test timed out' });
    }

    return failures;
  }

  async healFailures(repoDir: string, repository: string, prNumber: number, failures: any[]) {
    this.logger.log(`Attempting to heal failures for PR #${prNumber}...`);
    let healed = false;

    for (const failure of failures) {
      if (failure.type === 'snapshot_mismatch') {
        this.logger.log('Healing: Updating snapshots...');
        await this.github.execaVerbose('yarn', ['test', '-u'], { cwd: repoDir, allowFail: true });
        healed = true;
      }
      
      if (failure.type === 'import_error') {
        this.logger.log('Healing: Running yarn install...');
        await this.github.execaVerbose('yarn', ['install'], { cwd: repoDir, allowFail: true });
        healed = true;
      }
    }

    if (healed) {
      return await this.runTests(repoDir, repository, prNumber, 'post_heal');
    }

    return null;
  }
}
