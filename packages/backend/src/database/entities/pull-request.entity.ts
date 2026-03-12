import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import { Review } from './review.entity.js';

/**
 * PullRequest Entity
 * 
 * Represents a GitHub Pull Request in the database.
 */
@Entity('pull_requests')
export class PullRequest {
  @PrimaryColumn('integer')
  number: number;

  @Column('varchar')
  title: string;

  @Column('varchar')
  author: string;

  @Column('varchar')
  repository: string;

  @Column('varchar')
  branch: string;

  @Column({ name: 'base_branch', type: 'varchar' })
  baseBranch: string;

  @Column('varchar')
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column('varchar')
  url: string;

  @Column({ name: 'is_draft', type: 'boolean' })
  isDraft: boolean;

  @Column('simple-json')
  labels: string[];

  // Technical Lead Insights
  @Column({ type: 'text', nullable: true })
  lead_summary: string | null;

  @Column({ type: 'integer', default: 0 })
  risk_score: number;

  @Column({ type: 'integer', default: 0 })
  impact_score: number;

  @Column({ type: 'varchar', nullable: true })
  pr_category: string | null; // e.g., 'feature', 'bugfix', 'refactor', 'security'

  @OneToMany(() => Review, review => review.pullRequest)
  reviews: Relation<Review>[];
}
