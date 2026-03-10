import { metricsEngine } from './metrics-engine.js';
import { rejectionCategorizer } from './rejection-categorizer.js';

export class VisualizationFormatter {
  constructor() {}

  async formatTimeSeriesData(metricType = 'review_duration', granularity = 'day', filters = {}) {
    const data = await metricsEngine.getMetricsByTimeBucket(granularity, filters);
    
    // Format for charting libraries like Chart.js or Recharts
    // Returns { labels: ['2023-01-01', ...], datasets: [{ label: 'Average Duration', data: [100, ...] }] }
    
    const labels = data.map(d => d.bucket);
    const values = data.map(d => d.avg_duration);
    
    return {
      labels,
      datasets: [
        {
          label: metricType === 'review_duration' ? 'Average Review Duration (s)' : metricType,
          data: values,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }
      ]
    };
  }

  async formatApprovalRatesBarChart(filters = {}) {
    const stats = await metricsEngine.calculateMetrics(filters);
    if (!stats) return null;
    
    return {
      labels: ['Approved', 'Rejected', 'Needs Changes'],
      datasets: [
        {
          label: 'PR Outcomes',
          data: [stats.approved_count || 0, stats.rejected_count || 0, stats.needs_changes_count || 0],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)', // Green
            'rgba(255, 99, 132, 0.6)',  // Red
            'rgba(255, 206, 86, 0.6)'   // Yellow
          ]
        }
      ]
    };
  }

  async formatRejectionReasonsPieChart(filters = {}) {
    const frequencies = await rejectionCategorizer.getRejectionFrequencies(filters);
    
    const labels = Object.keys(frequencies);
    const data = Object.values(frequencies);
    
    // Default colors for predefined categories
    const colorMap = {
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

export const visualizationFormatter = new VisualizationFormatter();
export default visualizationFormatter;
