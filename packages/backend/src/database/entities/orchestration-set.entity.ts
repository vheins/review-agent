import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { OrchestrationSetMember } from './orchestration-set-member.entity.js';

@Entity('orchestration_sets')
export class OrchestrationSet {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { default: 'pending' })
  status: string; // pending, in_progress, completed, failed

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column('datetime', { name: 'completed_at', nullable: true })
  completedAt: Date;

  @OneToMany(() => OrchestrationSetMember, member => member.set)
  members: OrchestrationSetMember[];
}
