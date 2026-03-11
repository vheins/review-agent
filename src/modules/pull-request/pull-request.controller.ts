import { Controller, Get, Post, Param, Query, ParseIntPipe, Body } from '@nestjs/common';
import { PullRequestService } from './pull-request.service.js';

@Controller('api/prs')
export class PullRequestController {
  constructor(private readonly prService: PullRequestService) {}

  @Get()
  async list() {
    return this.prService.findAll();
  }

  @Get('scan')
  async scan() {
    return this.prService.scanAndSync();
  }

  @Get(':repo/:number')
  async findOne(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    // repo might be owner-repo, we need to convert back to owner/repo
    const repoName = repo.replace('-', '/');
    return this.prService.findOne(repoName, number);
  }

  @Post(':repo/:number/review')
  async review(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = repo.replace('-', '/');
    const success = await this.prService.triggerReview(repoName, number);
    return { success };
  }
}
