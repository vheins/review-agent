import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { cn } from '../lib/utils.js';

export function MetricCard({ label, value, description, icon: Icon = LayoutGrid }) {
    return (
        <Card className="overflow-hidden p-5">
            <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="eyebrow">{label}</p>
                        <CardTitle className="text-4xl font-black">{value}</CardTitle>
                    </div>
                    <div className="rounded-lg border border-border bg-panel p-2 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}

export function Section({ eyebrow, title, description, action, children, className }) {
    return (
        <Card className={cn('p-5', className)}>
            <CardHeader className="mb-4 flex-row items-start justify-between gap-4">
                <div className="space-y-2">
                    <p className="eyebrow">{eyebrow}</p>
                    <CardTitle>{title}</CardTitle>
                    {description ? <CardDescription>{description}</CardDescription> : null}
                </div>
                {action}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

export function ProgressBar({ label, value, subtitle }) {
    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">{subtitle ?? `${value}`}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-foreground/80" style={{ width: `${Math.max(6, Math.min(100, Number(value) || 0))}%` }} />
            </div>
        </div>
    );
}

export function EmptyState({ message }) {
    return (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-panel/70 px-4 py-10 text-center text-sm text-muted-foreground">
            {message}
        </div>
    );
}
