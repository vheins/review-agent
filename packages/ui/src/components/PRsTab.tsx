import React from 'react';
import { GitPullRequest, FileWarning, Settings2, Clock3, ListFilter, LayoutList, Columns, Command } from 'lucide-react';
import { Button } from './ui/button.jsx';
import { Card } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Input } from './ui/input.jsx';
import { Select } from './ui/select.jsx';
import { MetricCard, EmptyState } from './common.tsx';
import { formatRelativeTime, toneForStatus, variantForPRStatus } from '../lib/formatters.js';

export function PRsTab({
    filteredPrs,
    prs,
    prFilters,
    setPrFilters,
    showFilterModal,
    setShowFilterModal,
    filterMenuRef,
    repositories,
    authorOptions,
    viewMode,
    setViewMode,
    currentPage,
    setCurrentPage,
    prMeta,
    itemsPerPage,
    setSelectedPrId,
    deferredSearch
}) {
    const totalPages = prMeta.totalPages || 1;

    const queueSummaryCards = [
        { label: 'In Queue', value: filteredPrs.filter((pr) => pr.status === 'open').length, description: `${prs.filter((pr) => pr.status === 'open').length} open`, icon: GitPullRequest },
        { label: 'Blocking', value: filteredPrs.filter((pr) => Number(pr.priority_score ?? 0) >= 85 || Number(pr.health_score ?? 100) <= 80).length, description: 'Needs operator attention', icon: FileWarning },
        { label: 'Needs Fix', value: filteredPrs.filter((pr) => pr.latest_outcome === 'changes_requested').length, description: 'Actionable remediation', icon: Settings2 },
        { label: 'Needs Review', value: filteredPrs.filter(p => p.status === 'open' && !p.latest_outcome).length, description: 'Waiting for first pass', icon: Clock3 }
    ];

    return (
        <div className="tab-page">
            <div className="mb-6 flex items-center justify-between">
                <div className="grid gap-1">
                    <h2 className="text-2xl font-bold tracking-tight">Pull Requests</h2>
                    <p className="text-muted-foreground">Manage and review pull requests across all repositories.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Button
                            data-filter-toggle="true"
                            variant={showFilterModal || prFilters.status || prFilters.repositoryId || prFilters.authorId || prFilters.search ? 'secondary' : 'outline'}
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => setShowFilterModal(!showFilterModal)}
                        >
                            <ListFilter className="mr-2 h-4 w-4" />
                            Filter PR
                            {(prFilters.status || prFilters.repositoryId || prFilters.authorId || prFilters.search) && (
                                <Badge variant="secondary" className="ml-2 h-4 px-1 py-0 text-[10px] rounded-sm">Active</Badge>
                            )}
                        </Button>
                        {showFilterModal && (
                            <div
                                ref={filterMenuRef}
                                className="absolute right-0 top-full z-[60] mt-2 w-[340px] md:w-[600px] rounded-xl border border-border bg-card shadow-xl p-4"
                            >
                                <div className="mb-4 flex items-center justify-between pb-2 border-b">
                                    <h3 className="font-semibold">Filter PR</h3>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPrFilters({ status: '', repositoryId: '', authorId: '', search: '' })}>
                                        Reset
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                                        <Select value={prFilters.status} onChange={(event) => setPrFilters((current) => ({ ...current, status: event.target.value }))}>
                                            <option value="">All</option>
                                            <option value="open">Open</option>
                                            <option value="merged">Merged</option>
                                            <option value="closed">Closed</option>
                                            <option value="rejected">Rejected</option>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">Repository</span>
                                        <Select value={prFilters.repositoryId} onChange={(event) => setPrFilters((current) => ({ ...current, repositoryId: event.target.value }))}>
                                            <option value="">All Repositories</option>
                                            {repositories.map((repo) => <option key={repo} value={repo}>{repo}</option>)}
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">Author</span>
                                        <Select value={prFilters.authorId} onChange={(event) => setPrFilters((current) => ({ ...current, authorId: event.target.value }))}>
                                            <option value="">All Authors</option>
                                            {authorOptions.map((author) => <option key={author} value={author}>{author}</option>)}
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">Search</span>
                                        <div className="relative">
                                            <Command className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                className="pl-9 h-9"
                                                value={prFilters.search} 
                                                onChange={(event) => setPrFilters((current) => ({ ...current, search: event.target.value }))} 
                                                placeholder="Search PRs..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col w-[1px] h-4 bg-border mx-1" />
                    <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
                        <Button
                            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => setViewMode('table')}
                        >
                            <LayoutList className="mr-2 h-4 w-4" />
                            Table
                        </Button>
                        <Button
                            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => setViewMode('kanban')}
                        >
                            <Columns className="mr-2 h-4 w-4" />
                            Kanban
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4 mb-6">
                {queueSummaryCards.map((card) => (
                    <MetricCard key={card.label} {...card} />
                ))}
            </div>

            {viewMode === 'table' ? (
                <div className="rounded-xl border bg-card text-card-foreground shadow">
                    <div className="scroll-slim overflow-auto">
                        <ul className="divide-y">
                            {filteredPrs.length ? filteredPrs.map((pr) => {
                                const reviewers: string[] = pr.requested_reviewers ?? [];
                                const commentCount = (pr.comments_count ?? 0) + (pr.review_comments_count ?? 0);
                                const outcome = pr.latest_outcome;

                                // Choose icon color based on status
                                const iconColor =
                                    pr.status === 'open' ? 'text-emerald-500' :
                                    pr.status === 'merged' ? 'text-purple-500' :
                                    'text-rose-400';

                                // Subtitle: action verb
                                const actionVerb =
                                    pr.status === 'merged' ? 'merged' :
                                    pr.status === 'closed' ? 'closed' :
                                    'opened';

                                const actionTime = formatRelativeTime(
                                    pr.status === 'merged' ? (pr.mergedAt || pr.merged_at || pr.updatedAt || pr.updated_at || pr.createdAt || pr.created_at) :
                                    pr.status === 'closed' ? (pr.closedAt || pr.closed_at || pr.updatedAt || pr.updated_at || pr.createdAt || pr.created_at) :
                                    (pr.updatedAt || pr.updated_at || pr.createdAt || pr.created_at)
                                );

                                return (
                                    <li
                                        key={pr.id}
                                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedPrId(pr.id)}
                                    >
                                        {/* Status icon */}
                                        <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                                            {pr.status === 'merged' ? (
                                                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-label="merged"><path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"/></svg>
                                            ) : pr.status === 'closed' ? (
                                                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-label="closed"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.749.749 0 0 1 1.06 1.06l-.97.97.97.97a.749.749 0 0 1-1.06 1.06l-.97-.97-.97.97a.749.749 0 0 1-1.06-1.06l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM3.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>
                                            ) : (
                                                <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-label="open"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>
                                            )}
                                        </div>

                                        {/* Main content */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                <span className="text-xs font-medium text-muted-foreground shrink-0">{pr.repository}</span>
                                                <span className="font-semibold text-sm text-foreground leading-snug">{pr.title}</span>
                                                {pr.isDraft && (
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 ml-1">Draft</Badge>
                                                )}
                                                {outcome === 'approved' && (
                                                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-emerald-500 shrink-0 ml-0.5" aria-label="approved"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>
                                                )}
                                            </div>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                                <span>#{pr.number}</span>
                                                <span>by <span className="font-medium text-foreground/80">{pr.author}</span> was {actionVerb} {actionTime}</span>
                                                {outcome && outcome !== 'pending' && (
                                                    <>
                                                        <span aria-hidden>•</span>
                                                        <span className={
                                                            outcome === 'approved' ? 'text-emerald-600 font-medium' :
                                                            outcome === 'changes_requested' ? 'text-amber-600 font-medium' :
                                                            ''
                                                        }>
                                                            {outcome === 'changes_requested' ? 'Changes requested' :
                                                             outcome === 'approved' ? 'Approved' :
                                                             outcome}
                                                        </span>
                                                    </>
                                                )}
                                                {pr.labels?.length > 0 && pr.labels.slice(0, 3).map((label: string) => (
                                                    <span key={label} className="inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium">{label}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Right side: reviewers + comments */}
                                        <div className="flex shrink-0 items-center gap-3 pl-2">
                                            {reviewers.length > 0 && (
                                                <div className="flex -space-x-1.5">
                                                    {reviewers.slice(0, 3).map((r: string) => (
                                                        <div
                                                            key={r}
                                                            className="h-5 w-5 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 ring-2 ring-card flex items-center justify-center text-[8px] font-bold text-white"
                                                            title={r}
                                                        >
                                                            {r.charAt(0).toUpperCase()}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {commentCount > 0 && (
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>
                                                    <span>{commentCount}</span>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            }) : (
                                <li className="h-24 flex items-center justify-center">
                                    <EmptyState message="No pull requests found." />
                                </li>
                            )}
                        </ul>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t p-4">
                            <div className="text-sm text-muted-foreground">
                                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, prMeta.total || filteredPrs.length)} of {prMeta.total || filteredPrs.length} PRs
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground px-2">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-4">
                    {['open', 'merged', 'closed', 'rejected'].map(status => (
                        <div key={status} className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{status}</h3>
                                <Badge variant="secondary" className="rounded-full">{filteredPrs.filter(p => p.status === status).length}</Badge>
                            </div>
                            <div className="flex flex-col gap-3">
                                {filteredPrs.filter(p => p.status === status).map(pr => (
                                    <Card key={pr.id} className="p-4 hover:ring-2 ring-primary/20 transition-all cursor-pointer" onClick={() => setSelectedPrId(pr.id)}>
                                        <div className="flex flex-col gap-3">
                                            <div className="text-sm font-semibold leading-tight">[{pr.repository}] {pr.title}</div>
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span>#{pr.number}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
                                                        {pr.author?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span>{pr.author}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Badge variant={toneForStatus(pr.latest_outcome ?? 'pending')} className="text-[10px] h-5 px-1.5">
                                                    {pr.latest_outcome ?? 'pending'}
                                                </Badge>
                                                {pr.risk_score > 70 && <Badge variant="danger" className="text-[10px] h-5 px-1.5">High Risk</Badge>}
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                                {filteredPrs.filter(p => p.status === status).length === 0 && (
                                    <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                                        Empty
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
