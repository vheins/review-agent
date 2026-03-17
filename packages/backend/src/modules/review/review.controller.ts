import { Controller, Get, Post, Param, Query, Body, NotFoundException, ParseIntPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { Comment } from '../../database/entities/comment.entity.js';
import { ReviewEngineService } from './review-engine.service.js';
import { RuleEngineService } from './services/rule-engine.service.js';
import { FalsePositiveService } from './services/false-positive.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { GitHubClientService } from '../github/github.service.js';
import { sanitizeHtml, sanitizeObject } from '../../common/utils/sanitization.util.js';

@Controller('reviews')
export class ReviewController {
  private isRunning = false;
  private stopRequested = false;

  constructor(
    private readonly reviewEngine: ReviewEngineService,
    private readonly ruleEngine: RuleEngineService,
    private readonly falsePositiveService: FalsePositiveService,
    private readonly github: GitHubClientService,
    private readonly dataSource: DataSource,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
  ) {}

  @Get()
  async findAll(@Query('repo') repo?: string) {
    const where = repo ? { repository: sanitizeHtml(repo) } : {};
    return this.reviewRepository.find({
      where,
      order: { startedAt: 'DESC' },
      relations: ['pullRequest'],
    });
  }

  @Get('status')
  async status() {
    return { isRunning: this.isRunning, stopRequested: this.stopRequested };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const review = await this.reviewRepository.findOne({
      where: { id: sanitizeHtml(id) },
      relations: ['pullRequest', 'comments', 'metrics'],
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  @Post()
  async create(@Body() createReviewDto: CreateReviewDto) {
    const sanitizedDto = sanitizeObject(createReviewDto);
    
    // Find PR metadata
    const prs = await this.github.fetchOpenPRs();
    const pr = prs.find(p => 
      p.number === sanitizedDto.prNumber && 
      p.repository.nameWithOwner === sanitizedDto.repository
    );

    if (!pr) {
      throw new NotFoundException(`Pull Request #${sanitizedDto.prNumber} not found in ${sanitizedDto.repository}`);
    }

    // Trigger review
    const success = await this.reviewEngine.reviewPullRequest(pr);
    return { success };
  }

  @Post('run-once')
  async runOnce() {
    if (this.isRunning) return { success: false, message: 'Already running' };
    this.reviewEngine.runOnce();
    return { success: true, message: 'Review engine started in once mode' };
  }

  @Post('run-all')
  async runAll() {
    if (this.isRunning) return { success: false, message: 'Already running' };
    this.isRunning = true;
    this.stopRequested = false;

    const REVIEW_INTERVAL = parseInt(process.env.REVIEW_INTERVAL || '600', 10);

    // Run in background (non-blocking)
    (async () => {
      while (!this.stopRequested) {
        try {
          await this.reviewEngine.runAll();
        } catch (e) {
          console.error('[ReviewController] Error during review run:', e.message);
        }
        if (this.stopRequested) break;
        // Wait interval in 1s ticks so stop can interrupt
        for (let i = 0; i < REVIEW_INTERVAL && !this.stopRequested; i++) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      this.isRunning = false;
    })();

    return { success: true, message: 'Continuous review started' };
  }

  @Post('stop')
  async stop() {
    this.stopRequested = true;
    return { success: true, message: 'Stop requested', wasRunning: this.isRunning };
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string) {
    // Note: implementation depends on if reviewEngine supports cancellation
    // For now we'll mock it or implement if available
    return { message: 'Cancellation requested', id };
  }

  @Get(':id/comments')
  async getComments(@Param('id') id: string) {
    return this.commentRepository.find({
      where: { reviewId: id }
    });
  }

  @Post('comments/:id/false-positive')
  async markFalsePositive(
    @Param('id') id: string,
    @Body('developer_id') developerId: number,
    @Body('justification') justification: string,
  ) {
    await this.falsePositiveService.markFalsePositive(id, developerId, justification);
    return { status: 'marked', id };
  }

  @Get('github/:repo/:number')
  async listGithubReviews(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = repo.replace('-', '/');
    return this.github.listReviews(repoName, number);
  }

  @Post('github/:repo/:number/:reviewId/submit')
  async submitGithubReview(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body() data: { event: string; body?: string }
  ) {
    const repoName = repo.replace('-', '/');
    return this.github.submitReview(repoName, number, reviewId, data.event, data.body);
  }

  @Post('github/:repo/:number/:reviewId/dismiss')
  async dismissGithubReview(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
    @Param('reviewId', ParseIntPipe) reviewId: number,
    @Body('message') message: string
  ) {
    const repoName = repo.replace('-', '/');
    return this.github.dismissReview(repoName, number, reviewId, message);
  }

  @Get('github/:repo/:number/comments')
  async listGithubReviewComments(
    @Param('repo') repo: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    const repoName = repo.replace('-', '/');
    return this.github.listReviewComments(repoName, number);
  }

  @Get('rules/:repo')
  async getRules(@Param('repo') repo: string) {
    const repoName = repo.replace('-', '/');
    return this.ruleEngine.loadRules(repoName);
  }

  @Post('rules/:repo')
  async createRule(@Param('repo') repo: string, @Body() ruleDto: any) {
    const repoName = repo.replace('-', '/');
    return { status: 'received', repository: repoName };
  }
}
