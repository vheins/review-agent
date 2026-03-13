import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import fs from 'fs-extra';
import * as path from 'path';
import { Parser } from 'json2csv';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../../config/app-config.service.js';
import { Export } from '../../database/entities/export.entity.js';
import { ReviewMetrics } from '../../database/entities/review-metrics.entity.js';
import { Review } from '../../database/entities/review.entity.js';

/**
 * DataExporterService - Service for exporting application data
 */
@Injectable()
export class DataExporterService implements OnModuleInit {
  private readonly logger = new Logger(DataExporterService.name);
  private exportDir: string;

  constructor(
    private readonly config: AppConfigService,
    @InjectRepository(Export)
    private readonly exportRepository: Repository<Export>,
    @InjectRepository(ReviewMetrics)
    private readonly metricsRepository: Repository<ReviewMetrics>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  onModuleInit() {
    try {
      const appConfig = this.config.getAppConfig();
      this.exportDir = path.join(appConfig.workspaceDir, 'exports');
      fs.ensureDirSync(this.exportDir);
    } catch (e) {
      this.logger.error(`Failed to initialize export directory: ${e.message}`);
      this.exportDir = path.join(process.cwd(), 'workspace', 'exports');
      fs.ensureDirSync(this.exportDir);
    }
  }

  async exportMetrics(filters: any = {}, format: 'csv' | 'json' = 'csv', userId = 'system') {
    const query = this.metricsRepository.createQueryBuilder('metrics');
    
    if (filters.startDate) {
      query.andWhere('metrics.recordedAt >= :start', { startDate: filters.startDate });
    }
    
    const data = await query.getMany();
    return this.saveExport(data, 'metrics', format, filters, userId);
  }

  async exportReviews(filters: any = {}, format: 'csv' | 'json' = 'csv', userId = 'system') {
    const query = this.reviewRepository.createQueryBuilder('review')
      .leftJoinAndSelect('review.pullRequest', 'pr');
    
    if (filters.repository) {
      query.andWhere('review.repository = :repo', { repository: filters.repository });
    }
    
    const data = await query.getMany();
    return this.saveExport(data, 'reviews', format, filters, userId);
  }

  async saveExport(data: any[], resourceType: string, format: 'csv' | 'json', filters: any, userId: string) {
    const id = uuidv4();
    const fileName = `${resourceType}-${id}.${format}`;
    const filePath = path.join(this.exportDir, fileName);
    
    let content: string;
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
    } else {
      const parser = new Parser();
      content = data.length > 0 ? parser.parse(data) : '';
    }

    await fs.writeFile(filePath, content);

    const exportEntry = this.exportRepository.create({
      id,
      filePath,
      fileType: format,
      resourceType,
      filters,
      createdBy: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.exportRepository.save(exportEntry);
    this.logger.log(`Exported ${data.length} items to ${filePath}`);
    
    return { id, fileName, filePath };
  }

  /**
   * Clean up exports older than specified days
   */
  async cleanupOldExports(): Promise<number> {
    const expired = await this.exportRepository.find({
      where: {
        expiresAt: LessThan(new Date())
      }
    });

    let count = 0;
    for (const item of expired) {
      if (await fs.pathExists(item.filePath)) {
        await fs.remove(item.filePath);
      }
      await this.exportRepository.remove(item);
      count++;
    }

    if (count > 0) {
      this.logger.log(`Cleaned up ${count} old export records and files`);
    }
    
    return count;
  }
}
