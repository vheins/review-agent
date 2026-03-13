import { Controller, Get, Post, Param, Query, ParseIntPipe, Body, Delete } from '@nestjs/common';
import { QueueService } from './queue.service.js';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('jobs')
  async getJobs(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.queueService.getJobs(limit || 50);
  }

  @Post('jobs/:id/retry')
  async retryJob(@Param('id') id: string) {
    return this.queueService.retryJob(id);
  }

  @Post('jobs')
  async createJob(@Body() payload: { type: string, data: any }) {
    return this.queueService.push(payload.type, payload.data);
  }
}
