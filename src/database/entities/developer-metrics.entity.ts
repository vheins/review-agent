import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * DeveloperMetrics Entity
 * 
 * Represents aggregated metrics for a developer.
 * This entity stores statistics about a developer's PRs and review performance.
 * 
 * Table: developer_metrics
 */
@Entity('developer_metrics')
export class DeveloperMetrics {
  @PrimaryColumn('varchar')
  username: string;

  @Column({ name: 'total_prs', type: 'integer' })
  totalPrs: number;

  @Column({ name: 'reviewed_prs', type: 'integer' })
  reviewedPrs: number;

  @Column({ name: 'average_health_score', type: 'real' })
  averageHealthScore: number;

  @Column({ name: 'average_quality_score', type: 'real' })
  averageQualityScore: number;

  @Column({
    name: 'issues_found',
    type: 'simple-json',
  })
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
  };

  @Column({ name: 'average_review_time', type: 'integer' })
  averageReviewTime: number;

  @Column({ name: 'last_review_at', type: 'datetime', nullable: true })
  lastReviewAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
