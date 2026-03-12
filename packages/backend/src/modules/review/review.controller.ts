import { Controller, Get, Post, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewEngineService } from './review-engine.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { GitHubClientService } from '../github/github.service.js';
import { sanitizeHtml, sanitizeObject } from '../../common/utils/sanitization.util.js';

@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewEngine: ReviewEngineService,
    private readonly github: GitHubClientService,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
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
    this.reviewEngine.runOnce();
    return { message: 'Review engine started in once mode' };
  }
}
