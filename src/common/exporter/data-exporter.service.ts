import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Parser } from 'json2csv';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../../config/app-config.service.js';

/**
 * DataExporterService - Service for exporting application data
 * 
 * Features:
 * - Export to CSV and JSON formats
 * - File system storage with expiration
 * - Support for repository-specific exports
 * 
 * Requirements: 15.1, 15.2, 15.3
 */
@Injectable()
export class DataExporterService {
  private readonly logger = new Logger(DataExporterService.name);
  private readonly exportDir: string;

  constructor(private readonly config: AppConfigService) {
    const appConfig = this.config.getAppConfig();
    this.exportDir = path.join(appConfig.workspaceDir, 'exports');
    fs.ensureDirSync(this.exportDir);
  }

  /**
   * Export data to a file
   * 
   * @param data - Array of objects to export
   * @param resourceType - Name of the resource (e.g., 'metrics', 'reviews')
   * @param format - Export format ('csv' or 'json')
   * @returns Metadata about the exported file
   */
  async exportData(data: any[], resourceType: string, format: 'csv' | 'json' = 'csv'): Promise<{ id: string; fileName: string; filePath: string }> {
    const id = uuidv4();
    const fileName = `${resourceType}-${id}.${format}`;
    const filePath = path.join(this.exportDir, fileName);
    
    let content: string;
    
    try {
      if (format === 'json') {
        content = JSON.stringify(data, null, 2);
      } else {
        const parser = new Parser();
        content = data.length > 0 ? parser.parse(data) : '';
      }

      await fs.writeFile(filePath, content);
      this.logger.log(`Exported ${data.length} items to ${filePath}`);
      
      return { id, fileName, filePath };
    } catch (error) {
      this.logger.error(`Failed to export data: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clean up exports older than specified days
   */
  async cleanupOldExports(days: number = 7): Promise<number> {
    if (!(await fs.pathExists(this.exportDir))) return 0;

    const files = await fs.readdir(this.exportDir);
    const now = Date.now();
    const threshold = days * 24 * 60 * 60 * 1000;
    let count = 0;

    for (const file of files) {
      const filePath = path.join(this.exportDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > threshold) {
        await fs.remove(filePath);
        count++;
      }
    }

    if (count > 0) {
      this.logger.log(`Cleaned up ${count} old export files`);
    }
    
    return count;
  }
}
