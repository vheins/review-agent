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
 * This entity stores PR metadata and has a one-to-many relationship with Review entities.
 * 
 * Table: pull_requests
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

  @OneToMany(() => Review, review => review.pullRequest)
  reviews: Relation<Review>[];
}
