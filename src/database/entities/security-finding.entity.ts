import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PullRequest } from './pull-request.entity.js';

@Entity('security_findings')
export class SecurityFinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('integer')
  prNumber: number;

  @Column('varchar')
  repository: string;

  @Column('varchar')
  findingType: string;

  @Column('varchar')
  severity: string;

  @Column('varchar')
  title: string;

  @Column('text')
  description: string;

  @Column('varchar')
  filePath: string;

  @Column({ type: 'integer', nullable: true })
  lineNumber: number | null;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @CreateDateColumn({ name: 'detected_at' })
  detectedAt: Date;

  @ManyToOne(() => PullRequest, pr => pr.reviews, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'pr_number', referencedColumnName: 'number' },
    { name: 'repository', referencedColumnName: 'repository' }
  ])
  pullRequest?: PullRequest;
}
