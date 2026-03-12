import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('repositories')
@Index(['owner', 'name'], { unique: true })
export class Repository {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer', { default: 0 })
  githubRepoId: number;

  @Column('varchar')
  owner: string;

  @Column('varchar')
  name: string;

  @Column('varchar')
  fullName: string;

  @Column('varchar', { nullable: true })
  defaultBranch: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
