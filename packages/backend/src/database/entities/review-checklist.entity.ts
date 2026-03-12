import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { Review } from './review.entity.js';
import { ChecklistItem } from './checklist-item.entity.js';

@Entity('review_checklists')
export class ReviewChecklist {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('uuid')
  reviewId: string;

  @Column('integer')
  checklistItemId: number;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  completedByDeveloperId: string | null;

  @Column('text', { nullable: true })
  notes: string;

  @ManyToOne(() => Review, (review) => review.comments, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'review_id', referencedColumnName: 'id' })
  review?: Relation<Review>;

  @ManyToOne(() => ChecklistItem, (item) => item.reviewChecklists, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'checklist_item_id', referencedColumnName: 'id' })
  checklistItem?: Relation<ChecklistItem>;
}
