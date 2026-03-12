import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { MissionSession } from './mission-session.entity.js';

@Entity('mission_steps')
export class MissionStep {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  sessionId: string;

  @Column('varchar')
  role: string;

  @Column({ name: 'step_name', type: 'varchar' })
  stepName: string;

  @Column('varchar')
  status: string;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any | null;

  @ManyToOne(() => MissionSession, session => session.steps)
  @JoinColumn({ name: 'sessionId' })
  session: Relation<MissionSession>;
}
