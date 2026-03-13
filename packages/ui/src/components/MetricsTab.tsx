import React from 'react';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { MetricCard, Section, EmptyState, ProgressBar } from './common.tsx';
import { formatDuration } from '../lib/formatters.js';

export function MetricsTab({
    snapshot,
    rangeDays,
    repositories,
    handleExport
}) {
    const metricsSummaryCards = snapshot ? [
        { label: 'Throughput', value: snapshot.metricsOverview.total_reviews ?? 0, description: `Reviews completed in the last ${rangeDays} days` },
        { label: 'Approval Confidence', value: `${Math.round((snapshot.approvalByExecutor ?? []).reduce((sum, item) => sum + Number(item.approval_rate ?? 0), 0) / Math.max((snapshot.approvalByExecutor ?? []).length, 1))}%`, description: 'Average approval rate across executors' },
        { label: 'Queue Pressure', value: snapshot.overview.blockingPRs ?? 0, description: 'Pull requests currently breaching guardrails' },
        { label: 'Repo Coverage', value: repositories.length, description: 'Repositories included in this operating window' }
    ] : [];

    const repositoryOpsRows = (snapshot?.configSummary ?? []).map((item) => ({
        repository: item.repository,
        mode: item.mode,
        interval: `${item.interval}s`,
        autoMerge: item.autoMerge ? 'Enabled' : 'Disabled',
        threshold: item.threshold
    }));

    return (
        <div className="tab-page">
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {metricsSummaryCards.map((card) => <MetricCard key={card.label} {...card} />)}
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Trend" title="Review Time Trend">
                    <div className="flex min-h-[16rem] items-end gap-3 overflow-hidden rounded-[1.5rem] border border-border bg-panel/70 p-4">
                        {(snapshot?.trendData ?? []).length ? snapshot.trendData.map((point) => {
                            const maxValue = Math.max(...snapshot.trendData.map((item) => Number(item.avg_duration) || 0), 1);
                            const height = Math.max(18, Math.round(((Number(point.avg_duration) || 0) / maxValue) * 180));
                            return (
                                <div key={point.bucket} className="flex flex-1 flex-col items-center justify-end gap-3">
                                    <div className="w-full rounded-t-2xl rounded-b-lg bg-foreground/80" style={{ height }} />
                                    <span className="text-xs text-muted-foreground">{point.bucket.slice(5)}</span>
                                </div>
                            );
                        }) : <EmptyState message="No review trend data yet." />}
                    </div>
                </Section>
                <Section eyebrow="Executor Quality" title="Approval Rate by Executor">
                    <div className="grid gap-4">
                        {(snapshot?.approvalByExecutor ?? []).map((item) => (
                            <ProgressBar key={item.executor_type} label={item.executor_type} value={item.approval_rate} subtitle={`${Number(item.approval_rate).toFixed(1)}% approval`} />
                        ))}
                    </div>
                </Section>
            </div>
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <Section eyebrow="Operations Summary" title="Review Performance Table" description="Compact operational breakdown for the current time window.">
                    <div className="scroll-slim overflow-auto rounded-xl border border-border bg-panel/60">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-secondary text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">Executor</th>
                                    <th className="px-4 py-3">Approval Rate</th>
                                    <th className="px-4 py-3">Reviews</th>
                                    <th className="px-4 py-3">Window</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(snapshot?.approvalByExecutor ?? []).map((item) => (
                                    <tr key={item.executor_type} className="border-t border-border">
                                        <td className="px-4 py-3 font-medium">{item.executor_type}</td>
                                        <td className="px-4 py-3">{Number(item.approval_rate).toFixed(1)}%</td>
                                        <td className="px-4 py-3">{item.total_reviews}</td>
                                        <td className="px-4 py-3 text-muted-foreground">Last {rangeDays} days</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
                <Section eyebrow="Repository Ops" title="Policy Coverage" description="Operational summary of repositories and the active guardrails they run with.">
                    <div className="grid gap-3">
                        {repositoryOpsRows.length ? repositoryOpsRows.map((item) => (
                            <Card key={item.repository} className="p-4">
                                <div className="grid gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold">{item.repository}</div>
                                            <div className="mt-1 text-sm text-muted-foreground">Review mode {item.mode}</div>
                                        </div>
                                        <Badge variant={item.autoMerge === 'Enabled' ? 'success' : 'warn'}>{item.autoMerge}</Badge>
                                    </div>
                                    <div className="grid gap-2 text-sm text-muted-foreground">
                                        <div className="flex items-center justify-between gap-3"><span>Interval</span><span className="font-medium text-foreground">{item.interval}</span></div>
                                        <div className="flex items-center justify-between gap-3"><span>Threshold</span><span className="font-medium text-foreground">{item.threshold}</span></div>
                                    </div>
                                </div>
                            </Card>
                        )) : <EmptyState message="No repository policy coverage loaded." />}
                    </div>
                </Section>
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Rejections" title="Top Rejection Reasons">
                    <div className="grid gap-4">
                        {(snapshot?.rejectionReasons ?? []).map((item) => (
                            <ProgressBar key={item.issue_type} label={item.issue_type} value={item.count * 10} subtitle={`${item.count} comments`} />
                        ))}
                    </div>
                </Section>
                <Section eyebrow="Export" title="Metrics Export" description="Export the current operating window for offline analysis or sharing." action={<Button onClick={handleExport}>Export CSV</Button>}>
                    <p className="text-sm leading-6 text-muted-foreground">Export the currently selected range as CSV for external analysis.</p>
                </Section>
            </div>
        </div>
    );
}

import { Badge } from './ui/badge.jsx';
