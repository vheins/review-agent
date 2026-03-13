import React, { useMemo } from 'react';
import { Card } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { MetricCard, Section, EmptyState, ProgressBar } from './common.tsx';
import { formatRelativeTime, toneForStatus } from '../lib/formatters.js';

export function SecurityTab({
    teamSecurity
}) {
    const securityTrend = useMemo(() => {
        const findings = teamSecurity?.securityFindings ?? [];
        const byDate = new Map();
        findings.forEach((finding) => {
            const key = (finding.detected_at ?? new Date().toISOString()).slice(5, 10);
            byDate.set(key, (byDate.get(key) ?? 0) + 1);
        });
        return [...byDate.entries()].map(([label, value]) => ({ label, value }));
    }, [teamSecurity]);

    const severityCounts = ['critical', 'high', 'medium', 'low'].map((severity) => ({
        label: severity,
        value: (teamSecurity?.securityFindings ?? []).filter((item) => item.severity === severity).length
    }));

    return (
        <div className="tab-page">
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {severityCounts.map((metric) => (
                    <MetricCard key={metric.label} label={metric.label} value={metric.value} description="Recent findings by severity" />
                ))}
            </div>
            <Section eyebrow="Trend" title="Vulnerability Trends">
                <div className="grid gap-4">
                    {securityTrend.length ? securityTrend.map((item) => (
                        <ProgressBar key={item.label} label={item.label} value={item.value * 25} subtitle={`${item.value} findings`} />
                    )) : <EmptyState message="No vulnerability trend data yet." />}
                </div>
            </Section>
            <Section eyebrow="Findings" title="Recent Security Alerts">
                <div className="grid gap-3">
                    {(teamSecurity?.securityFindings ?? []).length ? teamSecurity.securityFindings.map((finding, index) => (
                        <Card key={`${finding.title}-${index}`} className="p-4">
                            <div className="grid gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <strong>{finding.title}</strong>
                                    <Badge variant={toneForStatus(finding.severity)}>{finding.severity}</Badge>
                                </div>
                                <div className="text-sm leading-6 text-muted-foreground">{finding.description}</div>
                                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                    <span>{finding.repository} / PR #{finding.github_pr_id}</span>
                                    <span>{finding.file_path ?? 'scan'}</span>
                                    <span>{formatRelativeTime(finding.detected_at)}</span>
                                </div>
                            </div>
                        </Card>
                    )) : <EmptyState message="No security findings available." />}
                </div>
            </Section>
        </div>
    );
}
