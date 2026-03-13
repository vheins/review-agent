import React from 'react';
import { Command, Clock3, ShieldCheck, Bot, Settings2, FileWarning } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Input } from './ui/input.jsx';
import { Select } from './ui/select.jsx';
import { Textarea } from './ui/textarea.jsx';
import { Section, EmptyState } from './common.tsx';
import { toneForStatus } from '../lib/formatters.js';
import { api } from '../api-helper.js';

export function ConfigTab({
    repositories,
    repositoryId,
    refreshRepositoryConfig,
    configForm,
    setConfigForm,
    configValidation,
    handleSaveConfig,
    ruleForm,
    setRuleForm,
    handleTestRule,
    handleSaveRule,
    ruleFeedback,
    setRuleFeedback,
    configData
}) {
    const defaultRuleSample = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';

    return (
        <div className="tab-page">
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Repository" title="Configuration Editor" description="Tune review cadence, quality gates, and repository-level automation.">
                    <form className="grid gap-4" onSubmit={handleSaveConfig}>
                        <Card className="border-dashed p-4">
                            <div className="flex items-start gap-3">
                                <Command className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="space-y-1">
                                    <div className="text-sm font-medium">Policy Surface</div>
                                    <p className="text-sm text-muted-foreground">These settings drive how aggressively the agent reviews, fixes, and merges changes for the selected repository.</p>
                                </div>
                            </div>
                        </Card>
                        <div className="grid gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Repository</span>
                            <Select value={repositoryId} onChange={(event) => refreshRepositoryConfig(event.target.value)}>
                                {repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
                            </Select>
                        </div>
                        <Card className="p-4">
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                                    Review Policy
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">Core cadence and executor behavior for daily review operations.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Review Interval (sec)</span><Input type="number" value={configForm.reviewInterval} onChange={(event) => setConfigForm((current) => ({ ...current, reviewInterval: event.target.value }))} /></div>
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Review Mode</span><Select value={configForm.reviewMode} onChange={(event) => setConfigForm((current) => ({ ...current, reviewMode: event.target.value }))}><option value="comment">Comment</option><option value="fix">Fix</option></Select></div>
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">AI Executor</span><Select value={configForm.aiExecutor} onChange={(event) => setConfigForm((current) => ({ ...current, aiExecutor: event.target.value }))}><option value="gemini">Gemini</option><option value="copilot">Copilot</option><option value="kiro">Kiro</option><option value="claude">Claude</option><option value="codex">Codex</option><option value="opencode">OpenCode</option></Select></div>
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Auto Merge</span><Select value={configForm.autoMerge} onChange={(event) => setConfigForm((current) => ({ ...current, autoMerge: event.target.value }))}><option value="true">Enabled</option><option value="false">Disabled</option></Select></div>
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                    Quality Gates
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">Minimum thresholds the agent should enforce before merge or escalation.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Severity Threshold</span><Input type="number" value={configForm.severityThreshold} onChange={(event) => setConfigForm((current) => ({ ...current, severityThreshold: event.target.value }))} /></div>
                                <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Auto Merge Health Threshold</span><Input type="number" value={configForm.autoMergeHealthThreshold} onChange={(event) => setConfigForm((current) => ({ ...current, autoMergeHealthThreshold: event.target.value }))} /></div>
                            </div>
                            <div className="mt-4 grid gap-2"><span className="text-sm font-medium text-muted-foreground">Required Checks</span><Input value={configForm.requiredChecks} onChange={(event) => setConfigForm((current) => ({ ...current, requiredChecks: event.target.value }))} /></div>
                        </Card>
                        <Card className="p-4">
                            <div className="mb-4">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Bot className="h-4 w-4 text-muted-foreground" />
                                    Automation Controls
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">Logging and execution visibility for the repository-level review loop.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">Log Level</span>
                                    <Select value={configForm.logLevel} onChange={(event) => setConfigForm((current) => ({ ...current, logLevel: event.target.value }))}>
                                        <option value="debug">Debug</option>
                                        <option value="info">Info</option>
                                        <option value="warn">Warn</option>
                                        <option value="error">Error</option>
                                    </Select>
                                </div>
                                <div className="rounded-xl border border-border bg-panel/70 p-4 text-sm text-muted-foreground">
                                    Live execution is {configForm.autoMerge === 'true' ? 'allowed to continue into auto-merge when health gates pass.' : 'restricted to review and remediation without merge.'}
                                </div>
                            </div>
                        </Card>
                        <Card className="p-4 text-sm text-muted-foreground">{configValidation}</Card>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 p-4">
                            <p className="text-sm text-muted-foreground">Changes apply to the selected repository policy and influence future review cycles.</p>
                            <div className="flex flex-wrap gap-3">
                                <Button type="button" variant="ghost" onClick={() => refreshRepositoryConfig(repositoryId)}>Reset</Button>
                                <Button className="w-fit">Save Configuration</Button>
                            </div>
                        </div>
                    </form>
                </Section>
                <Section eyebrow="Rules" title="Custom Rule Editor" description="Create team-specific static checks and validate them against sample code before saving.">
                    <form className="grid gap-4" onSubmit={handleSaveRule}>
                        <Card className="border-dashed p-4">
                            <div className="flex items-start gap-3">
                                <Settings2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                <div className="space-y-1">
                                    <div className="text-sm font-medium">Rule Studio</div>
                                    <p className="text-sm text-muted-foreground">Maintain repository-specific detection rules so the agent can catch patterns outside the default review baseline.</p>
                                </div>
                            </div>
                        </Card>
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Rule Name</span><Input value={ruleForm.rule_name} onChange={(event) => setRuleForm((current) => ({ ...current, rule_name: event.target.value }))} /></div>
                            <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Type</span><Select value={ruleForm.rule_type} onChange={(event) => setRuleForm((current) => ({ ...current, rule_type: event.target.value }))}><option value="regex">Regex</option><option value="ast">AST</option></Select></div>
                            <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Severity</span><Select value={ruleForm.severity} onChange={(event) => setRuleForm((current) => ({ ...current, severity: event.target.value }))}><option value="critical">Critical</option><option value="high">High</option><option value="warning">Warning</option><option value="info">Info</option></Select></div>
                        </div>
                        <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Pattern</span><Textarea rows={3} value={ruleForm.pattern} onChange={(event) => setRuleForm((current) => ({ ...current, pattern: event.target.value }))} /></div>
                        <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Message</span><Textarea rows={2} value={ruleForm.message} onChange={(event) => setRuleForm((current) => ({ ...current, message: event.target.value }))} /></div>
                        <div className="grid gap-2"><span className="text-sm font-medium text-muted-foreground">Sample Code For Validation</span><Textarea id="ruleSampleCode" rows={5} value={ruleForm.sampleCode} onChange={(event) => setRuleForm((current) => ({ ...current, sampleCode: event.target.value }))} /></div>
                        <div className="flex flex-wrap gap-3">
                            <Button type="button" variant="secondary" onClick={handleTestRule}>Test Rule</Button>
                            <Button type="submit">Save Rule</Button>
                            <Button type="button" variant="ghost" onClick={() => {
                                setRuleForm({ id: '', rule_name: '', rule_type: 'regex', severity: 'critical', pattern: '', message: '', sampleCode: defaultRuleSample });
                                setRuleFeedback('Rule editor reset.');
                            }}>Reset</Button>
                        </div>
                        <Card className="p-4 text-sm text-muted-foreground">{ruleFeedback}</Card>
                        <div className="grid gap-3 pt-2">
                            <h4 className="text-lg font-semibold">Existing Rules</h4>
                            {(configData?.rules ?? []).length ? configData.rules.map((rule) => (
                                <Card key={rule.id} className="p-4">
                                    <div className="grid gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <FileWarning className="h-4 w-4 text-muted-foreground" />
                                            <strong>{rule.rule_name}</strong>
                                            <Badge>{rule.rule_type}</Badge>
                                            <Badge variant={toneForStatus(rule.severity)}>{rule.severity}</Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">{rule.message}</div>
                                        <div className="text-sm text-muted-foreground">{rule.pattern}</div>
                                        <div className="flex flex-wrap gap-3">
                                            <Button size="sm" variant="outline" onClick={() => setRuleForm({ ...rule, id: String(rule.id), sampleCode: defaultRuleSample })}>Edit</Button>
                                            <Button size="sm" variant="ghost" onClick={async () => {
                                                const result = await api.deleteCustomRule(rule.id);
                                                setRuleFeedback(result.success ? 'Rule deleted.' : result.error);
                                                if (result.success) await refreshRepositoryConfig(repositoryId);
                                            }}>Delete</Button>
                                        </div>
                                    </div>
                                </Card>
                            )) : <EmptyState message="No custom rules yet for this repository." />}
                        </div>
                    </form>
                </Section>
            </div>
        </div>
    );
}
