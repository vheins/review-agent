import React, { useEffect, useState, useCallback } from 'react';
import { X, GitMerge, GitPullRequest, XCircle, ExternalLink, Clock, GitCommit, FileText, MessageSquare, Tag, Milestone, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { formatRelativeTime, variantForPRStatus, toneForStatus } from '../lib/formatters.js';
import { api } from '../api-helper.js';

function Avatar({ login, size = 'md' }: { login: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = size === 'sm' ? 'h-5 w-5 text-[8px]' : size === 'lg' ? 'h-8 w-8 text-sm' : 'h-6 w-6 text-[10px]';
    const colors = [
        'from-sky-400 to-indigo-500',
        'from-emerald-400 to-teal-500',
        'from-amber-400 to-orange-500',
        'from-rose-400 to-pink-500',
        'from-purple-400 to-violet-500',
    ];
    const color = colors[login?.charCodeAt(0) % colors.length] ?? colors[0];
    return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white ring-2 ring-card shrink-0`}>
            {login?.charAt(0).toUpperCase()}
        </div>
    );
}

function StatusIcon({ status }: { status: string }) {
    if (status === 'merged') return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/15">
            <GitMerge className="h-4 w-4 text-purple-500" />
        </div>
    );
    if (status === 'closed') return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/15">
            <XCircle className="h-4 w-4 text-rose-500" />
        </div>
    );
    return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
            <GitPullRequest className="h-4 w-4 text-emerald-500" />
        </div>
    );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border-b border-border py-4 last:border-0">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
            {children}
        </div>
    );
}


function TabContentWrapper({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
    if (loading) return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Loading…</p>
        </div>
    );
    if (error) return (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-rose-500">
            <AlertCircle className="h-5 w-5" />
            <p className="text-xs">{error}</p>
        </div>
    );
    return <>{children}</>;
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Icon className="h-8 w-8 opacity-30" />
            <p className="text-xs">{message}</p>
        </div>
    );
}


function MarkdownBody({ text }: { text: string }) {
    // Split on blank lines for paragraphs, handle single newlines within paragraphs
    const paragraphs = text.split(/\n{2,}/);
    return (
        <div className="text-sm text-foreground/80 leading-relaxed space-y-2">
            {paragraphs.map((para, i) => {
                const lines = para.split('\n');
                return (
                    <p key={i}>
                        {lines.map((line, j) => (
                            <React.Fragment key={j}>
                                {line}
                                {j < lines.length - 1 && <br />}
                            </React.Fragment>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}

type Tab = 'conversation' | 'commits' | 'files';



export function PRDetailSlideOver({ pr, onClose }: { pr: any; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<Tab>('conversation');
    const [detail, setDetail] = useState<any>(null);
    const [commits, setCommits] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(false);
    const [filesLoading, setFilesLoading] = useState(false);
    const [commitsError, setCommitsError] = useState<string | null>(null);
    const [filesError, setFilesError] = useState<string | null>(null);
    const [commitsFetched, setCommitsFetched] = useState(false);
    const [filesFetched, setFilesFetched] = useState(false);

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Prevent body scroll while open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Reset when PR changes
    useEffect(() => {
        setCommits([]);
        setFiles([]);
        setCommitsError(null);
        setFilesError(null);
        setCommitsFetched(false);
        setFilesFetched(false);
        setActiveTab('conversation');
    }, [pr?.id, pr?.number]);

    const fetchCommits = useCallback(async () => {
        if (commitsFetched || commitsLoading) return;
        setCommitsLoading(true);
        setCommitsError(null);
        try {
            const res = await api.listPRCommitsById(pr.id);
            if (res.success) {
                setCommits(res.commits ?? res.data ?? []);
                setCommitsFetched(true);
            } else {
                setCommitsError(res.error || 'Failed to load commits');
            }
        } catch (e: any) {
            setCommitsError(e.message || 'Unknown error');
        } finally {
            setCommitsLoading(false);
        }
    }, [pr.id, commitsFetched, commitsLoading]);

    const fetchFiles = useCallback(async () => {
        if (filesFetched || filesLoading) return;
        setFilesLoading(true);
        setFilesError(null);
        try {
            const res = await api.listPRFilesById(pr.id);
            if (res.success) {
                setFiles(res.files ?? res.data ?? []);
                setFilesFetched(true);
            } else {
                setFilesError(res.error || 'Failed to load files');
            }
        } catch (e: any) {
            setFilesError(e.message || 'Unknown error');
        } finally {
            setFilesLoading(false);
        }
    }, [pr.id, filesFetched, filesLoading]);

    const handleTabClick = (tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'commits') fetchCommits();
        if (tab === 'files') fetchFiles();
    };

    if (!pr) return null;

    const updatedAt = pr.updatedAt || pr.updated_at;
    const createdAt = pr.createdAt || pr.created_at;
    const mergedAt = pr.mergedAt || pr.merged_at;
    const closedAt = pr.closedAt || pr.closed_at;

    const actionTime = formatRelativeTime(
        pr.status === 'merged' ? (mergedAt || updatedAt || createdAt) :
        pr.status === 'closed' ? (closedAt || updatedAt || createdAt) :
        (updatedAt || createdAt)
    );

    const actionVerb = pr.status === 'merged' ? 'merged' : pr.status === 'closed' ? 'closed' : 'opened';
    const reviewers: string[] = pr.requested_reviewers ?? [];
    const outcome = pr.latest_outcome;
    const labels: string[] = pr.labels ?? [];
    const reviews = pr.reviews ?? [];


    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide-over panel */}
            <div
                className="fixed inset-y-0 right-0 z-50 flex w-2/3 flex-col bg-card shadow-2xl border-l border-border"
                style={{ animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <StatusIcon status={pr.status} />
                        <div className="min-w-0">
                            <p className="text-xs text-muted-foreground font-medium mb-0.5">{pr.repository}</p>
                            <h2 className="text-base font-bold text-foreground leading-snug line-clamp-2">{pr.title}</h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/80">{pr.author}</span>
                                {' '}{actionVerb} #{pr.number} {actionTime}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-border px-5 text-sm">
                    {([
                        { id: 'conversation', icon: MessageSquare, label: 'Conversation' },
                        { id: 'commits',      icon: GitCommit,     label: 'Commits',      count: pr.commits_count },
                        { id: 'files',        icon: FileText,      label: 'Files changed', count: pr.changed_files },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs transition-colors ${
                                activeTab === tab.id
                                    ? 'border-b-2 border-primary font-medium text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                            {'count' in tab && (tab.count ?? 0) > 0 && (
                                <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] font-bold">{tab.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Body: scrollable two-column layout */}
                <div className="flex min-h-0 flex-1 overflow-hidden">
                    {/* Main content */}
                    <div className="scroll-slim flex-1 overflow-y-auto px-5 py-4 space-y-5">

                        {/* ── CONVERSATION TAB ── */}
                        {activeTab === 'conversation' && (<>
                            {/* Status badge row */}
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={variantForPRStatus(pr.status)} className="uppercase text-[10px] font-bold tracking-wider px-2.5 py-1">
                                    {pr.status === 'merged' ? '✓ Merged' : pr.status === 'open' ? '⬤ Open' : pr.status}
                                </Badge>
                                {pr.isDraft && <Badge variant="outline" className="text-xs">Draft</Badge>}
                                {outcome && (
                                    <Badge variant={toneForStatus(outcome)} className="capitalize text-xs">
                                        {outcome === 'changes_requested' ? 'Changes requested' : outcome}
                                    </Badge>
                                )}
                                {pr.url && (
                                    <a
                                        href={pr.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Open on GitHub <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>

                            {/* Branch info */}
                            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs font-mono">
                                <span className="text-muted-foreground">base: </span>
                                <span className="font-semibold text-foreground">{pr.baseBranch || pr.base_branch || 'main'}</span>
                                <span className="mx-2 text-muted-foreground">←</span>
                                <span className="text-muted-foreground">head: </span>
                                <span className="font-semibold text-foreground">{pr.branch || pr.head_branch || pr.headRefName || '—'}</span>
                            </div>

                            {/* Body / Description */}
                            {pr.body ? (
                                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Description</p>
                                    <MarkdownBody text={pr.body} />
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                                    No description provided.
                                </div>
                            )}

                            {/* Lead AI summary */}
                            {pr.lead_summary && (
                                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                                    <p className="text-xs font-semibold text-primary mb-1.5">🤖 AI Lead Summary</p>
                                    <p className="text-sm text-foreground/80 leading-relaxed">{pr.lead_summary}</p>
                                </div>
                            )}

                            {/* Diff stats */}
                            {(pr.additions > 0 || pr.deletions > 0) && (
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-emerald-500 font-mono font-semibold">+{pr.additions}</span>
                                    <span className="text-rose-400 font-mono font-semibold">−{pr.deletions}</span>
                                    <div className="flex gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => {
                                            const total = (pr.additions || 0) + (pr.deletions || 0);
                                            const addRatio = total > 0 ? (pr.additions / total) : 0;
                                            const filled = Math.round(addRatio * 5);
                                            return <div key={i} className={`h-2.5 w-4 rounded-[2px] ${i < filled ? 'bg-emerald-500' : 'bg-rose-400'}`} />;
                                        })}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{pr.changed_files || 0} files</span>
                                </div>
                            )}

                            {/* Reviews timeline */}
                            {reviews.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Review Activity</p>
                                    <div className="space-y-2">
                                        {reviews.slice(0, 5).map((review: any, i: number) => (
                                            <div key={review.id || i} className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-3">
                                                <Avatar login={review.reviewer || review.author || '?'} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="font-medium text-foreground">{review.reviewer || review.author || 'Unknown'}</span>
                                                        {review.outcome && (
                                                            <Badge variant={toneForStatus(review.outcome)} className="text-[10px] h-4 px-1 capitalize">
                                                                {review.outcome === 'changes_requested' ? 'Changes requested' : review.outcome}
                                                            </Badge>
                                                        )}
                                                        <span className="ml-auto text-muted-foreground">{formatRelativeTime(review.createdAt || review.created_at)}</span>
                                                    </div>
                                                    {review.summary && (
                                                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{review.summary}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ── COMMITS TAB ── */}
                        {activeTab === 'commits' && (
                            <TabContentWrapper loading={commitsLoading} error={commitsError}>
                                {commits.length === 0 ? (
                                    <EmptyState icon={GitCommit} message="No commits found." />
                                ) : (
                                    <div className="relative pl-5">
                                        {/* vertical line */}
                                        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
                                        <div className="space-y-3">
                                            {commits.map((c: any, i: number) => {
                                                const sha: string = c.sha || c.oid || '';
                                                const msg: string = c.message || c.commit?.message || '(no message)';
                                                const firstLine = msg.split('\n')[0];
                                                const author: string = c.author?.login || c.commit?.author?.name || c.committer?.login || 'unknown';
                                                const date = c.commit?.author?.date || c.date || c.commit?.committer?.date;
                                                return (
                                                    <div key={sha || i} className="flex items-start gap-3">
                                                        {/* dot */}
                                                        <div className="relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-card" />
                                                        <div className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                                                            <p className="text-xs font-medium text-foreground leading-snug mb-1">{firstLine}</p>
                                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                {author && <span className="flex items-center gap-1"><Avatar login={author} size="sm" />{author}</span>}
                                                                {date && <span>{formatRelativeTime(date)}</span>}
                                                                {sha && (
                                                                    <code className="ml-auto font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                                                                        {sha.slice(0, 7)}
                                                                    </code>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </TabContentWrapper>
                        )}

                        {/* ── FILES CHANGED TAB ── */}
                        {activeTab === 'files' && (
                            <TabContentWrapper loading={filesLoading} error={filesError}>
                                {files.length === 0 ? (
                                    <EmptyState icon={FileText} message="No files found." />
                                ) : (
                                    <div className="space-y-1.5">
                                        {/* Summary bar */}
                                        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs mb-3">
                                            <span className="font-medium text-foreground">{files.length} files changed</span>
                                            <span className="text-emerald-500 font-mono font-semibold">+{files.reduce((s: number, f: any) => s + (f.additions ?? 0), 0)}</span>
                                            <span className="text-rose-400 font-mono font-semibold">−{files.reduce((s: number, f: any) => s + (f.deletions ?? 0), 0)}</span>
                                        </div>
                                        {files.map((f: any, i: number) => {
                                            const fname: string = f.filename || f.path || f.name || `file-${i}`;
                                            const add: number = f.additions ?? 0;
                                            const del: number = f.deletions ?? 0;
                                            const total = add + del;
                                            const addRatio = total > 0 ? add / total : 0;
                                            const filledBars = Math.round(addRatio * 5);
                                            const status: string = f.status || '';
                                            const statusColor =
                                                status === 'added'   ? 'text-emerald-500' :
                                                status === 'removed' ? 'text-rose-500' :
                                                status === 'renamed' ? 'text-amber-500' :
                                                'text-muted-foreground';
                                            return (
                                                <div key={fname} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                                                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    <span className={`text-[10px] font-medium uppercase tracking-wide w-12 shrink-0 ${statusColor}`}>{status || 'M'}</span>
                                                    <span className="text-xs font-mono text-foreground flex-1 truncate" title={fname}>{fname}</span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {total > 0 && (
                                                            <div className="flex gap-0.5">
                                                                {Array.from({ length: 5 }).map((_, bi) => (
                                                                    <div key={bi} className={`h-2 w-2.5 rounded-[2px] ${bi < filledBars ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {add > 0 && <span className="text-[10px] font-mono text-emerald-500">+{add}</span>}
                                                        {del > 0 && <span className="text-[10px] font-mono text-rose-400">−{del}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </TabContentWrapper>
                        )}
                    </div>

                    {/* Sidebar */}
                    <aside className="scroll-slim w-56 shrink-0 overflow-y-auto border-l border-border px-4 py-4 text-sm">
                        <SidebarSection title="Reviewers">
                            {reviewers.length > 0 ? reviewers.map((r: string) => (
                                <div key={r} className="flex items-center gap-2 mb-2">
                                    <Avatar login={r} size="sm" />
                                    <span className="text-xs text-foreground font-medium">{r}</span>
                                </div>
                            )) : <p className="text-xs text-muted-foreground">No reviewers</p>}
                        </SidebarSection>

                        <SidebarSection title="Labels">
                            {labels.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {labels.map((l: string) => (
                                        <span key={l} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium">
                                            <Tag className="h-2.5 w-2.5" /> {l}
                                        </span>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-muted-foreground">None yet</p>}
                        </SidebarSection>

                        <SidebarSection title="Scores">
                            {[
                                { label: 'Risk', value: pr.risk_score, danger: (pr.risk_score ?? 0) > 70 },
                                { label: 'Impact', value: pr.impact_score },
                                { label: 'Priority', value: pr.priority_score },
                            ].map(s => (
                                <div key={s.label} className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-muted-foreground">{s.label}</span>
                                    <span className={`text-xs font-bold tabular-nums ${s.danger ? 'text-rose-500' : 'text-foreground'}`}>
                                        {s.value ?? '—'}
                                    </span>
                                </div>
                            ))}
                        </SidebarSection>

                        {pr.milestone && (
                            <SidebarSection title="Milestone">
                                <div className="flex items-center gap-1 text-xs text-foreground">
                                    <Milestone className="h-3 w-3 text-muted-foreground" />
                                    {pr.milestone}
                                </div>
                            </SidebarSection>
                        )}

                        <SidebarSection title="Timestamps">
                            {[
                                { label: 'Created', value: createdAt },
                                { label: 'Updated', value: updatedAt },
                                mergedAt && { label: 'Merged', value: mergedAt },
                                closedAt && { label: 'Closed', value: closedAt },
                            ].filter(Boolean).map((t: any) => (
                                <div key={t.label} className="flex items-start gap-1.5 mb-1.5">
                                    <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="text-[10px] text-muted-foreground">{t.label}</p>
                                        <p className="text-xs text-foreground font-medium">{formatRelativeTime(t.value)}</p>
                                    </div>
                                </div>
                            ))}
                        </SidebarSection>
                    </aside>
                </div>
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0.6; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
            `}</style>
        </>
    );
}
