import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  type Relation,
} from 'typeorm';
import { MissionSession } from './mission-session.entity.js';

@Entity('session_ledger_entries')
export class SessionLedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column('text')
  sessionId: string;

  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column('varchar')
  actor: string;

  @Column('text')
  description: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any | null;

  @Index()
  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @ManyToOne(() => MissionSession)
  @JoinColumn({ name: 'sessionId' })
  session: Relation<MissionSession>;
}
