import { Controller, Get, Post, Param, ParseIntPipe, Query, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { MetricsService } from './metrics.service.js';
import { DataExporterService } from '../../common/exporter/data-exporter.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly dataExporter: DataExporterService,
    @InjectRepository(ReviewMetrics)
    private readonly reviewMetricsRepo: Repository<ReviewMetrics>,
    @InjectRepository(DeveloperMetrics)
    private readonly devMetricsRepo: Repository<DeveloperMetrics>,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: any) {
    return this.metricsService.calculateMetrics(query);
  }

  @Get('pr/:number')
  async getPrMetrics(@Param('number', ParseIntPipe) number: number) {
    // In a real app we'd join with pull_requests table
    return this.reviewMetricsRepo.find({
      where: { review: { prNumber: number } },
      relations: ['review'],
    });
  }

  @Get('developer/:username')
  async getDeveloperMetrics(@Param('username') username: string, @Query() query: any) {
    return this.metricsService.getDeveloperMetrics(username, query);
  }

  @Get('trends')
  async getTrends(@Query('metric_type') metricType: string, @Query('granularity') granularity: string, @Query() query: any) {
    // This would ideally be in metricsService
    return { metricType, granularity, data: [] };
  }

  @Post('export')
  async export(@Body() payload: { filters: any, format: 'csv' | 'json' }) {
    return this.dataExporter.exportMetrics(payload.filters, payload.format);
  }
}
