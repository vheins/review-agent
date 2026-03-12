import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { PullRequest } from './pull-request.entity.js';

@Entity('queue_scores')
export class QueueScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer')
  prNumber: number;

  @Column('varchar')
  repository: string;

  @Column('real')
  totalScore: number;

  @Column({ name: 'factor_age', type: 'real', default: 0 })
  factorAge: number;

  @Column({ name: 'factor_sla', type: 'real', default: 0 })
  factorSla: number;

  @Column({ name: 'factor_severity', type: 'real', default: 0 })
  factorSeverity: number;

  @Column({ name: 'factor_blocking', type: 'real', default: 0 })
  factorBlocking: number;

  @Column({ name: 'factor_criticality', type: 'real', default: 0 })
  factorCriticality: number;

  @Column({ name: 'factor_health', type: 'real', default: 0 })
  factorHealth: number;

  @Column({ name: 'factor_memory', type: 'real', default: 0 })
  factorMemory: number;

  @UpdateDateColumn({ name: 'calculated_at' })
  calculatedAt: Date;

  @OneToOne(() => PullRequest)
  @JoinColumn({ name: 'prNumber', referencedColumnName: 'number' })
  pullRequest: Relation<PullRequest>;
}
