import React, { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
    Activity,
    BellRing,
    BarChart3,
    ChevronRight,
    Clock3,
    ClipboardList,
    Command,
    FileWarning,
    Gauge,
    GitPullRequest,
    LayoutGrid,
    LaptopMinimal,
    Logs,
    MoonStar,
    Bot,
    PanelLeft,
    PlayCircle,
    Plus,
    RefreshCw,
    Settings2,
    ShieldCheck,
    ShieldAlert,
    Sparkles,
    SquareTerminal,
    SunMedium,
    Users,
    MessageSquarePlus,
    ListTodo
} from 'lucide-react';
import './styles.css';
import { Button } from './components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card.jsx';
import { Badge } from './components/ui/badge.jsx';
import { Input } from './components/ui/input.jsx';
import { Select } from './components/ui/select.jsx';
import { Textarea } from './components/ui/textarea.jsx';
import { cn } from './lib/utils.js';
import { api } from './api-helper.js';

const tabs = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'prs', label: 'PRs', icon: GitPullRequest },
    { id: 'metrics', label: 'Metrics', icon: BarChart3 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'security', label: 'Security', icon: ShieldAlert },
    { id: 'config', label: 'Configuration', icon: ClipboardList },
    { id: 'logs', label: 'Logs', icon: Logs }
];

const defaultRuleSample = 'const query = `SELECT * FROM users WHERE id = ${userId}`;';

function formatDuration(seconds) {
    if (!seconds) return '0m';
    const totalSeconds = Math.round(Number(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatRelativeTime(value) {
    if (!value) return 'Unknown';
    const diffMs = new Date(value).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)}m ${diffMinutes < 0 ? 'ago' : 'from now'}`;
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ${diffHours < 0 ? 'ago' : 'from now'}`;
    const diffDays = Math.round(diffHours / 24);
    return `${Math.abs(diffDays)}d ${diffDays < 0 ? 'ago' : 'from now'}`;
}

function resolveTheme(mode) {
    if (mode === 'dark' || mode === 'light') return mode;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredThemeMode() {
    const stored = window.localStorage.getItem('agentic-bunshin-theme');
    return ['system', 'dark', 'light'].includes(stored) ? stored : 'system';
}

function toneForStatus(value) {
    if (['approved', 'success', 'passed', 'available', 'connected'].includes(String(value).toLowerCase())) return 'success';
    if (['critical', 'error', 'failed', 'blocking', 'disconnected'].includes(String(value).toLowerCase())) return 'danger';
    if (['warn', 'warning', 'queued', 'unavailable', 'changes_requested'].includes(String(value).toLowerCase())) return 'warn';
    return 'default';
}

function statusDotClass(running) {
    return running ? 'bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.16)]' : 'bg-slate-400';
}

function MetricCard({ label, value, description }) {
    return (
        <Card className="overflow-hidden p-5">
            <CardHeader className="gap-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <p className="eyebrow">{label}</p>
                        <CardTitle className="text-4xl font-black">{value}</CardTitle>
                    </div>
                    <div className="rounded-lg border border-border bg-panel p-2 text-muted-foreground">
                        <LayoutGrid className="h-4 w-4" />
                    </div>
                </div>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}

function Section({ eyebrow, title, description, action, children, className }) {
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

function ProgressBar({ label, value, subtitle }) {
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

function EmptyState({ message }) {
    return (
        <div className="rounded-[1.5rem] border border-dashed border-border bg-panel/70 px-4 py-10 text-center text-sm text-muted-foreground">
            {message}
        </div>
    );
}

function App() {
    const [selectedTab, setSelectedTab] = useState('overview');
    const [rangeDays, setRangeDays] = useState(30);
    const [themeMode, setThemeMode] = useState(getStoredThemeMode());
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const createMenuRef = useRef(null);
    const [runtimeConfig, setRuntimeConfig] = useState(null);
    const [snapshot, setSnapshot] = useState(null);
    const [prs, setPrs] = useState([]);
    const [selectedPrId, setSelectedPrId] = useState(null);
    const [prDetail, setPrDetail] = useState(null);
    const [teamSecurity, setTeamSecurity] = useState(null);
    const [configData, setConfigData] = useState(null);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [activityItems, setActivityItems] = useState([]);
    const [wsStatus, setWsStatus] = useState('Disconnected');
    const [apiStatus, setApiStatus] = useState('Unknown');
    const [repositoryId, setRepositoryId] = useState('');
    const [configValidation, setConfigValidation] = useState('Select a repository to load its current configuration.');
    const [ruleFeedback, setRuleFeedback] = useState('Rule validation output will appear here.');
    const [prFilters, setPrFilters] = useState({ status: '', repositoryId: '', authorId: '', search: '' });
    const [configForm, setConfigForm] = useState({
        reviewInterval: 600,
        reviewMode: 'comment',
        aiExecutor: 'gemini',
        autoMerge: 'true',
        severityThreshold: 10,
        autoMergeHealthThreshold: 60,
        logLevel: 'info',
        requiredChecks: 'tests,review'
    });
    const [ruleForm, setRuleForm] = useState({
        id: '',
        rule_name: '',
        rule_type: 'regex',
        severity: 'critical',
        pattern: '',
        message: '',
        sampleCode: defaultRuleSample
    });
    const deferredSearch = useDeferredValue(prFilters.search);

    const applyTheme = useEffectEvent((mode) => {
        const resolvedTheme = resolveTheme(mode);
        document.body.dataset.theme = resolvedTheme;
        document.documentElement.style.colorScheme = resolvedTheme;
        window.localStorage.setItem('agentic-bunshin-theme', mode);
    });

    useEffect(() => {
        applyTheme(themeMode);
    }, [themeMode, applyTheme]);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (themeMode === 'system') {
                applyTheme('system');
            }
        };
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, [themeMode, applyTheme]);

    // Close create menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (createMenuRef.current && !createMenuRef.current.contains(event.target) && !event.target.closest('button[type="button"]')) {
                setShowCreateMenu(false);
            }
        }
        
        if (showCreateMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showCreateMenu]);

    const prependLog = useEffectEvent((type, message) => {
        // Convert message to string if it's not already
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        
        startTransition(() => {
            setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, type, message: `[${new Date().toLocaleTimeString()}] ${messageStr.trim()}` }, ...current].slice(0, 200));
            setActivityItems((current) => [{
                id: `${Date.now()}-${Math.random()}`,
                title: type === 'error' ? 'Runtime warning' : 'Live event',
                description: messageStr.trim(),
                occurred_at: new Date().toISOString(),
                tone: type
            }, ...current].slice(0, 8));
        });
    });

    const refreshSnapshot = useEffectEvent(async (days = rangeDays) => {
        const result = await api.getDashboardSnapshot({ rangeDays: days });
        if (!result.success) {
            const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
            setApiStatus(errorMsg);
            prependLog('error', errorMsg);
            return null;
        }

        setSnapshot(result.snapshot);
        setApiStatus('Connected');
        setActivityItems(result.snapshot.recentActivity ?? []);
        return result.snapshot;
    });

    const refreshPRs = useEffectEvent(async () => {
        const result = await api.listPRs({
            status: '',
            repositoryId: '',
            authorId: '',
            search: ''
        });
        if (!result.success) {
            prependLog('error', result.error);
            return;
        }

        setPrs(result.prs);
        setSelectedPrId((current) => current ?? result.prs[0]?.id ?? null);
    });

    const refreshTeamSecurity = useEffectEvent(async () => {
        const result = await api.getTeamSecurityData();
        if (result.success) {
            setTeamSecurity(result.data);
        } else {
            prependLog('error', result.error);
        }
    });

    const refreshRepositoryConfig = useEffectEvent(async (nextRepositoryId) => {
        const currentRepositoryId = Number(nextRepositoryId || repositoryId);
        if (!currentRepositoryId) return;
        const result = await api.getRepositoryConfigData(currentRepositoryId);
        if (!result.success) {
            setConfigValidation(result.error);
            return;
        }
        setConfigData(result.payload);
        setRepositoryId(String(currentRepositoryId));
        setConfigValidation(`Editing ${result.payload.repository.full_name} on ${result.payload.repository.default_branch}.`);
        setConfigForm({
            reviewInterval: result.payload.config.reviewInterval ?? 600,
            reviewMode: result.payload.config.reviewMode ?? 'comment',
            aiExecutor: result.payload.config.aiExecutor ?? 'gemini',
            autoMerge: String(Boolean(result.payload.config.autoMerge)),
            severityThreshold: result.payload.config.severityThreshold ?? 10,
            autoMergeHealthThreshold: result.payload.config.autoMergeHealthThreshold ?? 60,
            logLevel: result.payload.config.logLevel ?? 'info',
            requiredChecks: Array.isArray(result.payload.config.requiredChecks) ? result.payload.config.requiredChecks.join(',') : String(result.payload.config.requiredChecks ?? 'tests,review')
        });
    });

    useEffect(() => {
        let mounted = true;

        (async () => {
            const runtimeResult = await window.electronAPI.getRuntimeConfig();
            if (!mounted) return;
            if (!runtimeResult.success) {
                prependLog('error', runtimeResult.error);
                return;
            }

            setRuntimeConfig(runtimeResult.config);
            const latestSnapshot = await refreshSnapshot(rangeDays);
            await refreshPRs(prFilters);
            await refreshTeamSecurity();
            if (latestSnapshot?.repositories?.length) {
                setRepositoryId(String(latestSnapshot.repositories[0].id));
                await refreshRepositoryConfig(latestSnapshot.repositories[0].id);
            }
        })();

        window.electronAPI.onLogOutput?.((data) => prependLog(data.type, data.message));
        window.electronAPI.onReviewStopped?.((data) => {
            setRunning(false);
            prependLog('info', `Review process exited with code ${data.code}`);
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        refreshSnapshot(rangeDays);
    }, [rangeDays]);

    useEffect(() => {
        refreshPRs();
    }, []);

    useEffect(() => {
        if (!selectedPrId) return;
        (async () => {
            const result = await api.getPRDetail(selectedPrId);
            if (result.success) {
                setPrDetail(result.detail);
            }
        })();
    }, [selectedPrId]);

    useEffect(() => {
        if (!runtimeConfig?.wsUrl) return undefined;

        let reconnectTimer;
        let reconnectDelay = 1000;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 3; // Reduced from 5 to 3
        let socket;
        let isIntentionallyClosed = false;

        const connect = () => {
            // Stop reconnecting after max attempts
            if (reconnectAttempts >= maxReconnectAttempts) {
                setWsStatus('Disconnected');
                console.log(`WebSocket: Stopped reconnecting after ${maxReconnectAttempts} attempts. Backend server may not be running.`);
                return;
            }

            setWsStatus('Connecting');
            
            try {
                socket = new WebSocket(runtimeConfig.wsUrl);
                
                socket.addEventListener('open', () => {
                    reconnectDelay = 1000;
                    reconnectAttempts = 0; // Reset on successful connection
                    setWsStatus('Connected');
                    console.log('WebSocket: Connected successfully');
                    socket.send(JSON.stringify({
                        type: 'auth',
                        userId: runtimeConfig.wsUserId,
                        token: runtimeConfig.wsToken
                    }));
                });

                socket.addEventListener('message', async (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'auth_success') {
                        prependLog('info', 'WebSocket authenticated');
                        socket.send(JSON.stringify({ type: 'subscribe', channel: 'dashboard' }));
                        return;
                    }
                    if (data.type === 'subscription_success') {
                        prependLog('info', `Subscribed to ${data.channel}`);
                        return;
                    }
                    if (['review_started', 'review_progress', 'review_completed', 'review_failed'].includes(data.type)) {
                        prependLog(data.type === 'review_failed' ? 'warn' : 'info', `${data.type}: ${JSON.stringify(data.payload)}`);
                        await refreshSnapshot();
                        await refreshPRs();
                        return;
                    }
                    if (['metrics_update', 'pr_update'].includes(data.type)) {
                        prependLog('info', `Realtime update: ${data.type}`);
                        await refreshSnapshot();
                        await refreshPRs();
                        return;
                    }
                    if (data.type === 'health_alert') {
                        prependLog('error', `Health alert: ${JSON.stringify(data.payload)}`);
                        await refreshTeamSecurity();
                    }
                });

                socket.addEventListener('close', (event) => {
                    if (isIntentionallyClosed) {
                        setWsStatus('Disconnected');
                        return;
                    }
                    
                    if (event.wasClean) {
                        setWsStatus('Disconnected');
                        console.log('WebSocket: Connection closed cleanly');
                    } else {
                        reconnectAttempts++;
                        console.log(`WebSocket: Connection lost. Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
                        
                        if (reconnectAttempts < maxReconnectAttempts) {
                            setWsStatus('Reconnecting');
                            reconnectTimer = window.setTimeout(connect, reconnectDelay);
                            reconnectDelay = Math.min(reconnectDelay * 2, 15000);
                        } else {
                            setWsStatus('Disconnected');
                        }
                    }
                });

                socket.addEventListener('error', () => {
                    // Silently handle error - will be caught by close event
                    reconnectAttempts++;
                });
            } catch (error) {
                console.log('WebSocket: Connection error', error.message);
                setWsStatus('Error');
                reconnectAttempts++;
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectTimer = window.setTimeout(connect, reconnectDelay);
                    reconnectDelay = Math.min(reconnectDelay * 2, 15000);
                }
            }
        };

        connect();

        return () => {
            isIntentionallyClosed = true;
            window.clearTimeout(reconnectTimer);
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close(1000, 'Component unmounting');
            }
        };
    }, [runtimeConfig]);

    const repositories = snapshot?.repositories ?? [];
    const authorOptions = useMemo(() => {
        return Array.from(new Set(prs.map((pr) => pr.author).filter(Boolean))).sort();
    }, [prs]);
    const filteredPrs = useMemo(() => {
        return prs.filter((pr) => {
            if (prFilters.status && pr.status !== prFilters.status) return false;
            if (prFilters.repositoryId && String(repositories.find((repo) => repo.full_name === pr.repository)?.id ?? '') !== prFilters.repositoryId) return false;
            if (prFilters.authorId && pr.author !== prFilters.authorId) return false;
            if (deferredSearch) {
                const haystack = `${pr.title} ${pr.repository} ${pr.author}`.toLowerCase();
                if (!haystack.includes(deferredSearch.toLowerCase())) return false;
            }
            return true;
        });
    }, [prs, prFilters.status, prFilters.repositoryId, prFilters.authorId, deferredSearch, repositories]);

    const overviewCards = snapshot ? [
        { label: 'Open PRs', value: snapshot.overview.openPRs ?? 0, description: `${snapshot.overview.blockingPRs ?? 0} blocking right now` },
        { label: 'Avg Review Time', value: formatDuration(snapshot.overview.avgReviewSeconds), description: `${snapshot.metricsOverview.total_reviews ?? 0} completed reviews` },
        { label: 'SLA Compliance', value: `${snapshot.overview.slaComplianceRate ?? 0}%`, description: `${rangeDays}-day moving window` },
        { label: 'Health Score', value: Math.round(snapshot.overview.avgHealthScore ?? 0), description: 'Average PR health across tracked repos' }
    ] : [];
    const queueSummaryCards = [
        { label: 'In Queue', value: filteredPrs.length, hint: `${prs.filter((pr) => pr.status === 'open').length} open` },
        { label: 'Blocking', value: filteredPrs.filter((pr) => Number(pr.priority_score ?? 0) >= 85 || Number(pr.health_score ?? 100) <= 80).length, hint: 'Needs operator attention' },
        { label: 'Needs Fix', value: filteredPrs.filter((pr) => pr.latest_outcome === 'changes_requested').length, hint: 'Actionable remediation' }
    ];
    const metricsSummaryCards = snapshot ? [
        { label: 'Throughput', value: snapshot.metricsOverview.total_reviews ?? 0, description: `Reviews completed in the last ${rangeDays} days` },
        { label: 'Approval Confidence', value: `${Math.round((snapshot.approvalByExecutor ?? []).reduce((sum, item) => sum + Number(item.approval_rate ?? 0), 0) / Math.max((snapshot.approvalByExecutor ?? []).length, 1))}%`, description: 'Average approval rate across executors' },
        { label: 'Queue Pressure', value: snapshot.overview.blockingPRs ?? 0, description: 'Pull requests currently breaching guardrails' },
        { label: 'Repo Coverage', value: repositories.length, description: 'Repositories included in this operating window' }
    ] : [];
    const reviewTimeline = [
        ...(prDetail?.reviews ?? []).map((item) => ({
            id: `review-${item.id ?? item.started_at}`,
            title: `Review · ${item.executor_type}`,
            tone: item.outcome ?? item.status,
            detail: `${formatDuration(item.duration_seconds)} · ${formatRelativeTime(item.completed_at ?? item.started_at)}`
        })),
        ...(prDetail?.autoFixAttempts ?? []).map((item) => ({
            id: `autofix-${item.id ?? item.started_at}`,
            title: `Auto-fix · Attempt ${item.attempt_number}`,
            tone: item.status,
            detail: `${(item.issues_targeted ?? []).length} issues targeted · ${formatRelativeTime(item.started_at)}`
        })),
        ...(prDetail?.testRuns ?? []).map((item) => ({
            id: `testrun-${item.id ?? item.started_at}`,
            title: `${item.run_type} run`,
            tone: item.status,
            detail: `${formatDuration(item.duration_seconds)} · ${formatRelativeTime(item.started_at)}`
        }))
    ];
    const repositoryOpsRows = (snapshot?.configSummary ?? []).map((item) => ({
        repository: item.repository,
        mode: item.mode,
        interval: `${item.interval}s`,
        autoMerge: item.autoMerge ? 'Enabled' : 'Disabled',
        threshold: item.threshold
    }));
    const workspaceStatusCards = [
        { label: 'Agent Loop', value: running ? 'Live' : 'Standby', tone: running ? 'success' : 'default' },
        { label: 'Realtime', value: wsStatus, tone: toneForStatus(wsStatus) },
        { label: 'Repositories', value: String(repositories.length), tone: 'default' }
    ];

    const securityTrend = useMemo(() => {
        const findings = teamSecurity?.securityFindings ?? [];
        const byDate = new Map();
        findings.forEach((finding) => {
            const key = (finding.detected_at ?? new Date().toISOString()).slice(5, 10);
            byDate.set(key, (byDate.get(key) ?? 0) + 1);
        });
        return [...byDate.entries()].map(([label, value]) => ({ label, value }));
    }, [teamSecurity]);

    const activeTitle = tabs.find((tab) => tab.id === selectedTab)?.label ?? 'Overview';

    const selectedPr = prDetail?.pr ?? null;

    async function toggleAvailability(developer) {
        const result = await api.setDeveloperAvailability({
            developerId: developer.id,
            isAvailable: !developer.is_available,
            unavailableUntil: developer.is_available ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : null
        });
        if (result.success) {
            await refreshTeamSecurity();
            await refreshSnapshot();
        } else {
            prependLog('error', result.error);
        }
    }

    async function handleStart(once) {
        const result = await window.electronAPI.startReview({ once });
        if (result.success) {
            setRunning(true);
            prependLog('info', once ? 'Single review started' : 'Review loop started');
        } else {
            prependLog('error', result.message);
        }
    }

    async function handleExecuteNow() {
        const result = await window.electronAPI.executeNow();
        prependLog(result.success ? 'info' : 'error', result.message);
    }

    async function handleStop() {
        const result = await window.electronAPI.stopReview();
        if (result.success) {
            setRunning(false);
        }
        prependLog(result.success ? 'info' : 'error', result.message);
    }

    async function handleExport() {
        const result = await api.exportMetricsData({
            filters: {
                startDate: new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString()
            },
            format: 'csv'
        });
        prependLog(result.success ? 'info' : 'error', result.success ? `Export created: ${result.result.fileName}` : result.error);
    }

    async function handleSaveConfig(event) {
        event.preventDefault();
        const result = await api.saveRepositoryConfigData({
            repositoryId: Number(repositoryId),
            config: {
                ...configForm,
                reviewInterval: Number(configForm.reviewInterval),
                severityThreshold: Number(configForm.severityThreshold),
                autoMergeHealthThreshold: Number(configForm.autoMergeHealthThreshold),
                autoMerge: configForm.autoMerge === 'true',
                requiredChecks: String(configForm.requiredChecks).split(',').map((value) => value.trim()).filter(Boolean)
            }
        });
        setConfigValidation(result.success ? 'Configuration saved successfully.' : result.error);
        if (result.success) {
            await refreshRepositoryConfig(repositoryId);
        }
    }

    async function handleTestRule() {
        const result = await api.testCustomRule({
            rule: {
                id: ruleForm.id ? Number(ruleForm.id) : undefined,
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                severity: ruleForm.severity,
                pattern: ruleForm.pattern,
                message: ruleForm.message
            },
            sampleCode: ruleForm.sampleCode
        });
        setRuleFeedback(result.success ? `Rule matched ${result.violations.length} violation(s).` : result.error);
    }

    async function handleSaveRule(event) {
        event.preventDefault();
        const result = await api.saveCustomRule({
            repositoryId: Number(repositoryId),
            rule: {
                id: ruleForm.id ? Number(ruleForm.id) : undefined,
                rule_name: ruleForm.rule_name,
                rule_type: ruleForm.rule_type,
                severity: ruleForm.severity,
                pattern: ruleForm.pattern,
                message: ruleForm.message
            }
        });
        setRuleFeedback(result.success ? `Rule saved with id ${result.ruleId}.` : result.error);
        if (result.success) {
            setRuleForm((current) => ({ ...current, id: '', rule_name: '', pattern: '', message: '', sampleCode: defaultRuleSample }));
            await refreshRepositoryConfig(repositoryId);
        }
    }

    function renderOverview() {
        return (
            <div className="tab-page">
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                    {overviewCards.map((card) => <MetricCard key={card.label} {...card} />)}
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
                    <Card className="p-5">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-xl border border-border bg-panel p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <SquareTerminal className="h-4 w-4" />
                                    Agent Loop
                                </div>
                                <div className="text-2xl font-semibold">{running ? 'Active' : 'Standby'}</div>
                                <p className="mt-1 text-sm text-muted-foreground">Ready for continuous review execution.</p>
                            </div>
                            <div className="rounded-xl border border-border bg-panel p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Gauge className="h-4 w-4" />
                                    API Health
                                </div>
                                <div className="text-2xl font-semibold">{apiStatus}</div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {apiStatus === 'Connected' 
                                        ? 'Dashboard snapshot and control endpoints.' 
                                        : (typeof apiStatus === 'string' && apiStatus.includes('Database not initialized'))
                                        ? 'Start backend server with: yarn server'
                                        : 'Backend server not running. Run: yarn server'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-border bg-panel p-4">
                                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <BellRing className="h-4 w-4" />
                                    Live Stream
                                </div>
                                <div className="text-2xl font-semibold">{wsStatus}</div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {wsStatus === 'Connected' 
                                        ? 'Realtime dashboard events and health alerts.' 
                                        : wsStatus === 'Disconnected'
                                        ? 'Backend server not running. Run: yarn server'
                                        : 'Attempting to connect to backend...'}
                                </p>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-5">
                        <div className="space-y-4">
                            <div>
                                <p className="eyebrow">Quick Actions</p>
                                <h3 className="mt-2 text-xl font-bold">Runbook</h3>
                            </div>
                            <div className="grid gap-2">
                                <Button variant="outline" className="justify-between" onClick={() => setSelectedTab('prs')}>
                                    Review queue
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="justify-between" onClick={() => setSelectedTab('security')}>
                                    Security triage
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="justify-between" onClick={() => setSelectedTab('config')}>
                                    Repository settings
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
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
                                        <div className="text-base font-semibold">{pr.title}</div>
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

    function renderPRs() {
        return (
            <div className="tab-page">
                <Section eyebrow="Filters" title="Current Queue" description="Search and narrow open work across repositories and authors.">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                            <Input value={prFilters.search} onChange={(event) => setPrFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search PR title, repository, or author" />
                        </div>
                    </div>
                </Section>
                <div className="grid gap-4 md:grid-cols-3">
                    {queueSummaryCards.map((card) => (
                        <Card key={card.label} className="p-4">
                            <div className="grid gap-2">
                                <div className="eyebrow">{card.label}</div>
                                <div className="text-2xl font-black">{card.value}</div>
                                <div className="text-sm text-muted-foreground">{card.hint}</div>
                            </div>
                        </Card>
                    ))}
                </div>
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                    <Section eyebrow="Pull Requests" title="Current Queue" description="Queue ordered for triage. Select an item to inspect operator-ready context on the right.">
                        <div className="grid gap-4">
                            <Card className="border-dashed p-4">
                                <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-xl border border-border bg-panel/70 p-3">
                                        <div className="eyebrow">Focus</div>
                                        <div className="mt-2 text-sm font-medium">Clear blocking items first</div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-panel/70 p-3">
                                        <div className="eyebrow">Next Move</div>
                                        <div className="mt-2 text-sm font-medium">Run auto-fix on failed health gates</div>
                                    </div>
                                    <div className="rounded-xl border border-border bg-panel/70 p-3">
                                        <div className="eyebrow">Escalation</div>
                                        <div className="mt-2 text-sm font-medium">Send complex security findings to human review</div>
                                    </div>
                                </div>
                            </Card>
                            <div className="grid gap-3">
                            {filteredPrs.length ? filteredPrs.map((pr) => (
                                <button
                                    key={pr.id}
                                    type="button"
                                    onClick={() => setSelectedPrId(pr.id)}
                                    className={cn('panel-surface w-full p-4 text-left transition hover:-translate-y-0.5', selectedPrId === pr.id && 'ring-2 ring-sky-400/30')}
                                >
                                    <div className="grid gap-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <strong className="text-base font-semibold">{`#${pr.github_pr_id} ${pr.title}`}</strong>
                                            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Triage</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge>{pr.status}</Badge>
                                            <Badge variant={toneForStatus(pr.latest_outcome ?? 'pending')}>{pr.latest_outcome ?? 'pending'}</Badge>
                                            <Badge>{pr.review_level ?? 'unassigned'}</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                                            <span>{pr.repository}</span>
                                            <span>{pr.author}</span>
                                            <span>Priority {pr.priority_score ?? 0}</span>
                                            <span>Health {pr.health_score ?? 'n/a'}</span>
                                        </div>
                                    </div>
                                </button>
                            )) : <EmptyState message="No pull requests found." />}
                            </div>
                        </div>
                    </Section>
                    <Section eyebrow="PR Detail" title={selectedPr ? `#${selectedPr.github_pr_id} ${selectedPr.title}` : 'Select a PR'} description={selectedPr ? `${selectedPr.repository} · ${selectedPr.author}` : 'Choose a pull request from the queue.'}>
                        {selectedPr ? (
                            <div className="grid gap-4">
                                <div className="grid gap-3 md:grid-cols-4">
                                    <Card className="p-4">
                                        <div className="eyebrow">Status</div>
                                        <div className="mt-2 text-lg font-semibold">{selectedPr.status}</div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="eyebrow">Review Level</div>
                                        <div className="mt-2 text-lg font-semibold">{selectedPr.review_level ?? 'unassigned'}</div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="eyebrow">Priority</div>
                                        <div className="mt-2 text-lg font-semibold">{selectedPr.priority_score ?? 0}</div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="eyebrow">Health</div>
                                        <div className="mt-2 text-lg font-semibold">{selectedPr.health_score ?? 'n/a'}</div>
                                    </Card>
                                </div>
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                                    <Card className="p-4">
                                        <div className="grid gap-4">
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <strong className="block truncate text-lg font-semibold">{selectedPr.repository}</strong>
                                                    <div className="mt-1 flex flex-wrap gap-2">
                                                        <Badge>{selectedPr.status}</Badge>
                                                        <Badge>{selectedPr.review_level ?? 'unassigned'}</Badge>
                                                        <Badge variant={toneForStatus(selectedPr.latest_outcome ?? selectedPr.status)}>{selectedPr.latest_outcome ?? 'pending'}</Badge>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    <Button size="sm" variant="outline" onClick={() => window.electronAPI.openExternal(`https://github.com/${selectedPr.repository}/pull/${selectedPr.github_pr_id}`)}>
                                                        View
                                                    </Button>
                                                    <Button size="sm" variant="secondary" onClick={async () => {
                                                        const result = await window.electronAPI.executeNow();
                                                        prependLog(result.success ? 'info' : 'error', result.message);
                                                    }}>
                                                        Auto-fix
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 px-4 py-3"><span>Author</span><span className="font-medium text-foreground">{selectedPr.author}</span></div>
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 px-4 py-3"><span>SLA</span><span className="font-medium text-foreground">{selectedPr.sla_hours}h</span></div>
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 px-4 py-3"><span>Priority</span><span className="font-medium text-foreground">{selectedPr.priority_score ?? 0}</span></div>
                                                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel/70 px-4 py-3"><span>Health</span><span className="font-medium text-foreground">{selectedPr.health_score ?? 'n/a'}</span></div>
                                            </div>
                                        </div>
                                    </Card>
                                    <Card className="p-4">
                                        <div className="grid gap-3">
                                            <div className="flex items-center gap-2">
                                                <SquareTerminal className="h-4 w-4 text-muted-foreground" />
                                                <div className="text-sm font-medium">Operator Notes</div>
                                            </div>
                                            <p className="text-sm leading-6 text-muted-foreground">Use this lane to decide whether the PR should be inspected deeper, auto-remediated, or escalated to a human reviewer.</p>
                                            <div className="rounded-xl border border-border bg-panel/70 p-3 text-sm text-muted-foreground">
                                                Next best action: {selectedPr.latest_outcome === 'changes_requested' ? 'Run auto-fix and re-review.' : 'Open GitHub context and validate merge readiness.'}
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                                    <div className="grid gap-3">
                                        <h4 className="text-lg font-semibold">Execution Timeline</h4>
                                        {reviewTimeline.length ? reviewTimeline.map((item) => (
                                            <Card key={item.id} className="p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground">
                                                            <Activity className="h-4 w-4" />
                                                        </span>
                                                        <div>
                                                            <div className="font-medium">{item.title}</div>
                                                            <div className="text-sm text-muted-foreground">{item.detail}</div>
                                                        </div>
                                                    </div>
                                                    <Badge variant={toneForStatus(item.tone)}>{item.tone}</Badge>
                                                </div>
                                            </Card>
                                        )) : <EmptyState message="No execution timeline recorded." />}
                                    </div>
                                    <Card className="p-4">
                                        <div className="grid gap-4">
                                            <div>
                                                <div className="eyebrow">Signal Summary</div>
                                                <h4 className="mt-2 text-lg font-semibold">Operator Readout</h4>
                                            </div>
                                            <div className="grid gap-3">
                                                <div className="rounded-xl border border-border bg-panel/70 p-3">
                                                    <div className="text-sm font-medium">Comments</div>
                                                    <div className="mt-1 text-2xl font-black">{prDetail?.comments?.length ?? 0}</div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-panel/70 p-3">
                                                    <div className="text-sm font-medium">Auto-fix Attempts</div>
                                                    <div className="mt-1 text-2xl font-black">{prDetail?.autoFixAttempts?.length ?? 0}</div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-panel/70 p-3">
                                                    <div className="text-sm font-medium">Test Runs</div>
                                                    <div className="mt-1 text-2xl font-black">{prDetail?.testRuns?.length ?? 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                                {[
                                    ['Review History', prDetail?.reviews ?? [], (item) => item.id ?? `${item.executor_type}-${item.started_at}`, (item) => (
                                        <>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <strong>{item.executor_type}</strong>
                                                <Badge variant={toneForStatus(item.outcome ?? item.status)}>{item.outcome ?? item.status}</Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">Duration {formatDuration(item.duration_seconds)} · {formatRelativeTime(item.completed_at ?? item.started_at)}</div>
                                        </>
                                    )],
                                    ['Review Comments', prDetail?.comments ?? [], (item, index) => item.id ?? `${item.issue_type}-${index}`, (item) => (
                                        <>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <strong>{item.issue_type}</strong>
                                                <Badge variant={toneForStatus(item.severity)}>{item.severity}</Badge>
                                            </div>
                                            <div className="text-sm leading-6 text-muted-foreground">{item.message}</div>
                                            <div className="text-sm text-muted-foreground">{item.file_path}{item.line_number ? `:${item.line_number}` : ''} · {item.executor_type}</div>
                                        </>
                                    )],
                                    ['Auto-fix Attempts', prDetail?.autoFixAttempts ?? [], (item) => item.id ?? `${item.attempt_number}-${item.started_at}`, (item) => (
                                        <>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <strong>Attempt {item.attempt_number}</strong>
                                                <Badge variant={toneForStatus(item.status)}>{item.status}</Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground">{(item.issues_targeted ?? []).length} issues · {formatRelativeTime(item.started_at)}</div>
                                        </>
                                    )]
                                ].map(([title, items, keyResolver, renderItem]) => (
                                    <div key={title} className="grid gap-3">
                                        <h4 className="text-lg font-semibold">{title}</h4>
                                        {items.length ? items.map((item, index) => (
                                            <Card key={keyResolver(item, index)} className="p-4">
                                                <div className="grid gap-3">{renderItem(item)}</div>
                                            </Card>
                                        )) : <EmptyState message={`No ${title.toLowerCase()} recorded.`} />}
                                    </div>
                                ))}
                            </div>
                        ) : <EmptyState message="Select a PR to inspect details." />}
                    </Section>
                </div>
            </div>
        );
    }

    function renderMetrics() {
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

    function renderTeam() {
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

    function renderSecurity() {
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

    function renderConfig() {
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

    function renderLogs() {
        return (
            <div className="tab-page">
                <Section eyebrow="Execution" title="Live Process Logs" action={<Button variant="ghost" onClick={() => setLogs([])}>Clear</Button>}>
                    <div className="scroll-slim min-h-[28rem] rounded-[1.5rem] border border-border bg-panel/80 p-4 font-mono text-sm">
                        <div className="grid gap-3">
                            {logs.length ? logs.map((entry) => (
                                <div key={entry.id} className={cn('rounded-xl border px-4 py-3 leading-6', entry.type === 'error' ? 'border-rose-500/20 bg-rose-500/10 text-foreground' : entry.type === 'warn' ? 'border-amber-500/20 bg-amber-500/10 text-foreground' : 'border-border bg-background text-foreground')}>
                                    {entry.message}
                                </div>
                            )) : <EmptyState message="No logs yet. Start the agent to stream process output." />}
                        </div>
                    </div>
                </Section>
            </div>
        );
    }

    const themeIcon = themeMode === 'light' ? SunMedium : themeMode === 'dark' ? MoonStar : LaptopMinimal;
    const ThemeIcon = themeIcon;

    return (
        <div className="relative min-h-screen">
            {/* Sticky Top Navigation */}
            <nav className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80">
                <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-base">🥷</div>
                        <h1 className="hidden text-lg font-bold tracking-tight sm:block">Agentic Bunshin</h1>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* Create Button with Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowCreateMenu(!showCreateMenu)}
                                className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-secondary"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">New</span>
                            </button>
                            {showCreateMenu && (
                                <div
                                    ref={createMenuRef}
                                    className="absolute right-0 top-full z-[60] mt-2 w-48 rounded-lg border border-border bg-card shadow-lg"
                                >
                                    <div className="p-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateMenu(false);
                                                prependLog('info', 'Create Task clicked');
                                            }}
                                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary"
                                        >
                                            <ListTodo className="h-4 w-4" />
                                            Create Task
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowCreateMenu(false);
                                                prependLog('info', 'New Chat clicked');
                                            }}
                                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-secondary"
                                        >
                                            <MessageSquarePlus className="h-4 w-4" />
                                            New Chat
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Theme Switcher */}
                        <button
                            type="button"
                            onClick={() => {
                                const modes = ['system', 'dark', 'light'];
                                const currentIndex = modes.indexOf(themeMode);
                                const nextMode = modes[(currentIndex + 1) % modes.length];
                                setThemeMode(nextMode);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                            title={`Theme: ${themeMode}`}
                        >
                            <ThemeIcon className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="shell-grid">
                <aside className="border-b border-border bg-card px-4 py-5 md:px-5 xl:border-b-0 xl:border-r">
                    <div className="sidebar-stack mx-auto flex max-w-7xl flex-col gap-6 xl:max-w-none">
                        <Card className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-panel text-lg">🥷</div>
                                <div className="min-w-0">
                                    <p className="eyebrow">Personal AI Ops</p>
                                    <h1 className="whitespace-nowrap text-[1.2rem] font-black tracking-tight md:text-[1.35rem]">🥷 Agentic Bunshin 🥷</h1>
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">Daily-use review console for queue pressure, repository policy, and agent execution.</p>
                        </Card>
                        <nav className="scroll-slim grid auto-cols-[minmax(8.5rem,1fr)] grid-flow-col gap-2 overflow-x-auto rounded-xl border border-border bg-background p-3 xl:grid-flow-row xl:auto-cols-auto xl:overflow-visible">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSelectedTab(tab.id)}
                                        className={cn('flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition', selectedTab === tab.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                        <Card className="p-4">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <p className="eyebrow">Runtime</p>
                                    <div className="mt-1 text-sm font-medium">Agent Status</div>
                                </div>
                                <PanelLeft className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className={cn('inline-flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium', running ? 'border-emerald-500/20 bg-emerald-500/10 text-foreground' : 'border-border bg-panel text-foreground')}>
                                <span className={cn('h-2.5 w-2.5 rounded-full', statusDotClass(running))} />
                                {running ? 'Running' : 'Stopped'}
                            </div>
                            <div className="mt-4 grid gap-3 rounded-xl bg-panel p-4 text-sm">
                                <div className="flex items-center justify-between gap-3"><span className="eyebrow">WebSocket</span><strong>{wsStatus}</strong></div>
                                <div className="flex items-center justify-between gap-3"><span className="eyebrow">API</span><strong>{apiStatus}</strong></div>
                            </div>
                        </Card>
                    </div>
                </aside>
                <main className="px-3 py-3 md:px-6 md:py-4 xl:px-8">
                    <div className="mx-auto flex max-w-7xl flex-col gap-5">
                        <Card className="p-5">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                                <div>
                                    <p className="eyebrow">Operations</p>
                                    <h2 className="mt-2 text-3xl font-black tracking-tight">{activeTitle}</h2>
                                    <p className="mt-2 text-sm text-muted-foreground">Operate the review agent like a personal enterprise console: inspect, act, and adjust policy from one surface.</p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {workspaceStatusCards.map((item) => (
                                            <div key={item.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground">
                                                <span className={cn('h-2 w-2 rounded-full', item.tone === 'success' ? 'bg-emerald-500' : item.tone === 'danger' ? 'bg-rose-500' : item.tone === 'warn' ? 'bg-amber-500' : 'bg-slate-400')} />
                                                <span className="text-muted-foreground">{item.label}</span>
                                                <span>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-end">
                                    <div className="grid gap-2">
                                        <span className="text-sm font-medium text-muted-foreground">Range</span>
                                        <Select id="globalRange" value={String(rangeDays)} onChange={(event) => setRangeDays(Number(event.target.value))}>
                                            <option value="7">Last 7 Days</option>
                                            <option value="30">Last 30 Days</option>
                                            <option value="90">Last 90 Days</option>
                                        </Select>
                                    </div>
                                    <Button variant="outline" onClick={async () => {
                                        await refreshSnapshot();
                                        await refreshPRs();
                                        await refreshTeamSecurity();
                                        await refreshRepositoryConfig();
                                    }}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                                    <Button onClick={() => handleStart(false)}><PlayCircle className="mr-2 h-4 w-4" />Start</Button>
                                    <Button variant="secondary" onClick={() => handleStart(true)}>Run Once</Button>
                                    <Button variant="warning" disabled={!running} onClick={handleExecuteNow}>Execute Now</Button>
                                    <Button variant="danger" disabled={!running} onClick={handleStop}>Stop</Button>
                                </div>
                            </div>
                        </Card>
                        {selectedTab === 'overview' && renderOverview()}
                        {selectedTab === 'prs' && renderPRs()}
                        {selectedTab === 'metrics' && renderMetrics()}
                        {selectedTab === 'team' && renderTeam()}
                        {selectedTab === 'security' && renderSecurity()}
                        {selectedTab === 'config' && renderConfig()}
                        {selectedTab === 'logs' && renderLogs()}
                    </div>
                </main>
            </div>
        </div>
    );
}

createRoot(document.getElementById('root')).render(<App />);
