import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, type Relation } from 'typeorm';
import { OrchestrationSet } from './orchestration-set.entity.js';
import { PullRequest } from './pull-request.entity.js';

@Entity('orchestration_set_members')
export class OrchestrationSetMember {
  @PrimaryColumn('text', { name: 'set_id' })
  setId: string;

  @PrimaryColumn('integer', { name: 'pr_id' })
  prId: number;

  @Column('integer', { name: 'dependency_pr_id', nullable: true })
  dependencyPrId: number;

  @ManyToOne(() => OrchestrationSet, set => set.members)
  @JoinColumn({ name: 'set_id' })
  set: Relation<OrchestrationSet>;

  @ManyToOne(() => PullRequest)
  @JoinColumn({ name: 'pr_id' })
  pullRequest: Relation<PullRequest>;
}
