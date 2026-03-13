import React from 'react';
import { Clock3, RefreshCw, GitPullRequest, ShieldAlert, Settings2 } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { MetricCard, Section, EmptyState, ProgressBar } from './common.tsx';
import { formatDuration, formatRelativeTime, toneForStatus } from '../lib/formatters.js';
import { cn } from '../lib/utils.js';

export function OverviewTab({ 
    snapshot, 
    rangeDays, 
    setRangeDays, 
    refreshSnapshot, 
    refreshPRs, 
    refreshTeamSecurity, 
    refreshRepositoryConfig,
    setSelectedTab,
    setSelectedPrId,
    apiStatus,
    wsStatus,
    running,
    activityItems
}) {
    const overviewCards = snapshot ? [
        { label: 'Open PRs', value: snapshot.overview.openPRs ?? 0, description: `${snapshot.overview.blockingPRs ?? 0} blocking right now` },
        { label: 'Avg Review Time', value: formatDuration(snapshot.overview.avgReviewSeconds), description: `${snapshot.metricsOverview.total_reviews ?? 0} completed reviews` },
        { label: 'SLA Compliance', value: `${snapshot.overview.slaComplianceRate ?? 0}%`, description: `${rangeDays}-day moving window` },
        { label: 'Health Score', value: Math.round(snapshot.overview.avgHealthScore ?? 0), description: 'Average PR health across tracked repos' }
    ] : [];

    return (
        <div className="tab-page">
            <Section 
                eyebrow="Analytics" 
                title="System Overview" 
                description="Performance snapshots and operational health for the current time window."
                action={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel/30 px-2 py-1">
                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                            <select 
                                id="globalRange" 
                                value={String(rangeDays)} 
                                onChange={(event) => setRangeDays(Number(event.target.value))}
                                className="bg-transparent text-xs font-bold text-foreground outline-none focus:ring-0"
                            >
                                <option value="7">7D</option>
                                <option value="30">30D</option>
                                <option value="90">90D</option>
                            </select>
                        </div>
                        <Button size="sm" variant="outline" className="h-8" onClick={async () => {
                            await refreshSnapshot();
                            await refreshPRs();
                            await refreshTeamSecurity();
                            await refreshRepositoryConfig();
                        }}>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            Refresh
                        </Button>
                    </div>
                }
            >
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {overviewCards.map((card) => <MetricCard key={card.label} {...card} />)}
                </div>
            </Section>
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Runbook" title="Quick Actions">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Button variant="outline" className="h-20 flex-col gap-2 rounded-2xl" onClick={() => setSelectedTab('prs')}>
                            <GitPullRequest className="h-5 w-5 text-sky-500" />
                            Review queue
                        </Button>
                        <Button variant="outline" className="h-20 flex-col gap-2 rounded-2xl" onClick={() => setSelectedTab('security')}>
                            <ShieldAlert className="h-5 w-5 text-rose-500" />
                            Security triage
                        </Button>
                        <Button variant="outline" className="h-20 flex-col gap-2 rounded-2xl" onClick={() => setSelectedTab('config')}>
                            <Settings2 className="h-5 w-5 text-amber-500" />
                            Policy settings
                        </Button>
                    </div>
                </Section>
                <Section eyebrow="Execution" title="Active Engine" description="Real-time agent loop and communication status.">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-panel p-4">
                            <p className="eyebrow">Backend API</p>
                            <div className="mt-2 flex items-center gap-2 font-bold">
                                <span className={cn('h-2 w-2 rounded-full', apiStatus === 'Connected' ? 'bg-emerald-500' : 'bg-amber-500')} />
                                {apiStatus}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-panel p-4">
                            <p className="eyebrow">Event Stream</p>
                            <div className="mt-2 flex items-center gap-2 font-bold">
                                <span className={cn('h-2 w-2 rounded-full', wsStatus === 'Connected' ? 'bg-emerald-500' : 'bg-rose-500')} />
                                {wsStatus}
                            </div>
                        </div>
                    </div>
                </Section>
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Priority Queue" title="Review Queue">
                    <div className="grid gap-3">
                        {snapshot?.reviewQueue?.length ? snapshot.reviewQueue.map((pr) => (
                            <Card key={pr.github_pr_id} className="border-border/80 bg-panel/80 p-4">
                                <div className="grid gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <strong className="text-base font-semibold">#{pr.github_pr_id}</strong>
                                            <Badge variant={pr.is_blocking ? 'danger' : 'warn'}>{pr.is_blocking ? 'Blocking' : 'Queued'}</Badge>
                                        </div>
                                        <Button size="sm" variant="ghost" onClick={() => {
                                            setSelectedPrId(pr.id);
                                            setSelectedTab('prs');
                                        }}>
                                            Open
                                        </Button>
                                    </div>
                                    <div className="text-base font-semibold">[{pr.repository}] {pr.title}</div>
                                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        <span>{pr.repository}</span>
                                        <span>{pr.author}</span>
                                        <span>Priority {pr.priority_score ?? 0}</span>
                                        <span>Health {pr.health_score ?? 'n/a'}</span>
                                    </div>
                                </div>
                            </Card>
                        )) : <EmptyState message="No open pull requests in the queue." />}
                    </div>
                </Section>
                <Section eyebrow="Activity Stream" title="Recent Activity">
                    <div className="grid gap-3">
                        {activityItems.length ? activityItems.map((item, index) => (
                            <Card key={item.id ?? `${item.title}-${index}`} className="border-border/80 bg-panel/80 p-4">
                                <div className="grid gap-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <strong className="text-base font-semibold">{item.title ?? item.status ?? 'Live event'}</strong>
                                        <Badge variant={toneForStatus(item.tone ?? item.status)}>{item.source ?? item.tone ?? item.status ?? 'update'}</Badge>
                                    </div>
                                    <div className="text-sm leading-6 text-muted-foreground">{item.description ?? item.message ?? item.repository ?? 'Realtime activity'}</div>
                                    <div className="text-sm text-muted-foreground">{formatRelativeTime(item.occurred_at ?? item.created_at)}</div>
                                </div>
                            </Card>
                        )) : <EmptyState message="No recent activity yet." />}
                    </div>
                </Section>
            </div>
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Workload" title="Team Balance">
                    <div className="grid gap-4">
                        {(snapshot?.workload ?? []).length ? snapshot.workload.map((item) => (
                            <ProgressBar key={item.label} label={item.label} value={item.value} subtitle={`${item.value} pts`} />
                        )) : <EmptyState message="No workload data yet." />}
                    </div>
                </Section>
                <Section eyebrow="Configuration" title="Repository Snapshot">
                    <div className="grid gap-3">
                        {(snapshot?.configSummary ?? []).length ? snapshot.configSummary.map((item) => (
                            <Card key={item.repository} className="border-border/80 bg-panel/80 p-4">
                                <div className="grid gap-2">
                                    <div className="font-semibold">{item.repository}</div>
                                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                        <span>Mode {item.mode}</span>
                                        <span>{item.interval}s</span>
                                        <span>Auto Merge {item.autoMerge ? 'On' : 'Off'}</span>
                                        <span>Threshold {item.threshold}</span>
                                    </div>
                                </div>
                            </Card>
                        )) : <EmptyState message="No repository configuration loaded." />}
                    </div>
                </Section>
            </div>
        </div>
    );
}
