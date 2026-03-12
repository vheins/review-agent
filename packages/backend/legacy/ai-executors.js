import { config } from './config.js';
import { logger } from './logger.js';
import { commentParser } from './comment-parser.js';

export class AIExecutor {
  constructor(name) {
    this.name = name;
  }

  async review(pr, diff, repoDir) {
    throw new Error('Method not implemented');
  }

  buildReviewPrompt(pr, diff) {
    return `
Review the following Pull Request:
Title: ${pr.title}
Description: ${pr.description || 'No description provided.'}

Diff:
${diff}

Please provide your review in the following format:
[File: path/to/file] [Line: line_number] [Type: security|quality|style|logic] [Severity: critical|high|medium|low] Message...
    `.trim();
  }

  parseOutput(output) {
    return commentParser.parse(output);
  }
}

export class GeminiExecutor extends AIExecutor {
  constructor() {
    super('gemini');
  }

  async review(pr, diff, repoDir) {
    logger.info(`Gemini reviewing PR #${pr.number}...`);
    // In a real app, this would use the Gemini API or CLI
    // For now, we simulate the output
    return "[File: src/app.js] [Line: 10] [Type: quality] [Severity: medium] Code could be more concise.";
  }
}

export class CopilotExecutor extends AIExecutor {
  constructor() {
    super('copilot');
  }

  async review(pr, diff, repoDir) {
    logger.info(`Copilot reviewing PR #${pr.number}...`);
    return "[File: src/index.js] [Line: 5] [Type: style] [Severity: low] Missing semicolon.";
  }
}

export class AIExecutorRegistry {
  constructor() {
    this.executors = new Map();
    this.register('gemini', new GeminiExecutor());
    this.register('copilot', new CopilotExecutor());
  }

  register(name, executor) {
    this.executors.set(name, executor);
  }

  getExecutor(name) {
    return this.executors.get(name) || this.executors.get('gemini');
  }

  async selectBestExecutor(pr) {
    // Priority based on config
    const preferred = config.aiExecutor;
    if (this.executors.has(preferred)) return this.getExecutor(preferred);
    
    return this.getExecutor('gemini'); // fallback
  }
}

export const aiExecutorRegistry = new AIExecutorRegistry();
export default aiExecutorRegistry;
