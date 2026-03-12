import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { PullRequest } from './pull-request.entity.js';
import { MissionStep } from './mission-step.entity.js';

@Entity('mission_sessions')
export class MissionSession {
  @PrimaryColumn('text')
  id: string;

  @Column('integer')
  prNumber: number;

  @Column('varchar')
  repository: string;

  @Column({ name: 'runbook_type', type: 'varchar' })
  runbookType: string;

  @Column('varchar')
  status: string;

  @Column({ name: 'current_role', type: 'varchar', nullable: true })
  currentRole: string | null;

  @Column({ name: 'current_step_id', type: 'varchar', nullable: true })
  currentStepId: string | null;

  @Column({ name: 'operation_mode', type: 'varchar' })
  operationMode: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any | null;

  @ManyToOne(() => PullRequest)
  @JoinColumn({ name: 'prNumber', referencedColumnName: 'number' })
  pullRequest: Relation<PullRequest>;

  @OneToMany(() => MissionStep, step => step.session)
  steps: Relation<MissionStep>[];
}
