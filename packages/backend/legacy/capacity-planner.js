import { dbManager } from './database.js';

export class CapacityPlanner {
  constructor() {
    this.maxWorkloadPerDev = 100; // threshold for alerts
  }

  async calculateTeamCapacity() {
    if (!dbManager.isAvailable()) return null;

    const devs = dbManager.db.prepare(
      'SELECT id, is_available, current_workload_score FROM developers'
    ).all();

    let availableDevs = 0;
    let totalWorkload = 0;
    let maxTeamWorkload = 0;

    for (const dev of devs) {
      if (dev.is_available) {
        availableDevs++;
        totalWorkload += dev.current_workload_score;
        maxTeamWorkload += this.maxWorkloadPerDev;
      }
    }

    const capacityUtilization = maxTeamWorkload > 0 ? (totalWorkload / maxTeamWorkload) * 100 : 100;

    return {
      availableDevs,
      totalDevs: devs.length,
      totalWorkload,
      maxTeamWorkload,
      capacityUtilization,
      isOverCapacity: capacityUtilization > 90
    };
  }

  async predictCompletionTime(prId) {
    if (!dbManager.isAvailable()) return null;

    const pr = dbManager.db.prepare('SELECT created_at FROM pull_requests WHERE id = ?').get(prId);
    if (!pr) return null;

    const capacity = await this.calculateTeamCapacity();
    if (!capacity) return null;

    // Very basic prediction logic
    // Base completion time is 2 hours, adds more if capacity is high
    let predictedHours = 2;
    
    if (capacity.capacityUtilization > 50) {
      predictedHours += (capacity.capacityUtilization - 50) * 0.1; 
    }
    
    if (capacity.isOverCapacity) {
      predictedHours *= 1.5;
    }

    const predictedCompletionTime = new Date(pr.created_at);
    predictedCompletionTime.setHours(predictedCompletionTime.getHours() + predictedHours);

    return {
      predictedHours,
      predictedCompletionTime: predictedCompletionTime.toISOString()
    };
  }

  async checkCapacityAlerts() {
    const capacity = await this.calculateTeamCapacity();
    if (capacity && capacity.isOverCapacity) {
      const message = \`Team is over capacity (${capacity.capacityUtilization.toFixed(1)}% utilized). Available devs: \${capacity.availableDevs}. Please rebalance workload.\`;
      
      // We could store it in an admin notifications or system alerts table
      dbManager.db.prepare(\`
        INSERT INTO notifications (
          recipient_id, notification_type, title, message, priority, created_at
        ) SELECT id, 'capacity_alert', 'Team Over Capacity', ?, 'urgent', CURRENT_TIMESTAMP 
        FROM developers WHERE is_available = 1 LIMIT 1
      \`).run(message); // Send to an available dev or admin for now
      
      return true;
    }
    return false;
  }
}

export const capacityPlanner = new CapacityPlanner();
export default capacityPlanner;
