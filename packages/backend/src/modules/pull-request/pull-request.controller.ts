import { Controller, Get, Post, Param, Query, ParseIntPipe, Body } from '@nestjs/common';
import { PullRequestService } from './pull-request.service.js';
import { sanitizeHtml } from '../../common/utils/sanitization.util.js';

@Controller('prs')
export class PullRequestController {
  constructor(private readonly prService: PullRequestService) {}

  @Get()
  async list() {
    const prs = await this.prService.findAll();
    return { prs };
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
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.findOne(repoName, number);
  }

  @Post(':repo/:number/review')
  async review(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    const success = await this.prService.triggerReview(repoName, number);
    return { success };
  }

  @Get(':repo/:number/health')
  async getHealth(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.calculateHealth(repoName, number);
  }

  @Get(':repo/:number/history')
  async getHistory(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.getHistory(repoName, number);
  }
}
