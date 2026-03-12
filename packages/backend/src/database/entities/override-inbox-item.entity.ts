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

@Entity('override_inbox_items')
export class OverrideInboxItem {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  sessionId: string;

  @Column('varchar')
  reason: string;

  @Column('varchar')
  status: string;

  @Column({ name: 'resolver_id', type: 'integer', nullable: true })
  resolverId: number | null;

  @Column({ name: 'resolution_action', type: 'varchar', nullable: true })
  resolutionAction: string | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any | null;

  @ManyToOne(() => MissionSession)
  @JoinColumn({ name: 'sessionId' })
  session: Relation<MissionSession>;
}
