import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { PullRequest } from './pull-request.entity';
import { Comment } from './comment.entity';
import { ReviewMetrics } from './review-metrics.entity';

/**
 * Review Entity
 * 
 * Represents a code review session for a pull request.
 * This entity stores review metadata and has relationships with:
 * - PullRequest (many-to-one)
 * - Comment (one-to-many)
 * - ReviewMetrics (one-to-one)
 * 
 * Table: reviews
 */
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pr_number', type: 'integer' })
  prNumber: number;

  @Column('varchar')
  repository: string;

  @Column('varchar')
  status: string;

  @Column('varchar')
  mode: string;

  @Column('varchar')
  executor: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  // Relations - without JoinColumn to avoid FK constraints
  @ManyToOne(() => PullRequest, pr => pr.reviews, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'pr_number', referencedColumnName: 'number' })
  pullRequest?: PullRequest;

  @OneToMany(() => Comment, comment => comment.review)
  comments: Comment[];

  @OneToOne(() => ReviewMetrics, metrics => metrics.review)
  metrics: ReviewMetrics;
}
