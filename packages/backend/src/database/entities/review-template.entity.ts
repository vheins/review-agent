import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('review_templates')
export class ReviewTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar')
  name: string;

  @Column('varchar')
  category: string;

  @Column('text')
  templateText: string;

  @Column('simple-json', { nullable: true })
  placeholders: string[] | null;

  @Column('integer', { default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
