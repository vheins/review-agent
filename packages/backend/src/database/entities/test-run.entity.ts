import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('test_runs')
export class TestRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer')
  prNumber: number;

  @Column('varchar')
  repository: string;

  @Column('varchar')
  runType: string;

  @Column('varchar')
  status: string;

  @Column('simple-json', { nullable: true })
  testResults: any;

  @Column('simple-json', { nullable: true })
  failuresDetected: any;

  @CreateDateColumn()
  startedAt: Date;

  @Column('datetime', { nullable: true })
  completedAt: Date | null;

  @Column('integer', { nullable: true })
  durationSeconds: number | null;
}
