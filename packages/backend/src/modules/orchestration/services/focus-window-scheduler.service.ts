import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FocusWindow } from '../../../database/entities/focus-window.entity.js';

@Injectable()
export class FocusWindowSchedulerService {
  private readonly logger = new Logger(FocusWindowSchedulerService.name);

  constructor(
    @InjectRepository(FocusWindow)
    private readonly windowRepository: Repository<FocusWindow>,
  ) {}

  /**
   * Get active focus windows for a repository
   */
  async getActiveWindows(repositoryId?: number): Promise<FocusWindow[]> {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // This is simplified. Proper implementation would handle day of week, etc.
    const allWindows = await this.windowRepository.find({ where: { isActive: true } });
    
    return allWindows.filter(w => {
      const isRepoMatch = !w.repositoryId || w.repositoryId === repositoryId;
      if (!isRepoMatch) return false;

      // Basic time comparison (HH:MM)
      if (w.startTime <= w.endTime) {
        return currentTime >= w.startTime && currentTime <= w.endTime;
      } else {
        // Overlap midnight
        return currentTime >= w.startTime || currentTime <= w.endTime;
      }
    });
  }

  /**
   * Apply focus window overrides to a mission context
   */
  async getContextOverrides(repositoryId?: number): Promise<{ bias: number, runbook?: string, mode?: string }> {
    const activeWindows = await this.getActiveWindows(repositoryId);
    
    let bias = 1.0;
    let runbook: string | undefined;
    let mode: string | undefined;

    for (const window of activeWindows) {
      bias *= window.biasWeight;
      if (window.runbookOverride) runbook = window.runbookOverride;
      if (window.modeOverride) mode = window.modeOverride;
    }

    return { bias, runbook, mode };
  }
}
