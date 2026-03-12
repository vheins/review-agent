import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('repository_memory_entries')
export class RepositoryMemoryEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer')
  repositoryId: number;

  @Column({ name: 'memory_type', type: 'varchar' })
  memoryType: string;

  @Column('text')
  content: string;

  @Column({ type: 'real', default: 1.0 })
  importance: number;

  @CreateDateColumn({ name: 'last_observed_at' })
  lastObservedAt: Date;

  @Column({ name: 'observed_count', type: 'integer', default: 1 })
  observedCount: number;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: any | null;
}
