import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { ChecklistService } from '../src/modules/review/checklist.service.js';
import { Checklist } from '../src/database/entities/checklist.entity.js';
import { ChecklistItem } from '../src/database/entities/checklist-item.entity.js';
import { ReviewChecklist } from '../src/database/entities/review-checklist.entity.js';
import { DataSource } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ChecklistService', () => {
  let service: ChecklistService;
  let checklistRepo: any;
  let itemRepo: any;
  let reviewChecklistRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    checklistRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    itemRepo = {
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    reviewChecklistRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    };
    dataSource = {
      transaction: vi.fn().mockImplementation((cb) => cb({
        create: vi.fn().mockImplementation((entity, val) => val),
        save: vi.fn().mockImplementation((val) => Promise.resolve(val)),
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChecklistService,
        { provide: getRepositoryToken(Checklist), useValue: checklistRepo },
        { provide: getRepositoryToken(ChecklistItem), useValue: itemRepo },
        { provide: getRepositoryToken(ReviewChecklist), useValue: reviewChecklistRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get<ChecklistService>(ChecklistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChecklist', () => {
    it('should create a checklist and its items', async () => {
      const items = [{ text: 'Item 1', category: 'security' }];
      await service.createChecklist('repo-1', 'Test Checklist', 'Desc', items);
      
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('getChecklistsForRepository', () => {
    it('should fetch checklists for a repo', async () => {
      checklistRepo.find.mockResolvedValue([]);
      await service.getChecklistsForRepository('repo-1');
      expect(checklistRepo.find).toHaveBeenCalled();
    });
  });

  describe('getReviewChecklistStatus', () => {
    it('should return null if no items found', async () => {
      reviewChecklistRepo.find.mockResolvedValue([]);
      const result = await service.getReviewChecklistStatus('review-1');
      expect(result).toBeNull();
    });

    it('should calculate completion percentage', async () => {
      const mockItems = [
        { isCompleted: true, checklistItem: { itemText: 'Item 1' } },
        { isCompleted: false, checklistItem: { itemText: 'Item 2' } },
      ];
      reviewChecklistRepo.find.mockResolvedValue(mockItems);
      
      const result = await service.getReviewChecklistStatus('review-1');
      expect(result.completed).toBe(1);
      expect(result.total).toBe(2);
      expect(result.completionPercentage).toBe(50);
    });
  });
});
