import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperMetrics } from '../../database/entities/developer-metrics.entity.js';
import { SecurityFinding } from '../../database/entities/security-finding.entity.js';

@Controller('team')
export class TeamController {
  constructor(
    @InjectRepository(DeveloperMetrics)
    private readonly devRepo: Repository<DeveloperMetrics>,
    @InjectRepository(SecurityFinding)
    private readonly securityRepo: Repository<SecurityFinding>,
  ) {}

  @Get('security')
  async getSecurity() {
    const developers = await this.devRepo.find();
    const securityFindings = await this.securityRepo.find({ order: { detectedAt: 'DESC' }, take: 20 });
    
    return {
      data: {
        developers,
        securityFindings,
        recentAlerts: [],
      }
    };
  }

  @Post('availability')
  async setAvailability(@Body() payload: any) {
    // Mock implementation
    return { success: true };
  }
}
