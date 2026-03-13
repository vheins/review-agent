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
                            Filter
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
                                    <h3 className="font-semibold">Filter Queue</h3>
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
                                            {repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
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
                        <table className="w-full text-left text-sm">
                            <thead className="border-b bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">TITLE</th>
                                    <th className="px-4 py-3 font-medium">STATUS</th>
                                    <th className="px-4 py-3 font-medium">AUTHOR</th>
                                    <th className="px-4 py-3 font-medium">LATEST OUTCOME</th>
                                    <th className="px-4 py-3 font-medium">LAST UPDATED</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredPrs.length ? filteredPrs.map((pr) => (
                                    <tr key={pr.id} className="hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => {
                                        setSelectedPrId(pr.id);
                                    }}>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-foreground line-clamp-1">{pr.title}</span>
                                                <span className="text-xs text-muted-foreground">#{pr.number} opened in {pr.repository}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge variant={variantForPRStatus(pr.status)} className="uppercase text-[10px] font-bold tracking-wider">
                                                {pr.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full bg-sky-500/10 flex items-center justify-center text-[10px] font-bold text-sky-600">
                                                    {pr.author?.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium">{pr.author}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <Badge variant={toneForStatus(pr.latest_outcome ?? 'pending')} className="capitalize">
                                                {pr.latest_outcome ?? 'pending'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-4 text-muted-foreground">
                                            {formatRelativeTime(pr.updated_at || pr.created_at)}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="h-24 text-center">
                                            <EmptyState message="No pull requests found." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
