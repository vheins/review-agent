import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('focus_windows')
export class FocusWindow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'repository_id', type: 'integer', nullable: true })
  repositoryId: number | null;

  @Column('varchar')
  name: string;

  @Column({ name: 'start_time', type: 'varchar' })
  startTime: string;

  @Column({ name: 'end_time', type: 'varchar' })
  endTime: string;

  @Column({ name: 'bias_weight', type: 'real', default: 1.0 })
  biasWeight: number;

  @Column({ name: 'runbook_override', type: 'varchar', nullable: true })
  runbookOverride: string | null;

  @Column({ name: 'mode_override', type: 'varchar', nullable: true })
  modeOverride: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
