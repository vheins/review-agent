import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
  type Relation,
} from 'typeorm';
import { Review } from './review.entity.js';

/**
 * PullRequest Entity
 * 
 * Represents a GitHub Pull Request in the database with full synchronization
 * matching the GitHub REST API v3 schema.
 */
@Entity('pull_requests')
export class PullRequest {
  @PrimaryColumn('varchar')
  id: string; // GitHub Node ID (e.g. PR_kw...)

  @Index()
  @Column('integer', { nullable: true })
  github_id: number | null; // GitHub's numeric database ID

  @Index()
  @Column('integer')
  number: number; // The PR number within the repository

  @Column('varchar')
  node_id: string;

  @Column('varchar')
  title: string;

  @Column('varchar')
  author: string; // user.login

  @Column('integer', { nullable: true })
  author_id: number; // user.id

  @Index()
  @Column('varchar')
  repository: string; // owner/repo format

  @Column('text', { nullable: true })
  body: string | null;

  @Column('varchar')
  state: string; // 'open' or 'closed'

  @Column('varchar')
  status: string; // legacy status mapping, usually matches state

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  locked: boolean;

  @Column('varchar', { nullable: true })
  active_lock_reason: string | null;

  @Column({ name: 'is_draft', type: 'boolean', default: false })
  isDraft: boolean; // Maps to 'draft' in API

  @Column('varchar')
  url: string; // html_url

  @Column('varchar', { nullable: true })
  diff_url: string | null;

  @Column('varchar', { nullable: true })
  patch_url: string | null;

  // Refs & SHAs
  @Column('varchar')
  branch: string; // head.ref

  @Column('varchar')
  head_sha: string; // head.sha

  @Column({ name: 'base_branch', type: 'varchar' })
  baseBranch: string; // base.ref

  @Column('varchar')
  base_sha: string; // base.sha

  @Column('varchar', { nullable: true })
  merge_commit_sha: string | null;

  // Merge Status
  @Column('boolean', { default: false })
  merged: boolean;

  @Column('boolean', { nullable: true })
  mergeable: boolean | null;

  @Column('varchar', { nullable: true })
  mergeable_state: string | null; // e.g., 'clean', 'blocked', 'unstable'

  @Column('varchar', { nullable: true })
  merged_by: string | null; // merged_by.login

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  closed_at: Date | null;

  @Column({ type: 'datetime', nullable: true })
  merged_at: Date | null;

  // Collections & Metadata
  @Column('simple-json')
  labels: string[]; // array of label names

  @Column('simple-json', { nullable: true })
  requested_reviewers: string[] | null; // array of logins

  @Column('varchar', { nullable: true })
  milestone: string | null; // milestone.title

  @Column('simple-json', { nullable: true })
  auto_merge: any | null; // Store full auto_merge object if present

  // Stats
  @Column('integer', { default: 0 })
  commits_count: number;

  @Column('integer', { default: 0 })
  additions: number;

  @Column('integer', { default: 0 })
  deletions: number;

  @Column('integer', { default: 0 })
  changed_files: number;

  @Column('integer', { default: 0 })
  comments_count: number;

  @Column('integer', { default: 0 })
  review_comments_count: number;

  // Technical Lead Insights (Custom fields for the agent)
  @Column({ type: 'text', nullable: true })
  lead_summary: string | null;

  @Column({ type: 'integer', default: 0 })
  risk_score: number;

  @Column({ type: 'integer', default: 0 })
  impact_score: number;

  @Column({ type: 'integer', default: 0 })
  priority_score: number;

  @Column({ type: 'varchar', nullable: true })
  pr_category: string | null; // e.g., 'feature', 'bugfix', 'refactor', 'security'

  @OneToMany(() => Review, review => review.pullRequest)
  reviews: Relation<Review>[];
}
