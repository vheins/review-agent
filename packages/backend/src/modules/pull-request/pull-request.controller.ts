import { Controller, Get, Post, Param, Query, ParseIntPipe, Body } from '@nestjs/common';
import { PullRequestService } from './pull-request.service.js';
import { sanitizeHtml } from '../../common/utils/sanitization.util.js';

@Controller('prs')
export class PullRequestController {
  constructor(private readonly prService: PullRequestService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    
    return this.prService.findAll(pageNum, limitNum);
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
