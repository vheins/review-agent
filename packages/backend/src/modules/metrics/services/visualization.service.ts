import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../metrics.service.js';
import { RejectionCategorizerService } from '../../review/services/rejection-categorizer.service.js';

@Injectable()
export class VisualizationService {
  private readonly logger = new Logger(VisualizationService.name);

  constructor(
    private readonly metricsService: MetricsService,
    private readonly rejectionCategorizer: RejectionCategorizerService,
  ) {}

  async formatTimeSeriesData(filters: any = {}) {
    // Simulation: in real app, fetch bucketed data
    return {
      labels: ['2026-03-01', '2026-03-02', '2026-03-03'],
      datasets: [
        {
          label: 'Average Health Score',
          data: [85, 90, 88],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  }

  async formatApprovalRatesBarChart(filters: any = {}) {
    // In a real app, calculate from reviews
    return {
      labels: ['Approved', 'Rejected', 'Needs Changes'],
      datasets: [
        {
          label: 'PR Outcomes',
          data: [15, 2, 5],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 206, 86, 0.6)'
          ]
        }
      ]
    };
  }

  async formatRejectionReasonsPieChart(filters: any = {}) {
    const frequencies = await this.rejectionCategorizer.getRejectionFrequencies(filters);
    
    const labels = Object.keys(frequencies);
    const data = Object.values(frequencies);
    
    const colorMap: Record<string, string> = {
      security: 'rgba(255, 99, 132, 0.6)',
      quality: 'rgba(54, 162, 235, 0.6)',
      testing: 'rgba(255, 206, 86, 0.6)',
      documentation: 'rgba(75, 192, 192, 0.6)',
      other: 'rgba(153, 102, 255, 0.6)'
    };
    
    const backgroundColor = labels.map(label => colorMap[label] || 'rgba(201, 203, 207, 0.6)');
    
    return {
      labels,
      datasets: [
        {
          label: 'Rejection Reasons',
          data,
          backgroundColor
        }
      ]
    };
  }
}
