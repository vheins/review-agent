import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('custom_rules')
export class CustomRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  repository: string;

  @Column('varchar')
  ruleName: string;

  @Column('varchar')
  ruleType: 'regex' | 'ast';

  @Column('text')
  pattern: string;

  @Column('varchar')
  severity: string;

  @Column('text')
  message: string;

  @Column('boolean', { default: false })
  autoFixable: boolean;

  @Column('text', { nullable: true })
  autoFixTemplate: string | null;

  @Column('boolean', { default: true })
  enabled: boolean;

  @Column('simple-json', { nullable: true })
  branchPatterns: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
