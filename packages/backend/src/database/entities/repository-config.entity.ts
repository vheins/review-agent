import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

/**
 * RepositoryConfig Entity
 * 
 * Represents repository-specific configuration overrides.
 * This entity stores custom settings for each repository.
 * 
 * Table: repository_configs
 */
@Entity('repository_configs')
export class RepositoryConfig {
  @PrimaryColumn('varchar')
  repository: string;

  @Column('boolean')
  enabled: boolean;

  @Column({ name: 'review_mode', type: 'varchar' })
  reviewMode: string;

  @Column('varchar')
  executor: string;

  @Column({ name: 'scan_scope', type: 'varchar' })
  scanScope: string;

  @Column({ name: 'auto_merge', type: 'boolean' })
  autoMerge: boolean;

  @Column({
    name: 'protected_branches',
    type: 'simple-json',
  })
  protectedBranches: string[];

  @Column({
    name: 'exclude_patterns',
    type: 'simple-json',
  })
  excludePatterns: string[];

  @Column({ name: 'custom_prompt', type: 'text', nullable: true })
  customPrompt: string | null;

  @Column('integer')
  version: number;

  @Column({ name: 'criticality', type: 'real', default: 1.0 })
  criticality: number;

  @Column({ name: 'queue_weights', type: 'simple-json', nullable: true })
  queueWeights: {
    age?: number;
    sla?: number;
    severity?: number;
    blocking?: number;
    criticality?: number;
    health?: number;
    memory?: number;
  } | null;

  @Column({ name: 'confidence_thresholds', type: 'simple-json', nullable: true })
  confidenceThresholds: {
    fix?: number;
    merge?: number;
    resume?: number;
  } | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
