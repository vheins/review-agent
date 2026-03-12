import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { MissionControlService } from './services/mission-control.service.js';
import { QueuePolicyEngine } from './services/queue-policy-engine.service.js';
import { HumanOverrideService } from './services/human-override.service.js';
import { SessionLedgerService } from './services/session-ledger.service.js';

@Controller('orchestration')
export class OrchestrationController {
  constructor(
    private readonly missionControl: MissionControlService,
    private readonly queueEngine: QueuePolicyEngine,
    private readonly humanOverride: HumanOverrideService,
    private readonly ledger: SessionLedgerService,
  ) {}

  @Get('queue')
  async getQueue(@Query('repository') repository?: string) {
    return this.queueEngine.getQueue(repository);
  }

  @Post('queue/recalculate')
  async recalculateQueue(@Query('repository') repository?: string) {
    await this.queueEngine.reScoreAll(repository);
    return { status: 'success' };
  }

  @Get('sessions')
  async getSessions(@Query('status') status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return (this.missionControl as any).sessionRepository.find({
      where,
      order: { startedAt: 'DESC' },
      take: 50
    });
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return (this.missionControl as any).sessionRepository.findOne({
      where: { id },
      relations: ['steps']
    });
  }

  @Get('sessions/:id/ledger')
  async getLedger(@Param('id') id: string) {
    return this.ledger.getLedger(id);
  }

  @Post('sessions/:id/pause')
  async pauseSession(@Param('id') id: string, @Body('reason') reason: string) {
    await this.missionControl.pauseMission(id, reason || 'Manual pause');
    return { status: 'success' };
  }

  @Post('sessions/:id/resume')
  async resumeSession(@Param('id') id: string) {
    await this.missionControl.resumeMission(id);
    return { status: 'success' };
  }

  @Get('inbox')
  async getInbox() {
    return this.humanOverride.getPendingItems();
  }

  @Post('inbox/:id/resolve')
  async resolveInbox(
    @Param('id') id: string,
    @Body('action') action: 'approve' | 'reject' | 'reroute' | 'defer',
    @Body('notes') notes: string,
    @Body('userId') userId: number,
  ) {
    await this.humanOverride.resolveOverride(id, userId, action, notes);
    return { status: 'success' };
  }
}
