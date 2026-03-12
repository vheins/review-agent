import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { Review } from './review.entity.js';

/**
 * Comment Entity
 * 
 * Represents a review comment on a specific file and line.
 * This entity stores comment details and has a many-to-one relationship with Review.
 * 
 * Table: comments
 */
@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'review_id', type: 'varchar' })
  reviewId: string;

  @Column('varchar')
  file: string;

  @Column('integer')
  line: number;

  @Column('varchar')
  severity: string;

  @Column('varchar')
  category: string;

  @Column('text')
  message: string;

  @Column({ type: 'text', nullable: true })
  suggestion: string | null;

  @Column({ name: 'posted_at', type: 'datetime', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'github_thread_id', type: 'varchar', nullable: true })
  githubThreadId: string | null;

  @Column({ name: 'is_resolved', type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @ManyToOne(() => Review, review => review.comments, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'review_id', referencedColumnName: 'id' })
  review?: Relation<Review>;
}
