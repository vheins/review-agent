import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer')
  recipientId: number;

  @Column('varchar')
  notificationType: string;

  @Column('varchar')
  title: string;

  @Column('text')
  message: string;

  @Column('varchar', { default: 'normal' })
  priority: string;

  @Column('simple-json', { nullable: true })
  data: any;

  @Column('boolean', { default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column('datetime', { nullable: true })
  sentAt: Date | null;
}
