import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Checklist } from '../../database/entities/checklist.entity.js';
import { ChecklistItem } from '../../database/entities/checklist-item.entity.js';
import { ReviewChecklist } from '../../database/entities/review-checklist.entity.js';

@Injectable()
export class ChecklistService {
  private readonly logger = new Logger(ChecklistService.name);

  constructor(
    @InjectRepository(Checklist)
    private readonly checklistRepo: Repository<Checklist>,
    @InjectRepository(ChecklistItem)
    private readonly itemRepo: Repository<ChecklistItem>,
    @InjectRepository(ReviewChecklist)
    private readonly reviewChecklistRepo: Repository<ReviewChecklist>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createChecklist(repositoryId: string | null, name: string, description: string, items: any[] = []) {
    return this.dataSource.transaction(async (manager) => {
      const checklist = manager.create(Checklist, {
        repositoryId,
        name,
        description,
      });
      const savedChecklist = await manager.save(checklist);

      const checklistItems = items.map((item) =>
        manager.create(ChecklistItem, {
          checklistId: savedChecklist.id,
          itemText: item.text,
          priority: item.priority || 'normal',
          category: item.category,
        })
      );
      await manager.save(checklistItems);

      return savedChecklist.id;
    });
  }

  async getChecklistsForRepository(repositoryId: string) {
    return this.checklistRepo.find({
      where: [
        { repositoryId, isActive: true },
        { repositoryId: IsNull(), isActive: true },
      ],
    });
  }

  async getChecklistItems(checklistId: number) {
    return this.itemRepo.find({
      where: { checklistId },
    });
  }

  async attachChecklistsToReview(reviewId: string, repositoryId: string) {
    const checklists = await this.getChecklistsForRepository(repositoryId);
    
    return this.dataSource.transaction(async (manager) => {
      for (const checklist of checklists) {
        const items = await manager.find(ChecklistItem, { where: { checklistId: checklist.id } });
        for (const item of items) {
          const exists = await manager.findOne(ReviewChecklist, {
            where: { reviewId, checklistItemId: item.id },
          });
          
          if (!exists) {
            const reviewChecklist = manager.create(ReviewChecklist, {
              reviewId,
              checklistItemId: item.id,
            });
            await manager.save(reviewChecklist);
          }
        }
      }
    });
  }

  async completeItem(reviewId: string, checklistItemId: number, developerId: string, notes: string = '') {
    await this.reviewChecklistRepo.update(
      { reviewId, checklistItemId },
      {
        isCompleted: true,
        completedAt: new Date(),
        completedByDeveloperId: developerId,
        notes,
      }
    );
  }

  async getReviewChecklistStatus(reviewId: string) {
    const items = await this.reviewChecklistRepo.find({
      where: { reviewId },
      relations: ['checklistItem'],
    });

    if (items.length === 0) return null;

    const completed = items.filter((i) => i.isCompleted).length;
    const total = items.length;
    const completionPercentage = (completed / total) * 100;

    return {
      items,
      completed,
      total,
      completionPercentage,
    };
  }
}
