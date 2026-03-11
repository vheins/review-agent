import { Controller, Get, Put, Param, Body, NotFoundException } from '@nestjs/common';
import { AppConfigService } from './app-config.service.js';

@Controller('api/config')
export class ConfigController {
  constructor(private readonly configService: AppConfigService) {}

  @Get(':repo')
  async getConfig(@Param('repo') repo: string) {
    const repoName = repo.replace('-', '/');
    return this.configService.getRepositoryConfig(repoName);
  }

  @Put(':repo')
  async updateConfig(@Param('repo') repo: string, @Body() updateDto: any) {
    const repoName = repo.replace('-', '/');
    // In a real app we'd have a method to update config in DB
    // For now we just return what would be updated
    return { repository: repoName, ...updateDto };
  }
}
