import { Controller, Get, Post, Put, Param, Body, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';
import { AssignmentEngineService } from './services/assignment-engine.service.js';

@Controller('team')
export class TeamController {
  constructor(
    @InjectRepository(DeveloperMetrics)
    private readonly devRepo: Repository<DeveloperMetrics>,
    @InjectRepository(SecurityFinding)
    private readonly securityRepo: Repository<SecurityFinding>,
    private readonly assignmentEngine: AssignmentEngineService,
  ) {}

  @Get('security')
  async getSecurity() {
    try {
      const developers = await this.devRepo.find();
      const securityFindings = await this.securityRepo.find({ 
        order: { detectedAt: 'DESC' }, 
        take: 20,
        relations: ['pullRequest']
      });
      
      return {
        data: {
          developers,
          securityFindings,
          recentAlerts: [],
        }
      };
    } catch (error) {
      console.error('[TeamController] Error in getSecurity:', error);
      throw error;
    }
  }

  @Get('workload')
  async getWorkload() {
    return this.devRepo.find({
      select: ['username', 'reviewedPrs', 'rankingPoints'],
    });
  }

  @Post('assign')
  async assignReviewers(@Body() payload: { repoName: string, prNumber: number, files: string[], author: string }) {
    const assigned = await this.assignmentEngine.suggestReviewers(
      payload.repoName,
      payload.prNumber,
      payload.files,
      payload.author
    );
    return { assigned_ids: assigned };
  }

  @Put('developers/:id/availability')
  async setAvailability(
    @Param('id') id: string,
    @Body() payload: { is_available: boolean, unavailable_until?: string }
  ) {
    // In a real app, we would update the developer's availability in the DB
    this.assignmentEngine.setAvailability(id, payload.is_available, payload.unavailable_until);
    return { status: 'updated' };
  }
}
