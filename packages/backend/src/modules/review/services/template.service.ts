import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewTemplate } from '../../../database/entities/review-template.entity.js';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(ReviewTemplate)
    private readonly templateRepository: Repository<ReviewTemplate>,
  ) {}

  async createTemplate(name: string, category: string, text: string, placeholders: string[] = []): Promise<ReviewTemplate> {
    const template = this.templateRepository.create({
      name,
      category,
      templateText: text,
      placeholders,
    });
    return await this.templateRepository.save(template);
  }

  async getTemplatesByCategory(category: string): Promise<ReviewTemplate[]> {
    return this.templateRepository.find({
      where: { category }
    });
  }

  renderTemplate(templateText: string, variables: Record<string, string> = {}): string {
    let rendered = templateText;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    return rendered;
  }

  async useTemplate(templateId: number, variables: Record<string, string> = {}): Promise<string | null> {
    const template = await this.templateRepository.findOne({ where: { id: templateId } });
    if (!template) return null;

    // Increment usage count
    await this.templateRepository.increment({ id: templateId }, 'usageCount', 1);

    return this.renderTemplate(template.templateText, variables);
  }
}
