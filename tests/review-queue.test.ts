import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewQueueService, QueueStatus } from '../src/modules/review/review-queue.service.js';

describe('ReviewQueueService', () => {
  let service: ReviewQueueService;
  let reviewEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    reviewEngine = {
      reviewPullRequest: vi.fn(),
    };
    service = new ReviewQueueService(reviewEngine);
  });

  it('should add items to queue and process them', async () => {
    const mockPR = { number: 1, repository: { nameWithOwner: 'o/r' } };
    reviewEngine.reviewPullRequest.mockResolvedValue(true);

    await service.addToQueue(mockPR as any);
    
    // Process next item
    await new Promise(resolve => setTimeout(resolve, 10)); // Allow async processing

    const status = service.getQueueStatus();
    expect(status.completed).toBe(1);
    expect(reviewEngine.reviewPullRequest).toHaveBeenCalledWith(mockPR);
  });

  it('should respect max concurrency', async () => {
    const mockPR1 = { number: 1, repository: { nameWithOwner: 'o/r' } };
    const mockPR2 = { number: 2, repository: { nameWithOwner: 'o/r' } };
    const mockPR3 = { number: 3, repository: { nameWithOwner: 'o/r' } };

    // Make review take some time
    reviewEngine.reviewPullRequest.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 50)));

    service.addToQueue(mockPR1 as any);
    service.addToQueue(mockPR2 as any);
    service.addToQueue(mockPR3 as any);

    // Give it a tiny bit of time to start processing
    await new Promise(resolve => setTimeout(resolve, 10));

    const status = service.getQueueStatus();
    expect(status.processing).toBe(2); // Max concurrency is 2
    expect(status.pending).toBe(1);
  });

  it('should handle retries on failure', async () => {
    const mockPR = { number: 1, repository: { nameWithOwner: 'o/r' } };
    reviewEngine.reviewPullRequest.mockRejectedValueOnce(new Error('Transient error'));
    reviewEngine.reviewPullRequest.mockResolvedValueOnce(true);

    await service.addToQueue(mockPR as any);
    
    // Wait for first failure and retry
    await new Promise(resolve => setTimeout(resolve, 50));

    const status = service.getQueueStatus();
    expect(status.completed).toBe(1);
    expect(reviewEngine.reviewPullRequest).toHaveBeenCalledTimes(2);
  });

  it('should mark as failed after max retries', async () => {
    const mockPR = { number: 1, repository: { nameWithOwner: 'o/r' } };
    reviewEngine.reviewPullRequest.mockRejectedValue(new Error('Permanent error'));

    await service.addToQueue(mockPR as any);
    
    // Wait for all retries (3 retries + 1 initial = 4 calls total)
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = service.getQueueStatus();
    expect(status.failed).toBe(1);
    expect(reviewEngine.reviewPullRequest).toHaveBeenCalledTimes(4);
  });
});
