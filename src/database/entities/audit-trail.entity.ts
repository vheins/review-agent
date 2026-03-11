import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_trail')
export class AuditTrail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column('varchar')
  actionType: string;

  @Column('varchar')
  actorType: string;

  @Column('varchar')
  actorId: string;

  @Column('varchar')
  resourceType: string;

  @Column('varchar')
  resourceId: string;

  @Column('simple-json')
  actionDetails: any;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;
}
