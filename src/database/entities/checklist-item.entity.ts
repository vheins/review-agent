import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Checklist } from './checklist.entity.js';
import { ReviewChecklist } from './review-checklist.entity.js';

@Entity('checklist_items')
export class ChecklistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer')
  checklistId: number;

  @Column('text')
  itemText: string;

  @Column({ type: 'varchar', default: 'normal' })
  priority: string;

  @Column({ type: 'varchar', nullable: true })
  category: string;

  @ManyToOne(() => Checklist, (checklist) => checklist.items, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'checklist_id', referencedColumnName: 'id' })
  checklist?: Checklist;

  @OneToMany(() => ReviewChecklist, (rc) => rc.checklistItem)
  reviewChecklists: ReviewChecklist[];
}
