import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('exports')
export class Export {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar')
  filePath: string;

  @Column('varchar')
  fileType: string;

  @Column('varchar')
  resourceType: string;

  @Column('simple-json', { nullable: true })
  filters: any;

  @Column('varchar')
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column('datetime')
  expiresAt: Date;
}
