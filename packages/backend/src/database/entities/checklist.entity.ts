import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import { ChecklistItem } from './checklist-item.entity.js';

@Entity('checklists')
export class Checklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  repositoryId: string | null;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ChecklistItem, (item) => item.checklist)
  items: Relation<ChecklistItem>[];
}
