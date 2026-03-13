import React from 'react';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Section, EmptyState, ProgressBar } from './common.tsx';
import { formatRelativeTime, toneForStatus } from '../lib/formatters.js';

export function TeamTab({
    teamSecurity,
    toggleAvailability
}) {
    return (
        <div className="tab-page">
            <div className="grid gap-5 2xl:grid-cols-2">
                <Section eyebrow="Capacity" title="Developer Workload">
                    <div className="grid gap-4">
                        {(teamSecurity?.developers ?? []).length ? teamSecurity.developers.map((developer) => (
                            <ProgressBar key={developer.id} label={developer.display_name} value={developer.current_workload_score ?? 0} subtitle={`${Number(developer.current_workload_score ?? 0).toFixed(1)} pts`} />
                        )) : <EmptyState message="No developer workload available." />}
                    </div>
                </Section>
                <Section eyebrow="Availability" title="Team Roster">
                    <div className="scroll-slim overflow-auto rounded-[1.5rem] border border-border bg-panel/60">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-secondary text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">Developer</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Availability</th>
                                    <th className="px-4 py-3">Until</th>
                                    <th className="px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(teamSecurity?.developers ?? []).map((developer) => (
                                    <tr key={developer.id} className="border-t border-border">
                                        <td className="px-4 py-3 font-medium">{developer.display_name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{developer.role}</td>
                                        <td className="px-4 py-3"><Badge variant={developer.is_available ? 'success' : 'warn'}>{developer.is_available ? 'Available' : 'Unavailable'}</Badge></td>
                                        <td className="px-4 py-3 text-muted-foreground">{developer.unavailable_until ? new Date(developer.unavailable_until).toLocaleString() : 'Open-ended'}</td>
                                        <td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => toggleAvailability(developer)}>{developer.is_available ? 'Mark Away' : 'Restore'}</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Section>
            </div>
            <Section eyebrow="Notifications" title="Recent Alerts">
                <div className="grid gap-3">
                    {(teamSecurity?.recentAlerts ?? []).length ? teamSecurity.recentAlerts.map((alert, index) => (
                        <Card key={`${alert.title}-${index}`} className="p-4">
                            <div className="grid gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <strong>{alert.title}</strong>
                                    <Badge variant={toneForStatus(alert.priority)}>{alert.priority}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">{alert.message}</div>
                                <div className="text-sm text-muted-foreground">{formatRelativeTime(alert.created_at)}</div>
                            </div>
                        </Card>
                    )) : <EmptyState message="No recent notifications." />}
                </div>
            </Section>
        </div>
    );
}
