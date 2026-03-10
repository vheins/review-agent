import { dbManager } from './database.js';
import * as acorn from 'acorn';

export class RuleEngine {
  constructor() {}

  async loadRules(repositoryId) {
    if (!dbManager.isAvailable()) return [];
    
    return dbManager.db.prepare(
      'SELECT * FROM custom_rules WHERE repository_id = ? AND enabled = 1'
    ).all(repositoryId);
  }

  async executeRules(repositoryId, branchName, changedFiles = []) {
    const rules = await this.loadRules(repositoryId);
    const violations = [];

    for (const rule of rules) {
      // Filter by branch patterns if specified
      if (rule.branch_patterns) {
        try {
          const patterns = JSON.parse(rule.branch_patterns);
          if (Array.isArray(patterns) && patterns.length > 0) {
            const matches = patterns.some(p => new RegExp(p).test(branchName));
            if (!matches) continue;
          }
        } catch (e) {
          // invalid json, skip branch check
        }
      }

      for (const file of changedFiles) {
        // file object: { path, content, diff }
        if (rule.rule_type === 'regex') {
          this.applyRegexRule(rule, file, violations);
        } else if (rule.rule_type === 'ast' && file.path.endsWith('.js')) {
          this.applyASTRule(rule, file, violations);
        }
      }
    }

    return violations;
  }

  applyRegexRule(rule, file, violations) {
    if (!file.content) return;

    try {
      const regex = new RegExp(rule.pattern, 'gm');
      let match;
      
      while ((match = regex.exec(file.content)) !== null) {
        // Calculate line number
        const lineOffset = file.content.substring(0, match.index).split('\n').length;
        
        violations.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          file_path: file.path,
          line_number: lineOffset,
          severity: rule.severity,
          message: rule.message,
          code_snippet: match[0],
          suggested_fix: rule.auto_fix_template ? this.applyFixTemplate(rule.auto_fix_template, match) : null,
          is_auto_fixable: rule.auto_fixable === 1
        });
      }
    } catch (e) {
      // invalid regex
    }
  }

  applyASTRule(rule, file, violations) {
    if (!file.content) return;

    try {
      const ast = acorn.parse(file.content, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
      
      // Simple AST matching: for now we just support looking for specific node types or simple properties
      // In a real implementation, this would use a more sophisticated pattern matcher (like esquery)
      this.walkAST(ast, (node) => {
        if (this.matchesASTPattern(node, rule.pattern)) {
          violations.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            file_path: file.path,
            line_number: node.loc.start.line,
            severity: rule.severity,
            message: rule.message,
            is_auto_fixable: false // AST fixes are harder
          });
        }
      });
    } catch (e) {
      // parse error
    }
  }

  matchesASTPattern(node, pattern) {
    // This is a placeholder for actual structural matching
    // For now, let's say pattern is "NodeType:PropertyName=Value"
    // e.g. "CallExpression:callee.name=eval"
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

  walkAST(node, callback) {
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

  applyFixTemplate(template, match) {
    // Basic template replacement: $0, $1, etc.
    return template.replace(/\$(\d+)/g, (m, index) => {
      return match[index] || '';
    });
  }

  async saveRule(repositoryId, ruleData) {
    this.validateRule(ruleData);

    if (!dbManager.isAvailable()) throw new Error('Database not available');

    const { rule_name, rule_type, pattern, severity, message, auto_fixable, auto_fix_template, enabled, branch_patterns } = ruleData;

    return dbManager.db.prepare(`
      INSERT INTO custom_rules (
        repository_id, rule_name, rule_type, pattern, severity, 
        message, auto_fixable, auto_fix_template, enabled, 
        branch_patterns, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      repositoryId, rule_name, rule_type, pattern, severity,
      message, auto_fixable ? 1 : 0, auto_fix_template, enabled !== false ? 1 : 0,
      Array.isArray(branch_patterns) ? JSON.stringify(branch_patterns) : branch_patterns
    ).lastInsertRowid;
  }

  validateRule(rule) {
    if (!rule.rule_name) throw new Error('Rule name is required');
    if (!['regex', 'ast'].includes(rule.rule_type)) throw new Error('Invalid rule type');
    if (!rule.pattern) throw new Error('Pattern is required');
    
    if (rule.rule_type === 'regex') {
      try {
        new RegExp(rule.pattern);
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${e.message}`);
      }
    }
    
    return true;
  }

  async testRule(rule, sampleCode) {
    const file = { path: 'test.js', content: sampleCode };
    const violations = [];
    
    if (rule.rule_type === 'regex') {
      this.applyRegexRule(rule, file, violations);
    } else if (rule.rule_type === 'ast') {
      this.applyASTRule(rule, file, violations);
    }
    
    return violations;
  }
}

export const ruleEngine = new RuleEngine();
export default ruleEngine;
