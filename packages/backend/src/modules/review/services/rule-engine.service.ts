import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomRule } from '../../../database/entities/custom-rule.entity.js';
import * as acorn from 'acorn';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    @InjectRepository(CustomRule)
    private readonly ruleRepository: Repository<CustomRule>,
  ) {}

  async loadRules(repository: string): Promise<CustomRule[]> {
    return this.ruleRepository.find({
      where: { repository, enabled: true }
    });
  }

  async executeRules(repository: string, branchName: string, changedFiles: { path: string, content: string }[] = []): Promise<any[]> {
    const rules = await this.loadRules(repository);
    const violations: any[] = [];

    for (const rule of rules) {
      if (rule.branchPatterns && rule.branchPatterns.length > 0) {
        const matches = rule.branchPatterns.some(p => new RegExp(p).test(branchName));
        if (!matches) continue;
      }

      for (const file of changedFiles) {
        if (rule.ruleType === 'regex') {
          this.applyRegexRule(rule, file, violations);
        } else if (rule.ruleType === 'ast' && file.path.endsWith('.js')) {
          this.applyASTRule(rule, file, violations);
        }
      }
    }

    return violations;
  }

  private applyRegexRule(rule: CustomRule, file: any, violations: any[]) {
    if (!file.content) return;

    try {
      const regex = new RegExp(rule.pattern, 'gm');
      let match: RegExpExecArray | null;
      
      while ((match = regex.exec(file.content)) !== null) {
        const lineOffset = file.content.substring(0, match.index).split('\n').length;
        
        violations.push({
          ruleId: rule.id,
          ruleName: rule.ruleName,
          file: file.path,
          line: lineOffset,
          severity: rule.severity,
          message: rule.message,
          snippet: match[0],
          suggestion: rule.autoFixTemplate ? this.applyFixTemplate(rule.autoFixTemplate, match) : null,
          isAutoFixable: rule.autoFixable
        });
      }
    } catch (e) {}
  }

  private applyASTRule(rule: CustomRule, file: any, violations: any[]) {
    if (!file.content) return;

    try {
      const ast = acorn.parse(file.content, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
      
      this.walkAST(ast, (node: any) => {
        if (this.matchesASTPattern(node, rule.pattern)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            file: file.path,
            line: node.loc.start.line,
            severity: rule.severity,
            message: rule.message,
            isAutoFixable: false
          });
        }
      });
    } catch (e) {}
  }

  private matchesASTPattern(node: any, pattern: string): boolean {
    try {
      if (pattern.startsWith('NodeType:')) {
        const expectedType = pattern.split(':')[1];
        return node.type === expectedType;
      }
      
      if (pattern === 'eval' && node.type === 'CallExpression' && node.callee.name === 'eval') {
        return true;
      }
    } catch (e) {}
    
    return false;
  }

  private walkAST(node: any, callback: (node: any) => void) {
    callback(node);
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => {
            if (child && child.type) this.walkAST(child, callback);
          });
        } else if (node[key].type) {
          this.walkAST(node[key], callback);
        }
      }
    }
  }

  private applyFixTemplate(template: string, match: RegExpExecArray): string {
    return template.replace(/\$(\d+)/g, (m, index) => {
      return match[parseInt(index, 10)] || '';
    });
  }

  async saveRule(repository: string, ruleData: Partial<CustomRule>): Promise<CustomRule> {
    const rule = this.ruleRepository.create({
      ...ruleData,
      repository,
    });
    return await this.ruleRepository.save(rule);
  }
}
