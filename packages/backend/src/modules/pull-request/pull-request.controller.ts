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

  @Post()
  async create(@Body() data: any) {
    const { repository, ...prData } = data;
    const repoName = sanitizeHtml(repository).replace('-', '/');
    return this.prService.createPR(repoName, prData);
  }

  @Get(':repo/:number')
  async findOne(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.findOne(repoName, number);
  }

  @Get('id/:id')
  async findById(@Param('id') id: string) {
    return this.prService.findOne(id);
  }

  @Post(':repo/:number')
  async update(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Body() data: any
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.updatePR(repoName, number, data);
  }

  @Get(':repo/:number/commits')
  async getCommits(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.listCommits(repoName, number);
  }

  @Get(':repo/:number/files')
  async getFiles(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.listFiles(repoName, number);
  }

  @Post(':repo/:number/update-branch')
  async updateBranch(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Body('expected_head_sha') expectedHeadSha?: string
  ) {
    const repoName = sanitizeHtml(repo).replace('-', '/');
    return this.prService.updateBranch(repoName, number, expectedHeadSha);
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
