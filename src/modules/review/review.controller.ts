import { Controller, Get, Post, Param, Query, Body, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity.js';
import { ReviewEngineService } from './review-engine.service.js';

@Controller('api/reviews')
export class ReviewController {
  constructor(
    private readonly reviewEngine: ReviewEngineService,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  @Get()
  async findAll(@Query('repo') repo?: string) {
    const where = repo ? { repository: repo } : {};
    return this.reviewRepository.find({
      where,
      order: { startedAt: 'DESC' },
      relations: ['pullRequest'],
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['pullRequest', 'comments', 'metrics'],
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  @Post('run-once')
  async runOnce() {
    // Fire and forget or await? Usually fire and forget for background tasks
    // but for API it might be better to return a status
    this.reviewEngine.runOnce();
    return { message: 'Review engine started in once mode' };
  }
}
