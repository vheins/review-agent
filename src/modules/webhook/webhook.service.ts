import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ReviewQueueService } from '../review/review-queue.service.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly secret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly reviewQueue: ReviewQueueService,
  ) {
    this.secret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!this.secret || !signature) return true;

    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    const digestBuffer = Buffer.from(digest);
    const signatureBuffer = Buffer.from(signature);

    if (digestBuffer.length !== signatureBuffer.length) return false;
    
    return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
  }

  async handleEvent(event: string, payload: any) {
    this.logger.log(`Received GitHub event: ${event}`);

    switch (event) {
      case 'pull_request':
        await this.handlePullRequest(payload);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event}`);
    }
  }

  private async handlePullRequest(payload: any) {
    const action = payload.action;
    const prNumber = payload.pull_request.number;
    const repoName = payload.repository.full_name;

    this.logger.log(`PR #${prNumber} ${action} in ${repoName}`);
    
    if (action === 'opened' || action === 'synchronize') {
      this.logger.log(`Queueing review for PR #${prNumber}`);
      // Convert payload to our PullRequest interface if needed, 
      // or just pass enough info to reviewQueue
      await this.reviewQueue.addToQueue({
        number: prNumber,
        title: payload.pull_request.title,
        repository: { nameWithOwner: repoName },
        url: payload.pull_request.html_url,
        updatedAt: payload.pull_request.updated_at,
        headRefName: payload.pull_request.head.ref,
        baseRefName: payload.pull_request.base.ref,
      });
    }
  }
}
