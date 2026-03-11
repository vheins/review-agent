import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Review } from './review.entity';

/**
 * ReviewMetrics Entity
 * 
 * Represents metrics collected during a review session.
 * This entity stores performance and quality metrics and has a one-to-one relationship with Review.
 * 
 * Table: review_metrics
 */
@Entity('review_metrics')
export class ReviewMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'review_id', type: 'varchar' })
  reviewId: string;

  @Column('integer')
  duration: number;

  @Column({ name: 'files_reviewed', type: 'integer' })
  filesReviewed: number;

  @Column({ name: 'comments_generated', type: 'integer' })
  commentsGenerated: number;

  @Column({
    name: 'issues_found',
    type: 'simple-json',
  })
  issuesFound: {
    bugs: number;
    security: number;
    performance: number;
    maintainability: number;
    architecture: number;
    testing: number;
  };

  @Column({ name: 'health_score', type: 'real' })
  healthScore: number;

  @Column({ name: 'quality_score', type: 'real' })
  qualityScore: number;

  @OneToOne(() => Review, review => review.metrics, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'review_id', referencedColumnName: 'id' })
  review?: Review;
}
