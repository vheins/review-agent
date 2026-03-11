import { registerAs } from '@nestjs/config';

/**
 * Review Configuration
 * 
 * Typed configuration for review settings including severity scoring.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */
export interface ReviewConfig {
  delegate: boolean;
  reviewMode: 'comment' | 'auto-fix';
  severityThreshold: number;
  severityCritical: number;
  severityHigh: number;
  severityMedium: number;
  severityLow: number;
}

export default registerAs('review', (): ReviewConfig => ({
  delegate: process.env.DELEGATE === 'true',
  reviewMode: (process.env.REVIEW_MODE || 'comment') as 'comment' | 'auto-fix',
  severityThreshold: parseInt(process.env.SEVERITY_THRESHOLD || '10', 10),
  severityCritical: parseInt(process.env.SEVERITY_CRITICAL || '5', 10),
  severityHigh: parseInt(process.env.SEVERITY_HIGH || '3', 10),
  severityMedium: parseInt(process.env.SEVERITY_MEDIUM || '2', 10),
  severityLow: parseInt(process.env.SEVERITY_LOW || '1', 10),
}));
