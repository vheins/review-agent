import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('error_logs')
export class ErrorLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  code: string;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  stackTrace: string | null;

  @Column('varchar')
  severity: string;

  @Column('simple-json', { nullable: true })
  context: any;

  @Column('varchar', { nullable: true })
  requestPath: string | null;

  @Column('varchar', { nullable: true })
  requestMethod: string | null;

  @Column('varchar', { nullable: true })
  actorId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
