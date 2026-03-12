export interface RunbookStep {
  name: string;
  role: string;
  action: string;
}

export const RUNBOOKS: Record<string, RunbookStep[]> = {
  'review-only': [
    { name: 'Analyze Changes', role: 'Scout', action: 'analyze' },
    { name: 'Code Review', role: 'Reviewer', action: 'review' },
  ],
  'test-and-heal': [
    { name: 'Analyze Changes', role: 'Scout', action: 'analyze' },
    { name: 'Generate Tests', role: 'Fixer', action: 'test-gen' },
    { name: 'Verify Tests', role: 'Verifier', action: 'verify' },
  ],
  'fix-safe': [
    { name: 'Analyze Changes', role: 'Scout', action: 'analyze' },
    { name: 'Code Review', role: 'Reviewer', action: 'review' },
    { name: 'Apply Auto-Fixes', role: 'Fixer', action: 'fix' },
    { name: 'Verify Fixes', role: 'Verifier', action: 'verify' },
  ],
  'full-auto': [
    { name: 'Analyze Changes', role: 'Scout', action: 'analyze' },
    { name: 'Code Review', role: 'Reviewer', action: 'review' },
    { name: 'Apply Auto-Fixes', role: 'Fixer', action: 'fix' },
    { name: 'Verify Fixes', role: 'Verifier', action: 'verify' },
    { name: 'Merge PR', role: 'Merger', action: 'merge' },
  ],
  'security-triage': [
    { name: 'Security Scan', role: 'Scout', action: 'security-scan' },
    { name: 'Triage Findings', role: 'Reviewer', action: 'security-triage' },
  ]
};

export function validateRunbook(type: string): boolean {
  return !!RUNBOOKS[type];
}
