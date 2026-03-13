import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { MissionControlService } from './services/mission-control.service.js';
import { QueuePolicyEngine } from './services/queue-policy-engine.service.js';
import { HumanOverrideService } from './services/human-override.service.js';
import { SessionLedgerService } from './services/session-ledger.service.js';
import { StuckTaskDetectorService } from './services/stuck-task-detector.service.js';
import { AuditLoggerService } from '../../common/audit/audit-logger.service.js';
import { DataExporterService } from '../../common/exporter/data-exporter.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Export } from '../../database/entities/export.entity.js';

@Controller('orchestration')
export class OrchestrationController {
  constructor(
    private readonly missionControl: MissionControlService,
    private readonly queueEngine: QueuePolicyEngine,
    private readonly humanOverride: HumanOverrideService,
    private readonly ledger: SessionLedgerService,
    private readonly stuckTaskDetector: StuckTaskDetectorService,
    private readonly auditLogger: AuditLoggerService,
    private readonly dataExporter: DataExporterService,
    @InjectRepository(Export)
    private readonly exportRepo: Repository<Export>,
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

  @Get('tasks/stuck')
  async getStuckTasks() {
    return this.stuckTaskDetector.detectStuckTasks();
  }

  @Post('tasks/:id/recover')
  async recoverTask(@Param('id') id: string) {
    const session = await (this.missionControl as any).sessionRepository.findOne({ where: { id } });
    if (!session) return { error: 'Session not found' };
    await (this.stuckTaskDetector as any).recoverTask(session);
    return { status: 'recovery_initiated' };
  }

  @Get('audit')
  async getAuditLogs(@Query() query: any) {
    return this.auditLogger.getAuditLogs(query);
  }

  @Get('export/:id')
  async downloadExport(@Param('id') id: string, @Res() res: Response) {
    const exportRecord = await this.exportRepo.findOne({ where: { id } });
    if (!exportRecord) return res.status(404).json({ error: 'Export not found' });
    return res.download(exportRecord.filePath);
  }
}
