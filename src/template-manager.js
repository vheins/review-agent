import { dbManager } from './database.js';

export class TemplateManager {
  constructor() {}

  async createTemplate(name, category, text, placeholders = []) {
    if (!dbManager.isAvailable()) throw new Error('Database not available');

    return dbManager.db.prepare(`
      INSERT INTO review_templates (name, category, template_text, placeholders, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(name, category, text, JSON.stringify(placeholders)).lastInsertRowid;
  }

  async getTemplatesByCategory(category) {
    if (!dbManager.isAvailable()) return [];

    return dbManager.db.prepare(
      'SELECT * FROM review_templates WHERE category = ?'
    ).all(category);
  }

  renderTemplate(templateText, variables = {}) {
    let rendered = templateText;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, value);
    }
    return rendered;
  }

  async useTemplate(templateId, variables = {}) {
    if (!dbManager.isAvailable()) return null;

    const template = dbManager.db.prepare('SELECT * FROM review_templates WHERE id = ?').get(templateId);
    if (!template) return null;

    // Increment usage count
    dbManager.db.prepare('UPDATE review_templates SET usage_count = usage_count + 1 WHERE id = ?').run(templateId);

    return this.renderTemplate(template.template_text, variables);
  }
}

export const templateManager = new TemplateManager();
export default templateManager;
