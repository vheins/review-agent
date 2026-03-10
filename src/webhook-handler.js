import crypto from 'crypto';
import { logger } from './logger.js';
import { workflowOrchestrator } from './workflow-orchestrator.js';

export class WebhookHandler {
  constructor(secret, dependencies = {}) {
    this.secret = secret;
    this.workflowOrchestrator = dependencies.workflowOrchestrator ?? workflowOrchestrator;
  }

  verifySignature(payload, signature) {
    if (!this.secret || !signature) return true; // skip if no secret configured

    const hmac = crypto.createHmac('sha256', this.secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    
    const digestBuffer = Buffer.from(digest);
    const signatureBuffer = Buffer.from(signature);

    if (digestBuffer.length !== signatureBuffer.length) return false;
    
    return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
  }

  async handleEvent(event, payload) {
    logger.info(`Received GitHub event: ${event}`);

    switch (event) {
      case 'pull_request':
        await this.handlePullRequest(payload);
        break;
      case 'check_suite':
        await this.handleCheckSuite(payload);
        break;
      case 'pull_request_review':
        await this.handlePullRequestReview(payload);
        break;
      default:
        logger.info(`Unhandled event type: ${event}`);
    }
  }

  async handlePullRequest(payload) {
    const action = payload.action;
    const prNumber = payload.pull_request.number;
    const repoName = payload.repository.full_name;

    logger.info(`PR #${prNumber} ${action} in ${repoName}`);
    
    if (action === 'opened' || action === 'synchronize') {
      logger.info(`Queueing review for PR #${prNumber}`);
      await this.workflowOrchestrator.processPullRequest(payload);
    }

    if (action === 'closed' && payload.pull_request.merged_at) {
      logger.info(`PR #${prNumber} merged in ${repoName}`);
    }
  }

  async handleCheckSuite(payload) {
    const conclusion = payload.check_suite.conclusion;
    if (payload.action === 'completed') {
      logger.info(`Check suite completed with conclusion: ${conclusion}`);
    }
  }

  async handlePullRequestReview(payload) {
    if (payload.action === 'submitted') {
      const state = payload.review.state;
      logger.info(`Review submitted for PR #${payload.pull_request.number}: ${state}`);
    }
  }
}

export const webhookHandler = new WebhookHandler(process.env.GITHUB_WEBHOOK_SECRET);
export default webhookHandler;
