import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CapacityPlannerService {
  private readonly logger = new Logger(CapacityPlannerService.name);

  async calculateCapacity(teamSize: number, avgReviewTimeMs: number): Promise<number> {
    // Basic calculation: capacity = teamSize * hoursPerDay / avgReviewTimeHours
    const hoursPerDay = 6; // Productive hours
    const avgReviewTimeHours = avgReviewTimeMs / (1000 * 60 * 60);
    
    if (avgReviewTimeHours === 0) return teamSize * 5; // Fallback
    
    return Math.floor((teamSize * hoursPerDay) / avgReviewTimeHours);
  }
}
